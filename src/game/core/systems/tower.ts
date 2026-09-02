import { getTowerMaxHealth, getTowerRegen } from '../../data/tower-stats';
import type { RunEndReason, WorldState } from '../types';

/**
 * Passive regen each tick, clamped to max HP. Returns whether HP hit 0 —
 * callers decide what to do about it, rather than this reaching into
 * `world.phase` itself. Keeping every phase transition in `tickWorld`
 * (the one place that owns it) also sidesteps a TS control-flow quirk:
 * narrowing a property doesn't survive a call that could mutate it, so a
 * later `phase === 'ended'` check here would falsely read as unreachable.
 */
export function updateTowerVitals(world: WorldState, dt: number): boolean {
  const maxHealth = getTowerMaxHealth(world.tower.levels, world.loadout);
  const regen = getTowerRegen(world.tower.levels, world.loadout);
  world.tower.health = Math.min(maxHealth, world.tower.health + regen * dt);

  if (world.tower.health <= 0) {
    world.tower.health = 0;
    return true;
  }
  return false;
}

export function endRun(world: WorldState, reason: RunEndReason): void {
  world.phase = 'ended';
  world.result = {
    reason,
    waveReached: world.wave,
    wavesCleared: world.wavesCleared,
    scrapEarned: Math.round(world.scrapEarned),
    gemsCollected: world.gemsCollected,
    killCount: world.killCount,
    bossKills: world.bossKills,
    upgradesBought: world.upgradesBought,
    timeSurvived: world.time,
    voltageTier: world.loadout.voltageTier,
  };
}
