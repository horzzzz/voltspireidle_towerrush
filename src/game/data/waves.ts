/**
 * Per-wave scaling. Numbers below are a first pass, not the original's
 * (see voltspire-original-teardown memory for its confirmed early-game
 * figures) — tune via `npm run sim` once the loop is playable.
 */
export interface WaveConfig {
  wave: number;
  isBoss: boolean;
  enemyCount: number;
  /** Base HP/speed/damage before the per-kind profile multiplier is applied. */
  enemyHp: number;
  enemySpeed: number;
  enemyDamage: number;
  chargePerKill: number;
  /** Scrap banked once every enemy in the wave is dead. */
  scrapReward: number;
}

const ENEMY_SPEED_CAP = 96;

const BOSS_HP_MULT = 12;
/** Still clearly slower than a base-speed enemy — "always slow", just not crawling. */
const BOSS_SPEED_MULT = 0.6;
const BOSS_DAMAGE_MULT = 3;
const BOSS_CHARGE_MULT = 5;
const BOSS_SCRAP_MULT = 10;

/** Regular escorts alongside the boss: half the wave's usual headcount, floor 3. */
const BOSS_ESCORT_RATIO = 0.5;
const BOSS_ESCORT_MIN = 3;

export function isBossWave(wave: number): boolean {
  return wave % 10 === 0;
}

/**
 * Stats a *regular* enemy would have on this wave number, boss wave or not.
 * The boss wave's escort mobs are spawned with these — never the boss's own
 * inflated numbers — so getWaveConfig's boss branch derives from this rather
 * than duplicating the base formulas.
 */
export function getBaseWaveConfig(wave: number): WaveConfig {
  return {
    wave,
    isBoss: false,
    enemyCount: 5 + Math.floor(wave * 1.2),
    enemyHp: 10 * Math.pow(1.18, wave - 1),
    enemySpeed: Math.min(ENEMY_SPEED_CAP, 18 + wave * 0.15),
    enemyDamage: 2 * Math.pow(1.12, wave - 1),
    chargePerKill: 2 + Math.floor(wave / 3),
    scrapReward: 1 + Math.floor(wave / 2),
  };
}

export function bossEscortCount(wave: number): number {
  return Math.max(BOSS_ESCORT_MIN, Math.round(getBaseWaveConfig(wave).enemyCount * BOSS_ESCORT_RATIO));
}

export function getWaveConfig(wave: number): WaveConfig {
  const base = getBaseWaveConfig(wave);
  if (!isBossWave(wave)) return base;

  return {
    ...base,
    isBoss: true,
    // Total headcount this wave will spawn (boss + escorts) — the HUD's
    // wave-progress total, not what actually gates clearing (see spawn.ts).
    enemyCount: 1 + bossEscortCount(wave),
    enemyHp: base.enemyHp * BOSS_HP_MULT,
    enemySpeed: base.enemySpeed * BOSS_SPEED_MULT,
    enemyDamage: base.enemyDamage * BOSS_DAMAGE_MULT,
    chargePerKill: base.chargePerKill * BOSS_CHARGE_MULT,
    scrapReward: base.scrapReward * BOSS_SCRAP_MULT,
  };
}
