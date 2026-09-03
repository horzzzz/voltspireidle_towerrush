/**
 * Core simulation types. This file has zero React/RN/Skia imports on purpose —
 * the sim must run identically in a Node script (see scripts/battle-sim.ts)
 * and inside the app.
 */

import {
  REGEN_UPGRADE_BASE_VALUE,
  TOWER_BASE_ARMOR,
  TOWER_BASE_ATTACK_SPEED,
  TOWER_BASE_CRIT_CHANCE,
  TOWER_BASE_CRIT_MULTIPLIER,
  TOWER_BASE_DAMAGE,
  TOWER_BASE_DEFLECTION,
  TOWER_BASE_HP,
} from '../data/balance';
import type { Rng } from './rng';

export type EnemyKind = 'scavenger' | 'hulk' | 'runner';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  isBoss: boolean;
  x: number;
  y: number;
  /** Unit vector toward the tower — sprite facing, refreshed every movement tick. */
  dirX: number;
  dirY: number;
  hp: number;
  maxHp: number;
  /** px/s, already includes the per-kind and per-wave multipliers. */
  speed: number;
  /** Damage dealt per contact hit (1/s while touching the tower). */
  contactDamage: number;
  /** Collision + visual radius in design px, includes the per-kind scale. */
  radius: number;
  /** Visual scale factor relative to the base sprite (1.0 = design size). */
  scale: number;
  /** Charge granted to the player when this enemy dies. */
  chargeReward: number;
  /** Scrap granted to the player when this enemy dies, before the meta multipliers. */
  scrapReward: number;
  /** Countdown to the next contact hit, once `inContact` is true. */
  attackCooldown: number;
  inContact: boolean;
  /**
   * Which boss sprite this enemy wears, 0-based, cycled by wave (see
   * `pickBossVariant`). Render-only; always 0 for non-bosses.
   */
  bossVariant: number;
  /** True for exactly one enemy every GEM_WAVE_INTERVAL waves — see spawn.ts. */
  dropsGem: boolean;
  /**
   * Seconds of "just got hit" left on this enemy, counted down by combat.ts.
   * Render-only: the enemy atlas tints the sprite toward white by it, which
   * is what makes a shot visibly land on a specific body in the swarm.
   */
  hitFlash: number;
  /** Seconds this enemy has been alive — drives the warp-in scale-up. */
  age: number;
}

/** One entry in a wave's drip-fed spawn queue. */
export interface SpawnEntry {
  kind: EnemyKind;
  isBoss: boolean;
  /** See GEM_WAVE_INTERVAL in systems/spawn.ts. */
  dropsGem?: boolean;
}

/** What kind of thing just happened. See `VfxEvent` for which fields each one uses. */
export type VfxEventType =
  | 'bolt'
  | 'hit'
  | 'damage'
  | 'kill'
  | 'spawn'
  | 'towerHit'
  | 'waveStart'
  | 'upgrade';

/**
 * One thing that just happened and is worth showing. The sim emits these and
 * knows nothing about how (or whether) they get drawn — the render layer's
 * VFX system (src/game/vfx) drains the queue every frame and turns each one
 * into particles, beams, numbers and rings.
 *
 * One flat mutable record rather than a discriminated union of object
 * literals, because these are **pooled**: the queue keeps its records forever
 * and `emitVfx` hands back a reset one to fill in. A busy frame emits three
 * events per shot plus one per enemy in contact, and at x3 that was thousands
 * of short-lived objects a second on the JS heap — the same pressure that
 * made the buffers worth compacting (see vfx/frame-buffer.ts).
 *
 * The cost of pooling is that the type no longer says which fields a given
 * `type` uses. Which fields each one means:
 *
 * - `bolt`      — (x, y) tower, (x2, y2) impact point clamped to the attack ring, isCrit
 * - `hit`       — (x, y), (dirX, dirY) unit vector the bolt arrived along, radius, isCrit, isBoss
 * - `damage`    — (x, y), amount, isCrit, isBoss
 * - `kill`      — (x, y), radius, kind, isBoss, bossVariant, dropsGem
 * - `spawn`     — (x, y), radius, isBoss
 * - `towerHit`  — (x, y) the attacker, (dirX, dirY) toward the tower, amount
 * - `waveStart` — wave, isBoss
 * - `upgrade`   — nothing
 */
export interface VfxEvent {
  type: VfxEventType;
  x: number;
  y: number;
  /** `bolt` only: where the bolt ends. */
  x2: number;
  y2: number;
  dirX: number;
  dirY: number;
  radius: number;
  amount: number;
  kind: EnemyKind;
  isCrit: boolean;
  isBoss: boolean;
  bossVariant: number;
  dropsGem: boolean;
  wave: number;
}

function createVfxEvent(): VfxEvent {
  return {
    type: 'upgrade',
    x: 0,
    y: 0,
    x2: 0,
    y2: 0,
    dirX: 0,
    dirY: 0,
    radius: 0,
    amount: 0,
    kind: 'scavenger',
    isCrit: false,
    isBoss: false,
    bossVariant: 0,
    dropsGem: false,
    wave: 0,
  };
}

