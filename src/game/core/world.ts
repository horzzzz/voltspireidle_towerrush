import { STARTING_CHARGE, WAVE_SPAWN_PHASE_DURATION } from '../data/balance';
import {
  createInitialUpgradeLevels,
  getChargePerWave,
  getScrapPerWave,
  getTowerMaxHealth,
} from '../data/tower-stats';
import { getWaveConfig } from '../data/waves';
import { advanceEnemyTimers, updateContactDamage, updateTowerAttack, pruneCombatState } from './systems/combat';
import { updateMovement } from './systems/movement';
import { startWave, updateSpawns, updateWaveClock } from './systems/spawn';
import { endRun, updateTowerVitals } from './systems/tower';
import { Rng } from './rng';
import { defaultRunLoadout, type RunLoadout, type WorldState } from './types';

/** Simulation step, seconds. Combat timers key off this, not frame time. */
export const FIXED_DT = 1 / 60;
/** Caps how many fixed steps run per `advanceSimulation` call (spiral-of-death guard). */
const MAX_STEPS_PER_ADVANCE = 10;

/**
 * `loadout` defaults to the original's confirmed starting Spire stats
 * (RunLoadout's own defaults) — lets the headless sim harness and any test
 * call this with no meta layer at all.
 */
export function createWorld(seed = Date.now(), loadout: RunLoadout = defaultRunLoadout()): WorldState {
  const world: WorldState = {
    rng: new Rng(seed),
    phase: 'running',
    time: 0,
    speedMultiplier: 1,
    accumulator: 0,

    wave: 1,
    isBossWave: false,
    wavePhase: 'spawning',
    phaseTimeLeft: WAVE_SPAWN_PHASE_DURATION,
    spawnQueue: [],
    waveSpawnTotal: 0,
    spawnTimer: 0,
    bossPending: false,

    enemies: [],
    tower: {
      levels: createInitialUpgradeLevels(),
      health: 0, // set below, once max HP is known
      attackCooldown: 0,
    },
    loadout,

    charge: STARTING_CHARGE,
    scrapEarned: 0,
    killCount: 0,
    wavesCleared: 0,
    bossKills: 0,
    gemsCollected: 0,
    upgradesBought: 0,

    nextEnemyId: 1,
    vfx: [],

    result: null,
  };

  world.tower.health = getTowerMaxHealth(world.tower.levels, loadout);
  startWave(world, 1);
  return world;
}

/** Advances the sim by exactly one fixed step. */
export function tickWorld(world: WorldState, dt: number): void {
  if (world.phase === 'ended') return;

  world.time += dt;
  const config = getWaveConfig(world.wave, world.loadout.voltageTier);

  updateSpawns(world, dt, config);
  updateMovement(world, dt);
  updateTowerAttack(world, dt);
  updateContactDamage(world, dt);
  advanceEnemyTimers(world, dt);
  if (updateTowerVitals(world, dt)) {
    endRun(world, 'defeated');
    return;
  }

  pruneCombatState(world);

  // The wave clock runs regardless of what is still alive — see WavePhase.
  if (updateWaveClock(world, dt)) {
    payWaveCycle(world);
    world.wavesCleared += 1;
    startWave(world, world.wave + 1);
  }
}

/**
 * The original's `wave_cycle_completed` payout: flat Charge/Wave and
 * Scrap/Wave, each the sum of its Coilworks branch and its in-run branch.
 * Neither is touched by the Voltage or bonus multipliers — those apply only
 * to per-kill income (see `killEnemy` in systems/combat.ts).
 */
function payWaveCycle(world: WorldState): void {
  const { loadout, tower } = world;

  const charge = getChargePerWave(tower.levels, loadout);
  if (charge > 0) world.charge += charge;

  const scrap = getScrapPerWave(tower.levels, loadout);
  if (scrap > 0) world.scrapEarned += scrap;
}

/**
 * Real-time entry point: converts wall-clock `dt` to sim time via the speed
 * multiplier, then drains it in fixed steps. Called every frame by the
 * render layer's `use-battle-engine` hook (or, headless, by a manual loop).
 */
export function advanceSimulation(world: WorldState, realDtSeconds: number): void {
  world.accumulator += realDtSeconds * world.speedMultiplier;
  let steps = 0;
  while (world.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_ADVANCE) {
    tickWorld(world, FIXED_DT);
    world.accumulator -= FIXED_DT;
    steps++;
  }
  // Dropping leftover accumulator when the cap is hit (rather than letting it
  // balloon) trades a little time-dilation under extreme lag for guaranteed
  // frame-budget safety — never a silent infinite catch-up loop.
  if (steps === MAX_STEPS_PER_ADVANCE) world.accumulator = 0;
}

export function setSpeedMultiplier(world: WorldState, multiplier: 1 | 2 | 3): void {
  world.speedMultiplier = multiplier;
}

export function retireRun(world: WorldState): void {
  if (world.phase === 'ended') return;
  endRun(world, 'retired');
}
