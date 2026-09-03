import { ENEMY_TYPE_FAST_MIN_WAVE, ENEMY_TYPE_TANK_MIN_WAVE } from './balance';
import { enemyTypeShare } from '../core/formulas';
import type { Rng } from '../core/rng';
import type { EnemyKind } from '../core/types';

/**
 * Three sprites, three roles — and now the original's own stats behind them
 * (`resources/enemies/*.tres`, Voltspire 1.9.0):
 *  - `scavenger` (enemy-01, spider) = their `basic`: the wave's baseline.
 *  - `runner` (enemy-03, worm) = their `fast`: double speed, and — note —
 *    *no* HP penalty; it is simply quicker to reach the Spire.
 *  - `hulk` (enemy-02, beetle) = their `tank`: 5x HP at half speed.
 *
 * `scrap` is the type's `base_scrap`; the wave-depth and income-normalising
 * factors are layered on in `formulas.scrapRewardForKill`.
 *
 * `scale`/`spriteAspect` are art, not balance — they stay ours so the sprites
 * read correctly at our arena size.
 */
export interface EnemyProfile {
  kind: EnemyKind;
  hpMul: number;
  speedMul: number;
  dmgMul: number;
  scrap: number;
  scale: number;
  spriteAspect: number;
  /** Wave this type starts appearing on; 0 = from the first wave. */
  minWave: number;
}

export const ENEMY_PROFILES: Record<EnemyKind, EnemyProfile> = {
  scavenger: {
    kind: 'scavenger',
    hpMul: 1.0,
    speedMul: 1.0,
    dmgMul: 1.0,
    scrap: 1,
    scale: 1.0,
    spriteAspect: 533 / 444,
    minWave: 0,
  },
  runner: {
    kind: 'runner',
    hpMul: 1.0,
    speedMul: 2.0,
    dmgMul: 1.0,
    scrap: 2,
    scale: 0.85,
    spriteAspect: 506 / 277,
    minWave: ENEMY_TYPE_FAST_MIN_WAVE,
  },
  hulk: {
    kind: 'hulk',
    hpMul: 5.0,
    speedMul: 0.5,
    dmgMul: 1.0,
    scrap: 4,
    scale: 1.15,
    spriteAspect: 480 / 319,
    minWave: ENEMY_TYPE_TANK_MIN_WAVE,
  },
};

/**
 * A boss's hp/speed/damage come from the BOSS_* constants in `data/balance.ts`
 * — flat numbers, not a per-kind profile, so a boss threatens the same
 * regardless of which sprite it's wearing. `scaleMul` is the one thing that
 * *does* layer on top of the kind's own visual scale, purely cosmetic.
 */
export const BOSS_PROFILE = {
  scaleMul: 2.2,
};

const BOSS_SPRITE_CYCLE: EnemyKind[] = ['scavenger', 'hulk', 'runner'];

/** Wave 10 -> spider, 20 -> beetle, 30 -> worm, 40 -> spider again, ... */
export function pickBossKind(wave: number): EnemyKind {
  const index = Math.floor(wave / 10) - 1;
  const cycled = ((index % BOSS_SPRITE_CYCLE.length) + BOSS_SPRITE_CYCLE.length) % BOSS_SPRITE_CYCLE.length;
  return BOSS_SPRITE_CYCLE[cycled];
}

/** Number of distinct boss sprites (assets/images/battle/boss-{1,2,3}.png). */
export const BOSS_VARIANT_COUNT = 3;

/**
 * Which dedicated boss sprite a wave's boss wears — a plain wave cycle,
 * independent of the boss's enemy `kind`: wave 10 -> boss-1, 20 -> boss-2,
 * 30 -> boss-3, 40 -> boss-1, ...
 */
export function pickBossVariant(wave: number): number {
  const index = Math.floor(wave / 10) - 1;
  return ((index % BOSS_VARIANT_COUNT) + BOSS_VARIANT_COUNT) % BOSS_VARIANT_COUNT;
}

/**
 * Shares follow the original's `enemy_type_share`: each special type ramps
 * from 0 to 30% of the wave over 20 waves once its own minimum wave is
 * reached, and the baseline scavenger takes whatever is left. So waves 1-2
 * are pure spiders, worms creep in from wave 3, beetles from wave 5, and by
 * wave 25 the mix has settled at roughly 40/30/30.
 */
function weightsForWave(wave: number): Record<EnemyKind, number> {
  const runner = enemyTypeShare(wave, ENEMY_PROFILES.runner.minWave);
  const hulk = enemyTypeShare(wave, ENEMY_PROFILES.hulk.minWave);
  return { scavenger: Math.max(0, 1 - runner - hulk), runner, hulk };
}

export function pickEnemyKind(wave: number, rng: Rng): EnemyKind {
  return rng.weighted(weightsForWave(wave));
}

export function buildWaveComposition(count: number, wave: number, rng: Rng): EnemyKind[] {
  const kinds: EnemyKind[] = [];
  for (let i = 0; i < count; i++) kinds.push(pickEnemyKind(wave, rng));
  return kinds;
}
