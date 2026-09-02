import type { Rng } from '../core/rng';
import type { EnemyKind } from '../core/types';

/**
 * Three visual sprites, three distinct roles (per user direction, not
 * cosmetic-only):
 *  - scavenger (enemy-01, spider) — balanced, the wave's baseline.
 *  - hulk (enemy-02, armored beetle) — tanky and slow.
 *  - runner (enemy-03, worm) — fragile and fast.
 * `spriteAspect` (height/width) lets the renderer size the Atlas rect from
 * the source PNG without hardcoding pixel dimensions per kind.
 */
export interface EnemyProfile {
  kind: EnemyKind;
  hpMul: number;
  speedMul: number;
  dmgMul: number;
  scale: number;
  spriteAspect: number;
}

export const ENEMY_PROFILES: Record<EnemyKind, EnemyProfile> = {
  scavenger: { kind: 'scavenger', hpMul: 1.0, speedMul: 1.0, dmgMul: 1.0, scale: 1.0, spriteAspect: 533 / 444 },
  hulk: { kind: 'hulk', hpMul: 2.4, speedMul: 0.6, dmgMul: 1.0, scale: 1.15, spriteAspect: 480 / 319 },
  runner: { kind: 'runner', hpMul: 0.55, speedMul: 1.6, dmgMul: 1.0, scale: 0.85, spriteAspect: 506 / 277 },
};

/**
 * A boss's hp/speed/damage come from BOSS_HP_MULT etc. in `data/waves.ts` —
 * flat numbers, not a per-kind profile, so a boss threatens the same
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

/**
 * Composition ramps in gradually so each type reads before the mix gets
 * busy: waves 1-4 are spider-only, runners join at 5, hulks at 8, then the
 * spider share eases from 60% down to 40% over waves 8-28.
 */
function weightsForWave(wave: number): Record<EnemyKind, number> {
  if (wave <= 4) return { scavenger: 1, runner: 0, hulk: 0 };
  if (wave <= 7) return { scavenger: 0.75, runner: 0.25, hulk: 0 };
  const t = Math.min(1, (wave - 8) / 20);
  const scavenger = 0.6 - 0.2 * t;
  const remainder = 1 - scavenger;
  return { scavenger, runner: remainder / 2, hulk: remainder / 2 };
}

export function pickEnemyKind(wave: number, rng: Rng): EnemyKind {
  return rng.weighted(weightsForWave(wave));
}

export function buildWaveComposition(count: number, wave: number, rng: Rng): EnemyKind[] {
  const kinds: EnemyKind[] = [];
  for (let i = 0; i < count; i++) kinds.push(pickEnemyKind(wave, rng));
  return kinds;
}
