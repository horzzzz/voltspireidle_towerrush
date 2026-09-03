import { ENEMY_BASE_RADIUS, raySpawnPoint } from '../../data/arena';
import { NORMAL_MAX_ON_SCREEN, WAVE_COOLDOWN_DURATION, WAVE_SPAWN_PHASE_DURATION } from '../../data/balance';
import {
  BOSS_PROFILE,
  buildWaveComposition,
  ENEMY_PROFILES,
  pickBossKind,
  pickBossVariant,
} from '../../data/enemies';
import { getWaveConfig, type WaveConfig } from '../../data/waves';
import { scrapRewardForKill } from '../formulas';
import type { Enemy, SpawnEntry, WorldState } from '../types';
import type { Rng } from '../rng';

/**
 * No dedicated gem-carrier enemy type (per user direction) — instead, one
 * random enemy in the wave's batch is flagged every GEM_WAVE_INTERVAL waves,
 * visually identical to its kind, and drops a gem on death. Capped per run
 * so it can't be farmed by grinding low waves forever (the original caps
 * its own gem-carriers for the same reason).
 */
export const GEM_WAVE_INTERVAL = 3;
export const MAX_GEMS_PER_RUN = 10;

/** Boss first, so it is on screen and soaking while its escort trickles in behind. */
function buildWaveQueue(config: WaveConfig, rng: Rng): SpawnEntry[] {
  const regularCount = config.isBoss ? config.spawnCount - 1 : config.spawnCount;
  const escorts = buildWaveComposition(regularCount, config.wave, rng).map((kind) => ({ kind, isBoss: false }));
  return config.isBoss ? [{ kind: pickBossKind(config.wave), isBoss: true }, ...escorts] : escorts;
}

/**
 * Starts a wave's clock and queues its enemies. Anything still queued from
 * the previous wave stays queued in front of them — the wave clock never
 * waits for the spawner, and the spawner never drops what the on-screen cap
 * held back.
 */
export function startWave(world: WorldState, wave: number): void {
  const config = getWaveConfig(wave, world.loadout.voltageTier);
  const batch = buildWaveQueue(config, world.rng);

  if (wave % GEM_WAVE_INTERVAL === 0 && world.gemsCollected < MAX_GEMS_PER_RUN) {
    // Never the boss entry itself — a boss already reads as a big spike via
    // its charge/scrap multipliers, and killing it is the wave's own event.
    const nonBossIndices = batch.reduce<number[]>((acc, entry, i) => {
      if (!entry.isBoss) acc.push(i);
      return acc;
    }, []);
    if (nonBossIndices.length > 0) {
      const pick = world.rng.pick(nonBossIndices);
      batch[pick] = { ...batch[pick], dropsGem: true };
    }
  }

  world.wave = wave;
  world.isBossWave = config.isBoss;
  world.bossPending = config.isBoss;
  world.wavePhase = 'spawning';
  world.phaseTimeLeft = WAVE_SPAWN_PHASE_DURATION;
  world.spawnQueue.push(...batch);
  world.waveSpawnTotal = batch.length;
  world.spawnTimer = 0;
}

/** Entries of the *current* wave still waiting to spawn — the HUD bar's numerator. */
export function waveEnemiesLeftToSpawn(world: WorldState): number {
  return Math.min(world.spawnQueue.length, world.waveSpawnTotal);
}

/**
 * Drains the spawn queue. The interval spreads the current wave's batch over
 * the whole spawn phase; when the on-screen cap is hit the queue simply
 * waits, which is also what makes the wave bar fall back to spawn progress
 * (see `formulas.waveProgressFraction`).
 */
export function updateSpawns(world: WorldState, dt: number, config: WaveConfig): void {
  if (world.spawnQueue.length === 0) return;
  if (world.enemies.length >= NORMAL_MAX_ON_SCREEN) return;

  world.spawnTimer -= dt;
  if (world.spawnTimer > 0) return;

  const entry = world.spawnQueue.shift()!;
  if (entry.isBoss) world.bossPending = false;
  spawnEnemy(world, entry, config);
  world.spawnTimer = WAVE_SPAWN_PHASE_DURATION / Math.max(1, config.spawnCount);
}

/**
 * Advances the wave clock. Returns true when a full spawn+cooldown cycle just
 * finished, which is the moment the original pays out Charge/Wave and
 * Scrap/Wave (`wave_cycle_completed`) — `tickWorld` owns that payout so every
 * economy change stays in one place.
 */
export function updateWaveClock(world: WorldState, dt: number): boolean {
  world.phaseTimeLeft -= dt;
  if (world.phaseTimeLeft > 0) return false;

  if (world.wavePhase === 'spawning') {
    world.wavePhase = 'cooldown';
    world.phaseTimeLeft = WAVE_COOLDOWN_DURATION;
    return false;
  }
  return true;
}

function spawnEnemy(world: WorldState, entry: SpawnEntry, config: WaveConfig): void {
  const profile = ENEMY_PROFILES[entry.kind];
  const angle = world.rng.range(0, Math.PI * 2);
  const { x, y } = raySpawnPoint(angle);

  // A boss's threat is the same no matter which sprite cycles in for it —
  // only its on-screen scale borrows from the kind profile; hp/speed/damage
  // come from the wave's boss stats alone. Without this, a boss wearing the
  // runner's sprite would inherit its 2x speed on top of the boss slowdown
  // and stop reading as slow.
  const stats = entry.isBoss ? config.boss! : config.regular;
  const scale = entry.isBoss ? profile.scale * BOSS_PROFILE.scaleMul : profile.scale;
  const hp = entry.isBoss ? stats.hp : stats.hp * profile.hpMul;
  const speed = entry.isBoss ? stats.speed : stats.speed * profile.speedMul;
  const damage = entry.isBoss ? stats.damage : stats.damage * profile.dmgMul;

  const enemy: Enemy = {
    id: world.nextEnemyId++,
    kind: entry.kind,
    isBoss: entry.isBoss,
    x,
    y,
    // Point at the tower from the moment it spawns — raySpawnPoint placed it
    // along this same ray, so the reverse direction is exact, no first-frame
    // guess needed before movement.ts gets a chance to correct it.
    dirX: -Math.cos(angle),
    dirY: -Math.sin(angle),
    hp,
    maxHp: hp,
    speed,
    contactDamage: damage,
    radius: ENEMY_BASE_RADIUS * scale,
    scale,
    chargeReward: stats.chargeReward,
    scrapReward: scrapRewardForKill(profile.scrap, entry.isBoss, config.wave),
    attackCooldown: 0,
    inContact: false,
    bossVariant: entry.isBoss ? pickBossVariant(config.wave) : 0,
    dropsGem: entry.dropsGem ?? false,
  };
  world.enemies.push(enemy);
}