/**
 * Hard ceiling on the un-drained queue. In the app `use-battle-engine` drains
 * it every frame so it never comes close; headless (scripts/battle-sim.ts)
 * nothing drains it at all, and this is what stops a 10-minute simulated run
 * from growing the pool without bound.
 */
export const MAX_VFX_QUEUE = 512;

/**
 * Claims the next queue slot and returns it, fully reset, for the caller to
 * fill in. Returns `null` once the queue is saturated — the event is simply
 * dropped, exactly as before.
 *
 * Records are reused across frames: `world.vfxCount` is what gets rewound
 * after a drain, never the array itself.
 */
export function emitVfx(world: WorldState, type: VfxEventType): VfxEvent | null {
  if (world.vfxCount >= MAX_VFX_QUEUE) return null;
  let event = world.vfx[world.vfxCount];
  if (event === undefined) {
    event = createVfxEvent();
    world.vfx.push(event);
  }
  world.vfxCount++;

  event.type = type;
  event.x = 0;
  event.y = 0;
  event.x2 = 0;
  event.y2 = 0;
  event.dirX = 0;
  event.dirY = 0;
  event.radius = 0;
  event.amount = 0;
  event.kind = 'scavenger';
  event.isCrit = false;
  event.isBoss = false;
  event.bossVariant = 0;
  event.dropsGem = false;
  event.wave = 0;
  return event;
}

/**
 * The in-run upgrades bought with Charge. Every one of them has a permanent
 * Coilworks counterpart (data/coilworks.ts) that sets its level-0 value, so a
 * run always starts from the player's meta progress — see `loadoutBaseFor`
 * in data/tower-stats.ts.
 */
export type UpgradeId =
  | 'damage'
  | 'attackSpeed'
  | 'critChance'
  | 'critMultiplier'
  | 'health'
  | 'regen'
  | 'armor'
  | 'deflection'
  | 'chargePerWave'
  | 'scrapPerWave';

export interface TowerState {
  levels: Record<UpgradeId, number>;
  /** Current HP pool. Max HP is derived from `levels.health`, not stored here. */
  health: number;
  attackCooldown: number;
}

export type BattlePhase = 'running' | 'ended';

/**
 * Waves run on a clock, not on a body count: enemies drip in for
 * WAVE_SPAWN_PHASE_DURATION seconds, then the wave idles for
 * WAVE_COOLDOWN_DURATION and the next one starts regardless of how much of
 * the last one is still alive. Survivors carry over and pile up — that
 * pressure is the whole point, and it is what lets income be "per wave"
 * (see formulas.waveCountIncomeScale) instead of "per clear".
 */
export type WavePhase = 'spawning' | 'cooldown';

export type RunEndReason = 'defeated' | 'retired';

/**
 * What the equipped Chips are worth for one run — see `data/chips.ts`
 * (`buildChipModifiers`). Every field is a plain multiplier with 1 as its
 * neutral value, so a player with no chips equipped produces exactly the
 * numbers the sim had before chips existed.
 */
export interface ChipModifiers {
  /** Multiplies the Spire's attack speed. */
  attackSpeedMult: number;
  /** Multiplies the Spire's maximum health. */
  maxHealthMult: number;
  /** Multiplies crit chance (before the 100% clamp). */
  critChanceMult: number;
  /** Multiplies Scrap dropped per kill. */
  scrapMult: number;
  /** Multiplies Charge dropped per kill. */
  chargeMult: number;
  /** Extra Scrap multiplier applied only when the killing blow was a crit. */
  critScrapMult: number;
  /** Multiplies the HP of the wave's toughest bodies (bosses and hulks). */
  toughHpMult: number;
  /** Multiplies the Charge price of in-run upgrades (< 1 is a discount). */
  upgradeCostMult: number;
}

export function neutralChipModifiers(): ChipModifiers {
  return {
    attackSpeedMult: 1,
    maxHealthMult: 1,
    critChanceMult: 1,
    scrapMult: 1,
    chargeMult: 1,
    critScrapMult: 1,
    toughHpMult: 1,
    upgradeCostMult: 1,
  };
}

/**
 * Meta -> run bridge, built once per run by economy/loadout.ts from the
 * player's persisted Coilworks levels and selected Voltage. The sim reads
 * this and nothing else from the meta layer — keeps `createWorld` callable
 * headless (scripts/battle-sim.ts) without a store in the loop.
 */
export interface RunLoadout {
  // Level-0 values for the in-run upgrades, each one this player's permanent
  // Coilworks value for that stat (data/tower-stats.ts `loadoutBaseFor`).
  damageBase: number;
  attackSpeedBase: number;
  healthBase: number;
  regenBase: number;
  /** Flat damage subtracted from each contact hit, before deflection. */
  armorBase: number;
  /** Fraction 0..1 of incoming damage removed. */
  deflectionBase: number;
  /** Percentage, not a fraction — the Spire starts at 1. */
  critChanceBase: number;
  /** Damage multiplier on a critical hit — the Spire starts at 1.2. */
  critMultiplierBase: number;

