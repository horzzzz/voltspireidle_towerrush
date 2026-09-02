import { createInitialUpgradeLevels, getTowerMaxHealth, getTowerScrapBonus } from '../data/tower-stats';
import { getWaveConfig } from '../data/waves';
import { updateContactDamage, updateTowerAttack, pruneCombatState } from './systems/combat';
import { updateMovement } from './systems/movement';
import { isWaveCleared, startWave, updateSpawns, WAVE_CLEAR_PAUSE } from './systems/spawn';
import { endRun, updateTowerVitals } from './systems/tower';
import { Rng } from './rng';
import { defaultRunLoadout, type RunLoadout, type WorldState } from './types';

/** Charge granted at the start of every run, before any wave is cleared. */
const START_CHARGE = 20;

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
    spawnQueue: [],
    spawnTimer: 0,
    bossPending: false,
    waveTimer: 0,

    enemies: [],
    tower: {
      levels: createInitialUpgradeLevels(),
      health: 0, // set below, once max HP is known
      attackCooldown: 0,
    },
    loadout,

    charge: START_CHARGE,
    scrapEarned: 0,
    killCount: 0,
    wavesCleared: 0,
    bossKills: 0,
    gemsCollected: 0,
    upgradesBought: 0,

    nextEnemyId: 1,
    nextEffectId: 1,
    damagePopups: [],
    bolts: [],

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
  const config = getWaveConfig(world.wave);

  if (world.phase === 'running') {
    updateSpawns(world, dt, config);
    updateMovement(world, dt);
    updateTowerAttack(world, dt);
    updateContactDamage(world, dt);
    if (updateTowerVitals(world, dt)) endRun(world, 'defeated');
  }

  pruneCombatState(world);

  if (world.phase === 'running' && isWaveCleared(world)) {
    const { loadout } = world;
    world.scrapEarned +=
      (config.scrapReward + loadout.scrapPerWave) * loadout.scrapMult * getTowerScrapBonus(world.tower.levels);
    world.wavesCleared += 1;
    if (world.isBossWave) world.bossKills += 1;
    world.phase = 'wave-clear';
    world.waveTimer = WAVE_CLEAR_PAUSE;
  } else if (world.phase === 'wave-clear') {
    world.waveTimer -= dt;
    if (world.waveTimer <= 0) startWave(world, world.wave + 1);
  }
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
