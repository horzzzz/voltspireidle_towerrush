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
}

/** One entry in a wave's drip-fed spawn queue. */
export interface SpawnEntry {
  kind: EnemyKind;
  isBoss: boolean;
}

export interface DamagePopup {
  id: number;
  x: number;
  y: number;
  amount: number;
  isBoss: boolean;
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

/** The six in-run upgrades bought with Charge. */
export type UpgradeId = 'damage' | 'attackSpeed' | 'health' | 'regen' | 'deflection' | 'scrapBonus';

export interface TowerState {
  levels: Record<UpgradeId, number>;
  /** Current HP pool. Max HP is derived from `levels.health`, not stored here. */
  health: number;
  attackCooldown: number;
}

export type BattlePhase = 'running' | 'wave-clear' | 'ended';

export type RunEndReason = 'defeated' | 'retired';

export interface RunResult {
  reason: RunEndReason;
  waveReached: number;
  scrapEarned: number;
  timeSurvived: number;
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

  charge: number;
  /** Scrap banked so far this run — added to the meta total on run end. */
  scrapEarned: number;
  killCount: number;

  nextEnemyId: number;
  nextEffectId: number;
  damagePopups: DamagePopup[];
  bolts: BoltEffect[];

  result: RunResult | null;
}
