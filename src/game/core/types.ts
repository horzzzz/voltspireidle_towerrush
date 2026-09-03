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

/**
 * One thing that just happened and is worth showing. The sim emits these and
 * knows nothing about how (or whether) they get drawn — the render layer's
 * VFX system (src/game/vfx) drains the queue every frame and turns each one
 * into particles, beams, numbers and rings.
 *
 * Deliberately plain data with no ids and no timestamps: an event is consumed
 * exactly once, the moment it is drained, so nothing here needs to survive or
 * be matched up across frames.
 */
export type VfxEvent =
  /** Tower shot a target. Endpoint is already clamped to the attack ring. */
  | { type: 'bolt'; x1: number; y1: number; x2: number; y2: number; isCrit: boolean }
  /** A shot connected: `dirX/dirY` is the unit vector the bolt arrived along. */
  | { type: 'hit'; x: number; y: number; dirX: number; dirY: number; radius: number; isCrit: boolean; isBoss: boolean }
  /** Floating damage number. */
  | { type: 'damage'; x: number; y: number; amount: number; isCrit: boolean; isBoss: boolean }
  /** An enemy died. `kind` picks the debris palette. */
  | { type: 'kill'; x: number; y: number; radius: number; kind: EnemyKind; isBoss: boolean; bossVariant: number; dropsGem: boolean }
  /** An enemy walked into view — drives the warp-in ring. */
  | { type: 'spawn'; x: number; y: number; radius: number; isBoss: boolean }
  /** The tower took a contact hit from an enemy standing at `x, y`. */
  | { type: 'towerHit'; x: number; y: number; dirX: number; dirY: number; amount: number }
  /** A new wave's clock started. */
  | { type: 'waveStart'; wave: number; isBoss: boolean }
  /** An in-run upgrade was bought. */
  | { type: 'upgrade' };

/**
 * Hard ceiling on the un-drained queue. In the app `use-battle-engine` drains
 * it every frame so it never comes close; headless (scripts/battle-sim.ts)
 * nothing drains it at all, and this is what keeps a 10-minute simulated run
 * from accumulating hundreds of thousands of dead event objects.
 */
export const MAX_VFX_QUEUE = 512;

/** Queues a VFX event, silently dropping it once the queue is saturated. */
export function emitVfx(world: WorldState, event: VfxEvent): void {
  if (world.vfx.length >= MAX_VFX_QUEUE) return;
  world.vfx.push(event);
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
  /** Drained every frame by the render layer — see VfxEvent / emitVfx. */
  vfx: VfxEvent[];

  result: RunSummary | null;
}
