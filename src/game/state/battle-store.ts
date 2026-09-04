import { create } from 'zustand';

import { WAVE_COOLDOWN_DURATION, WAVE_SPAWN_PHASE_DURATION } from '../data/balance';
import { createInitialUpgradeLevels, getTowerMaxHealth, UPGRADE_ORDER } from '../data/tower-stats';
import { waveProgressFraction } from '../core/formulas';
import { waveEnemiesLeftToSpawn } from '../core/systems/spawn';
import { defaultRunLoadout } from '../core/types';
import type { BattlePhase, RunLoadout, RunSummary, UpgradeId, WorldState } from '../core/types';

/**
 * React-facing mirror of the sim, refreshed at a throttled rate (see
 * use-battle-engine's PUBLISH_INTERVAL) — HUD text, the upgrade bar and the
 * run-over overlay read from here. Neither of the 60fps paths touches this
 * store: enemy positions and every VFX effect go straight from the sim to
 * Reanimated shared values, bypassing React entirely.
 */
export interface BattleSnapshot {
  phase: BattlePhase;
  wave: number;
  isBossWave: boolean;
  /**
   * 0..1 across the wave's spawn + cooldown clock — the wave panel's bar on a
   * normal wave. Waves advance on this timer, not on kills, so the bar tracks
   * the clock (see `formulas.waveProgressFraction`).
   */
  waveProgress: number;
  /** Alive on the field right now — survivors of earlier waves included. */
  enemiesAlive: number;
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
  /** The run's fixed Coilworks/Voltage bridge — UpgradeRow needs it to show real current→next stats. */
  loadout: RunLoadout;
  speedMultiplier: number;
  result: RunSummary | null;
}

interface BattleStore extends BattleSnapshot {
  publish: (world: WorldState) => void;
}

const INITIAL: BattleSnapshot = {
  phase: 'running',
  wave: 1,
  isBossWave: false,
  waveProgress: 0,
  enemiesAlive: 0,
  bossHpFraction: 1,
  charge: 0,
  scrapEarned: 0,
  killCount: 0,
  towerHealth: 0,
  towerMaxHealth: 0,
  upgradeLevels: createInitialUpgradeLevels(),
  loadout: defaultRunLoadout(),
  speedMultiplier: 1,
  result: null,
};

/**
 * Whether two level maps hold the same numbers. Ten integer compares and no
 * allocation — see `publish` for why the identity of that object is load
 * bearing in both directions.
 */
function sameUpgradeLevels(a: Record<UpgradeId, number>, b: Record<UpgradeId, number>): boolean {
  for (let i = 0; i < UPGRADE_ORDER.length; i++) {
    const id = UPGRADE_ORDER[i];
    if (a[id] !== b[id]) return false;
  }
  return true;
}

export const useBattleStore = create<BattleStore>((set, get) => ({
  ...INITIAL,
  publish: (world) => {
    // Bosses can outlive their own wave now that waves run on a clock, so the
    // bar must follow the newest one (highest id) rather than a straggler
    // still walking in from ten waves ago.
    let boss: (typeof world.enemies)[number] | undefined;
    for (let i = 0; i < world.enemies.length; i++) {
      const enemy = world.enemies[i];
      if (enemy.isBoss && (boss == null || enemy.id > boss.id)) boss = enemy;
    }
    const bossHpFraction = boss ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : world.bossPending ? 1 : 0;

    // `world.tower.levels` is the sim's own live object and `buyUpgrade`
    // raises a level by mutating it in place, so publishing it directly hands
    // the store a reference that is *never* new — and zustand compares with
    // `Object.is`. `UpgradeBar` selects exactly this object to derive every
    // row's level and price from, so it would never re-render: the bar stayed
    // frozen on the prices it read when the battle screen mounted, while the
    // sim went on charging the real (escalating) ones. A row could therefore
    // look affordable, refuse to buy, and then bill more than it displayed.
    //
    // That was masked until the bar stopped subscribing to `charge`, which had
    // been re-rendering it ~10x a second and re-reading the mutated object by
    // accident.
    //
    // So copy — but only when the numbers actually differ. Copying every
    // publish would restore the bug's mirror image, re-rendering the six-row
    // list ten times a second for values that almost never change, which is
    // precisely what dropping the `charge` subscription was meant to stop.
    // This way the reference is stable while nothing is bought, and new
    // exactly once when something is.
    //
    // The other two non-scalars here are safe: `loadout` is frozen for the
    // run's lifetime and `result` is built once when the run ends. Anything
    // added to this snapshot that the sim mutates in place needs the same
    // treatment.
    const previousLevels = get().upgradeLevels;
    const upgradeLevels = sameUpgradeLevels(previousLevels, world.tower.levels)
      ? previousLevels
      : { ...world.tower.levels };

    set({
      phase: world.phase,
      wave: world.wave,
      isBossWave: world.isBossWave,
      waveProgress: waveProgressFraction(
        world.wavePhase === 'spawning',
        world.phaseTimeLeft,
        WAVE_SPAWN_PHASE_DURATION,
        WAVE_COOLDOWN_DURATION,
        world.waveSpawnTotal,
        waveEnemiesLeftToSpawn(world),
      ),
      enemiesAlive: world.enemies.length,
      bossHpFraction,
      charge: world.charge,
      scrapEarned: world.scrapEarned,
      killCount: world.killCount,
      towerHealth: world.tower.health,
      towerMaxHealth: getTowerMaxHealth(world.tower.levels, world.loadout),
      upgradeLevels,
      loadout: world.loadout,
      speedMultiplier: world.speedMultiplier,
      result: world.result,
    });
  },
}));
