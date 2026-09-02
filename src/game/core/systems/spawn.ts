import { ENEMY_BASE_RADIUS, raySpawnPoint } from '../../data/arena';
import { buildWaveComposition, ENEMY_PROFILES, pickBossKind, BOSS_PROFILE } from '../../data/enemies';
import { bossEscortCount, getBaseWaveConfig, getWaveConfig, isBossWave, type WaveConfig } from '../../data/waves';
import type { Enemy, SpawnEntry, WorldState } from '../types';
import type { Rng } from '../rng';

/** Seconds between individual spawns within a wave — a drip, not a burst. */
export const SPAWN_INTERVAL = 0.55;
/** Pause after a wave is fully cleared, before the next one starts. */
export const WAVE_CLEAR_PAUSE = 1.5;

/**
 * No dedicated gem-carrier enemy type (per user direction) — instead, one
 * random enemy in the spawn queue is flagged every GEM_WAVE_INTERVAL waves,
 * visually identical to its kind, and drops a gem on death. Capped per run
 * so it can't be farmed by grinding low waves forever (the original caps
 * its own gem-carriers for the same reason — see voltspire-original-teardown
 * memory's "Носители выплат").
 */
export const GEM_WAVE_INTERVAL = 3;
export const MAX_GEMS_PER_RUN = 10;

/** Boss first (on screen immediately), then its escort trickles in behind it. */
function buildBossWaveQueue(wave: number, rng: Rng): SpawnEntry[] {
  const escortCount = bossEscortCount(wave);
  const escorts = buildWaveComposition(escortCount, wave, rng).map((kind) => ({ kind, isBoss: false }));
  return [{ kind: pickBossKind(wave), isBoss: true }, ...escorts];
}

export function startWave(world: WorldState, wave: number): void {
  const config = getWaveConfig(wave);
  world.wave = wave;
  world.isBossWave = config.isBoss;
  world.bossPending = config.isBoss;
  world.spawnQueue = config.isBoss
    ? buildBossWaveQueue(wave, world.rng)
    : buildWaveComposition(config.enemyCount, wave, world.rng).map((kind) => ({ kind, isBoss: false }));
  world.spawnTimer = 0;
  world.waveTimer = 0;
  world.phase = 'running';

  if (wave % GEM_WAVE_INTERVAL === 0 && world.gemsCollected < MAX_GEMS_PER_RUN && world.spawnQueue.length > 0) {
    // Never the boss entry itself — a boss already reads as a big spike via
    // its charge/scrap multipliers, and killing it is the wave's own event.
    const nonBossIndices = world.spawnQueue.reduce<number[]>((acc, entry, i) => {
      if (!entry.isBoss) acc.push(i);
      return acc;
    }, []);
    if (nonBossIndices.length > 0) {
      const pick = world.rng.pick(nonBossIndices);
      world.spawnQueue[pick] = { ...world.spawnQueue[pick], dropsGem: true };
    }
  }
}

export function updateSpawns(world: WorldState, dt: number, config: WaveConfig): void {
  if (world.spawnQueue.length === 0) return;
  world.spawnTimer -= dt;
  if (world.spawnTimer > 0) return;

  const entry = world.spawnQueue.shift()!;
  if (entry.isBoss) world.bossPending = false;
  spawnEnemy(world, entry, config);
  world.spawnTimer = SPAWN_INTERVAL;
}

function spawnEnemy(world: WorldState, entry: SpawnEntry, config: WaveConfig): void {
  const profile = ENEMY_PROFILES[entry.kind];
  const angle = world.rng.range(0, Math.PI * 2);
  const { x, y } = raySpawnPoint(angle);

  // Escorts on a boss wave use the wave's regular stats, never the boss's
  // own inflated `config` — only the boss entry itself gets BOSS_PROFILE.
  const stats = entry.isBoss ? config : getBaseWaveConfig(config.wave);
  // A boss's threat is the same no matter which sprite cycles in for it —
  // only its on-screen scale borrows from the kind profile (spider/beetle/
  // worm read as differently sized boss silhouettes); hp/speed/damage come
  // from BOSS_PROFILE alone. Without this, a boss wearing the runner's
  // sprite would inherit its 1.6x speed multiplier on top of the boss's own
  // slowdown and end up barely slower than a regular runner.
  const scale = entry.isBoss ? profile.scale * BOSS_PROFILE.scaleMul : profile.scale;
  const baseHp = entry.isBoss ? stats.enemyHp : stats.enemyHp * profile.hpMul;
  const speed = entry.isBoss ? stats.enemySpeed : stats.enemySpeed * profile.speedMul;
  const baseDamage = entry.isBoss ? stats.enemyDamage : stats.enemyDamage * profile.dmgMul;
  // Voltage tier scales enemy threat on top of the wave curve (data/voltages.ts)
  // — applied here rather than baked into WaveConfig, since the wave config
  // itself is loadout-agnostic (shared with the headless sim harness).
  const hp = baseHp * world.loadout.enemyHpMult;
  const damage = baseDamage * world.loadout.enemyDmgMult;

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
    chargeReward: stats.chargePerKill,
    attackCooldown: 0,
    inContact: false,
    dropsGem: entry.dropsGem ?? false,
  };
  world.enemies.push(enemy);
}

/**
 * The only place that decides a wave is over. Regular waves: every spawn
 * dequeued and every enemy dead. Boss waves: the boss specifically is dead
 * (dequeued and gone from `enemies`) — leftover escort mobs, queued or
 * alive, don't hold the wave open; they idle through the clear pause and
 * carry into the next wave instead of being discarded.
 */
export function isWaveCleared(world: WorldState): boolean {
  if (world.isBossWave) {
    return !world.bossPending && !world.enemies.some((e) => e.isBoss);
  }
  return world.spawnQueue.length === 0 && world.enemies.length === 0;
}

export function isBossWaveNumber(wave: number): boolean {
  return isBossWave(wave);
}
