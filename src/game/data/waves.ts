/**
 * Per-wave enemy stats. A thin shell over `core/formulas.ts` — every number
 * here comes from the original's curves, so tuning happens in
 * `data/balance.ts`, never by editing this file.
 *
 * A wave is a clock, not a body count (see `WavePhase` in core/types.ts):
 * `spawnCount` entries drip in over WAVE_SPAWN_PHASE_DURATION seconds and the
 * next wave starts WAVE_COOLDOWN_DURATION later whether or not they died.
 */

import { BOSS_HP_MULTIPLIER, BOSS_SPEED_MULTIPLIER, ENEMY_MOVE_SPEED } from './balance';
import {
  chargeRewardForWave,
  enemyContactDamageForWave,
  enemyCountForWave,
  enemyHpForWave,
  isBossWave,
  voltageDmgMultiplier,
} from '../core/formulas';

/** Baseline stats for one enemy, before its type profile is applied. */
export interface EnemyStats {
  hp: number;
  speed: number;
  damage: number;
  chargeReward: number;
}

export interface WaveConfig {
  wave: number;
  isBoss: boolean;
  /** Entries this wave will queue up — the boss, when there is one, plus the regular count. */
  spawnCount: number;
  /** What a regular enemy of this wave is worth; type multipliers layer on top. */
  regular: EnemyStats;
  /** The boss entry, already inflated. Type profiles never apply to it. */
  boss: EnemyStats | null;
}

export { isBossWave };

export function getWaveConfig(wave: number, voltage = 1): WaveConfig {
  const boss = isBossWave(wave);
  const regularCount = enemyCountForWave(wave);

  const regular: EnemyStats = {
    hp: enemyHpForWave(wave, voltage),
    speed: ENEMY_MOVE_SPEED,
    damage: enemyContactDamageForWave(wave) * voltageDmgMultiplier(voltage),
    chargeReward: chargeRewardForWave(wave, false),
  };

  return {
    wave,
    isBoss: boss,
    // A boss wave is a normal wave *plus* a boss, not a boss on its own — the
    // escort is what makes the timed wave dangerous while the boss soaks.
    spawnCount: boss ? regularCount + 1 : regularCount,
    regular,
    boss: boss
      ? {
          hp: regular.hp * BOSS_HP_MULTIPLIER,
          speed: regular.speed * BOSS_SPEED_MULTIPLIER,
          damage: regular.damage,
          chargeReward: chargeRewardForWave(wave, true),
        }
      : null,
  };
}
