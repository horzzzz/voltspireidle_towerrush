/**
 * Core simulation types. This file has zero React/RN/Skia imports on purpose —
 * the sim must run identically in a Node script (see scripts/battle-sim.ts)
 * and inside the app.
 */

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
  /** Countdown to the next contact hit, once `inContact` is true. */
  attackCooldown: number;
  inContact: boolean;
  /** True for exactly one enemy every GEM_WAVE_INTERVAL waves — see spawn.ts. */
  dropsGem: boolean;
}

/** One entry in a wave's drip-fed spawn queue. */
export interface SpawnEntry {
  kind: EnemyKind;
  isBoss: boolean;
  /** See GEM_WAVE_INTERVAL in systems/spawn.ts. */
  dropsGem?: boolean;
}

export interface DamagePopup {
  id: number;
  x: number;
  y: number;
  amount: number;
  isBoss: boolean;
  isCrit: boolean;
  /** `world.time` when this popup was created — render layer ages it out. */
  spawnedAt: number;
}

export interface BoltEffect {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  spawnedAt: number;
}

/**
 * The in-run upgrades bought with Charge. `critChance`/`armor` mirror their
 * Coilworks-permanent counterparts (data/coilworks.ts) rather than being
 * unique to a run — see the loadout-combining pattern on `getTowerDeflection`
 * in data/tower-stats.ts, which `getTowerCritChance`/`getTowerArmor` now follow too.
 */
export type UpgradeId =
  | 'damage'
  | 'attackSpeed'
  | 'critChance'
  | 'health'
  | 'regen'
  | 'deflection'
  | 'armor'
  | 'scrapBonus';

export interface TowerState {
  levels: Record<UpgradeId, number>;
  /** Current HP pool. Max HP is derived from `levels.health`, not stored here. */
  health: number;
  attackCooldown: number;
}

export type BattlePhase = 'running' | 'wave-clear' | 'ended';

export type RunEndReason = 'defeated' | 'retired';

/**
 * Meta -> run bridge, built once per run by economy/loadout.ts from the
 * player's persisted Coilworks levels and selected Voltage. The sim reads
 * this and nothing else from the meta layer — keeps `createWorld` callable
 * headless (scripts/battle-sim.ts) without a store in the loop.
 */
export interface RunLoadout {
  damageBase: number;
  attackSpeedBase: number;
  healthBase: number;
  regenBase: number;
  /** Fraction 0..1. */
  critChance: number;
  /** Flat damage subtracted from each contact hit, before deflection. */
  armor: number;
  /** Fraction 0..1, added to the in-run Deflection upgrade's own fraction. */
  deflectionBase: number;
  /** Flat Scrap added to every wave's reward, before the Voltage/scrap-bonus multipliers. */
  scrapPerWave: number;
  /** Fraction 0..1 bonus to Charge drops. */
  chargeBonus: number;
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
    health: true,
    regen: true,
    deflection: true,
    armor: true,
    scrapBonus: true,
  };
}

export function defaultRunLoadout(): RunLoadout {
  return {
    damageBase: 14,
    attackSpeedBase: 1.0,
    healthBase: 6,
    regenBase: 0.2,
    critChance: 0,
    armor: 0,
    deflectionBase: 0,
    scrapPerWave: 0,
    chargeBonus: 0,
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
  /** Entries still to spawn this wave (drip-fed, not a burst). */
  spawnQueue: SpawnEntry[];
  spawnTimer: number;
  /**
   * True from the start of a boss wave until the boss entry is dequeued.
   * `isWaveCleared` needs this: a boss wave clears the instant the boss dies,
   * even if escort mobs are still queued or alive — this flag is what tells
   * it "the boss existed and hasn't spawned yet" vs. "it's dead".
   */
  bossPending: boolean;
  /** Pause between a cleared wave and the next one starting. */
  waveTimer: number;

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
  nextEffectId: number;
  damagePopups: DamagePopup[];
  bolts: BoltEffect[];

  result: RunSummary | null;
}