  // Flat wave-end payouts and drop bonuses — these have no in-run base, they
  // simply add on top of whatever the in-run branches pay.
  /** Flat Charge paid at the end of each wave, once the branch is unlocked. */
  chargePerWave: number;
  /** Flat Scrap paid at the end of each wave, once the branch is unlocked. */
  scrapPerWave: number;
  /** Fraction 0..1 bonus to Charge drops. */
  chargeBonus: number;
  /** Fraction 0..1 bonus to Scrap drops. */
  scrapPerKillBonus: number;

  /** What the equipped Chips are worth this run — see ChipModifiers. */
  chips: ChipModifiers;

  voltageTier: number;
  scrapMult: number;
  enemyHpMult: number;
  enemyDmgMult: number;
  /**
   * Which in-run Charge upgrades this run may buy — mirrors the player's
   * Coilworks unlock state (data/coilworks.ts `unlockCost` branches) at the
   * moment the run started. An id absent from Coilworks entirely (there is
   * no permanent counterpart) is always unlocked. Both the UI (UpgradeBar
   * hides a locked row) and the sim (`buyUpgrade` refuses it) enforce this —
   * a stat the player hasn't unlocked must not be buyable in battle either.
   */
  runUpgradesUnlocked: Record<UpgradeId, boolean>;
}

function allUpgradesUnlocked(): Record<UpgradeId, boolean> {
  return {
    damage: true,
    attackSpeed: true,
    critChance: true,
    critMultiplier: true,
    health: true,
    regen: true,
    armor: true,
    deflection: true,
    chargePerWave: true,
    scrapPerWave: true,
  };
}

/**
 * A player who has bought nothing: the original's own starting Spire. Used by
 * the headless harness and by any UI preview rendered before a run exists.
 */
export function defaultRunLoadout(): RunLoadout {
  return {
    damageBase: TOWER_BASE_DAMAGE,
    attackSpeedBase: TOWER_BASE_ATTACK_SPEED,
    healthBase: TOWER_BASE_HP,
    regenBase: REGEN_UPGRADE_BASE_VALUE,
    armorBase: TOWER_BASE_ARMOR,
    deflectionBase: TOWER_BASE_DEFLECTION,
    critChanceBase: TOWER_BASE_CRIT_CHANCE,
    critMultiplierBase: TOWER_BASE_CRIT_MULTIPLIER,
    chargePerWave: 0,
    scrapPerWave: 0,
    chargeBonus: 0,
    scrapPerKillBonus: 0,
    chips: neutralChipModifiers(),
    voltageTier: 1,
    scrapMult: 1,
    enemyHpMult: 1,
    enemyDmgMult: 1,
    runUpgradesUnlocked: allUpgradesUnlocked(),
  };
}

export interface RunSummary {
  reason: RunEndReason;
  waveReached: number;
  wavesCleared: number;
  scrapEarned: number;
  gemsCollected: number;
  killCount: number;
  bossKills: number;
  upgradesBought: number;
  timeSurvived: number;
  voltageTier: number;
}

export interface WorldState {
  /** Seeded per run so wave composition is reproducible for debugging. */
  rng: Rng;
  phase: BattlePhase;
  /** Total simulated seconds elapsed this run (not wall-clock). */
  time: number;
  /** 1 / 2 / 3 — multiplies real time before it enters the fixed-step accumulator. */
  speedMultiplier: number;
  /** Leftover simulated seconds not yet consumed by a fixed step. */
  accumulator: number;

  wave: number;
  isBossWave: boolean;
  wavePhase: WavePhase;
  /** Seconds left in the current wave phase — drives both pacing and the HUD bar. */
  phaseTimeLeft: number;
  /** Entries still to spawn this wave (drip-fed over the spawn phase). */
  spawnQueue: SpawnEntry[];
  /** How many entries this wave started with — the HUD bar's denominator. */
  waveSpawnTotal: number;
  spawnTimer: number;
  /**
   * True from the start of a boss wave until the boss entry is dequeued.
   * Waves no longer wait for the boss to die, but the HUD still shows the
   * boss's HP as the wave bar, and needs to tell "hasn't spawned yet" apart
   * from "already dead".
   */
  bossPending: boolean;

  enemies: Enemy[];
  tower: TowerState;

  /** Meta -> run bridge, fixed for the whole run — see RunLoadout. */
  loadout: RunLoadout;

  charge: number;
  /** Scrap banked so far this run — added to the meta total on run end. */
  scrapEarned: number;
  killCount: number;
  wavesCleared: number;
  bossKills: number;
  gemsCollected: number;
  upgradesBought: number;

  nextEnemyId: number;
  /**
   * Pooled event records — see VfxEvent / emitVfx. Only the first `vfxCount`
   * are live; the array itself is never trimmed, so the records get reused
   * instead of reallocated every frame.
   */
  vfx: VfxEvent[];
  vfxCount: number;

  result: RunSummary | null;
}
