import { create } from 'zustand';

import { getTowerMaxHealth } from '../data/tower-stats';
import { getWaveConfig } from '../data/waves';
import type { BattlePhase, BoltEffect, DamagePopup, RunResult, UpgradeId, WorldState } from '../core/types';

/**
 * React-facing mirror of the sim, refreshed at a throttled rate (see
 * use-battle-engine's PUBLISH_INTERVAL) — HUD text, upgrade bar, and the
 * (few, short-lived) bolt/popup effects all read from here. The 60fps path
 * — enemy positions — never touches this store; it goes straight from the
 * sim to Reanimated shared values, bypassing React entirely.
 */
export interface BattleSnapshot {
  phase: BattlePhase;
  wave: number;
  isBossWave: boolean;
  /** Enemies this wave will spawn in total — for the wave panel's progress bar. */
  waveEnemiesTotal: number;
  /** Not yet killed: still queued to spawn, or alive on the field. */
  waveEnemiesRemaining: number;
  /**
   * 1 = boss at full HP, 0 = boss dead or not spawned yet. On a boss wave the
   * wave panel shows this (inverted) instead of the generic kill count, so
   * the bar visibly advances with every hit on the boss and finishes exactly
   * when it dies — independent of how much escort is still alive.
   */
  bossHpFraction: number;
  charge: number;
  scrapEarned: number;
  killCount: number;
  towerHealth: number;
  towerMaxHealth: number;
  upgradeLevels: Record<UpgradeId, number>;
  speedMultiplier: number;
  result: RunResult | null;
  damagePopups: DamagePopup[];
  bolts: BoltEffect[];
}

interface BattleStore extends BattleSnapshot {
  publish: (world: WorldState) => void;
}

const INITIAL: BattleSnapshot = {
  phase: 'running',
  wave: 1,
  isBossWave: false,
  waveEnemiesTotal: 0,
  waveEnemiesRemaining: 0,
  bossHpFraction: 1,
  charge: 0,
  scrapEarned: 0,
  killCount: 0,
  towerHealth: 0,
  towerMaxHealth: 0,
  upgradeLevels: { damage: 0, attackSpeed: 0, health: 0, regen: 0, deflection: 0, scrapBonus: 0 },
  speedMultiplier: 1,
  result: null,
  damagePopups: [],
  bolts: [],
};

export const useBattleStore = create<BattleStore>((set) => ({
  ...INITIAL,
  publish: (world) => {
    const boss = world.enemies.find((e) => e.isBoss);
    const bossHpFraction = boss ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : world.bossPending ? 1 : 0;

    set({
      phase: world.phase,
      wave: world.wave,
      isBossWave: world.isBossWave,
      waveEnemiesTotal: getWaveConfig(world.wave).enemyCount,
      waveEnemiesRemaining: world.spawnQueue.length + world.enemies.length,
      bossHpFraction,
      charge: world.charge,
      scrapEarned: world.scrapEarned,
      killCount: world.killCount,
      towerHealth: world.tower.health,
      towerMaxHealth: getTowerMaxHealth(world.tower.levels),
      upgradeLevels: world.tower.levels,
      speedMultiplier: world.speedMultiplier,
      result: world.result,
      damagePopups: world.damagePopups,
      bolts: world.bolts,
    });
  },
}));
