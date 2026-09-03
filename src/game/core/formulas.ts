/**
 * Port of the original's `formulas.gd` (Voltspire 1.9.0) — every gameplay
 * number in this port flows through here, so a curve can be checked against
 * the source function by name rather than by feel.
 *
 * Deliberately dependency-light: only `data/balance.ts` (the constants) is
 * imported, and nothing from React/RN/Skia — the same reason `core/*` stays
 * runnable headless in `scripts/battle-sim.ts` and `scripts/balance-check.ts`.
 *
 * Upgrade defs are passed in as plain shapes, not as the def objects from
 * `data/coilworks.ts` / `data/tower-stats.ts`, so those data modules can
 * import this one without a cycle.
 */

import {
  BOSS_CHARGE_MULTIPLIER,
  BOSS_SCRAP_MULTIPLIER,
  BOSS_WAVE_INTERVAL,
  CHARGE_BASE_REWARD,
  CHARGE_INCOME_EXPONENT,
  ENEMY_CONTACT_DAMAGE_BASE,
  ENEMY_CONTACT_DAMAGE_GROWTH,
  ENEMY_HP_CONSTANT,
  ENEMY_HP_LINEAR_COEFFICIENT,
  ENEMY_HP_POLY_COEFFICIENT,
  ENEMY_HP_POLY_EXPONENT,
  ENEMY_HP_SCALE,
  ENEMY_HP_STEP_ADDITIVE_TERMS,
  ENEMY_HP_STEP_GROWTH_TERMS,
  ENEMY_TYPE_MAX_SHARE,
  ENEMY_TYPE_SHARE_RAMP_WAVES,
  SCRAP_WAVE_GROWTH,
  TOWER_INCOMING_DAMAGE_FLOOR_FRACTION,
  VOLTAGE_DMG_MULT_BASE,
  VOLTAGE_HP_LADDER_STEPS,
  VOLTAGE_SCRAP_LADDER_STEPS,
  WAVE_BASE_ENEMY_COUNT,
  WAVE_ENEMY_COUNT_PER_WAVE,
  WAVE_INCOME_REFERENCE_BASE,
  WAVE_INCOME_REFERENCE_PER_WAVE,
} from '../data/balance';

/** `[level, cumulativeMultiplier]` pairs — the original's `value_anchors`. */
export type ValueAnchor = [level: number, multiplier: number];

// --- Enemies --------------------------------------------------------------

/** `enemy_hp_for_wave` — polynomial core, then periodic additive and growth steps. */
export function enemyHpForWave(wave: number, voltage = 1): number {
  const w = Math.max(wave, 1);

  let core = ENEMY_HP_POLY_COEFFICIENT * Math.pow(w, ENEMY_HP_POLY_EXPONENT);
  core += ENEMY_HP_LINEAR_COEFFICIENT * w;
  core += ENEMY_HP_CONSTANT;

  let additive = 1;
  for (const [every, amount] of ENEMY_HP_STEP_ADDITIVE_TERMS) {
    additive += amount * Math.floor(w / every);
  }

  let result = core * additive * ENEMY_HP_SCALE;
  for (const [every, growth] of ENEMY_HP_STEP_GROWTH_TERMS) {
    const steps = Math.floor(w / every);
    if (steps > 0) result *= Math.pow(growth, steps);
  }

  return result * voltageHpMultiplier(voltage);
}

/** `enemy_contact_damage_for_wave`. */
export function enemyContactDamageForWave(wave: number): number {
  return ENEMY_CONTACT_DAMAGE_BASE * Math.pow(ENEMY_CONTACT_DAMAGE_GROWTH, Math.max(wave, 1) - 1);
}

/** `enemy_count_for_wave`. */
export function enemyCountForWave(wave: number): number {
  return WAVE_BASE_ENEMY_COUNT + Math.floor(wave * WAVE_ENEMY_COUNT_PER_WAVE);
}

/**
 * `enemy_type_share` — a type ramps from 0 to `ENEMY_TYPE_MAX_SHARE` over
 * `ENEMY_TYPE_SHARE_RAMP_WAVES` waves once its `minWave` is reached.
 */
export function enemyTypeShare(wave: number, minWave: number): number {
  if (wave < minWave) return 0;
  const progress = (wave - minWave) / ENEMY_TYPE_SHARE_RAMP_WAVES;
  return Math.min(1, Math.max(0, progress)) * ENEMY_TYPE_MAX_SHARE;
}

export function isBossWave(wave: number): boolean {
  return wave % BOSS_WAVE_INTERVAL === 0;
}

// --- Income ---------------------------------------------------------------

/**
 * `wave_count_income_scale` — per-kill payouts are divided by how many
 * enemies the wave actually holds and multiplied by a reference count, so
 * the *wave total* follows the curve regardless of headcount.
 */
export function waveCountIncomeScale(wave: number): number {
  const referenceCount = WAVE_INCOME_REFERENCE_BASE + Math.floor(wave * WAVE_INCOME_REFERENCE_PER_WAVE);
  const actualCount = enemyCountForWave(wave);
  if (actualCount <= 0) return 1;
  return referenceCount / actualCount;
}

/** `charge_reward_for_wave` — Charge granted per kill at this wave. */
export function chargeRewardForWave(wave: number, isBoss = false): number {
  const w = Math.max(wave, 1);
  const scale = isBoss ? BOSS_CHARGE_MULTIPLIER : waveCountIncomeScale(wave);
  return CHARGE_BASE_REWARD * Math.pow(w, CHARGE_INCOME_EXPONENT) * scale;
}

/** `scrap_reward_for_kill`. `baseScrap` comes from the enemy type. */
export function scrapRewardForKill(baseScrap: number, isBoss: boolean, wave: number): number {
  const base = isBoss ? baseScrap * BOSS_SCRAP_MULTIPLIER : baseScrap;
  const depthFactor = 1 + wave * SCRAP_WAVE_GROWTH;
  const scale = isBoss ? 1 : waveCountIncomeScale(wave);
  return base * depthFactor * scale;
}

// --- Tower ----------------------------------------------------------------

/**
 * `tower_incoming_damage` — flat Armor first, then Deflection as a fraction,
 * with a floor at `TOWER_INCOMING_DAMAGE_FLOOR_FRACTION` of the raw hit.
 * Note the order: the floor is applied *after* deflection, so it is the real
 * cap on damage reduction (Deflection itself is never clamped).
 */
export function towerIncomingDamage(raw: number, armor: number, deflection: number): number {
  const afterArmor = Math.max(0, raw - armor);
  const reductionFraction = Math.min(1, Math.max(0, 1 - deflection));
  const reduced = afterArmor * reductionFraction;
  const floorAmount = raw * TOWER_INCOMING_DAMAGE_FLOOR_FRACTION;
  return Math.max(floorAmount, reduced);
}

// --- Voltage --------------------------------------------------------------

function ladderProduct(steps: number[], voltage: number): number {
  if (steps.length === 0 || voltage <= 1) return 1;
  let result = 1;
  for (let i = 0; i < voltage - 1; i++) {
    result *= i < steps.length ? steps[i] : steps[steps.length - 1];
  }
  return result;
}

export function voltageHpMultiplier(voltage: number): number {
  return ladderProduct(VOLTAGE_HP_LADDER_STEPS, voltage);
}

export function voltageScrapMultiplier(voltage: number): number {
  return ladderProduct(VOLTAGE_SCRAP_LADDER_STEPS, voltage);
}

export function voltageDmgMultiplier(voltage: number): number {
  return Math.pow(VOLTAGE_DMG_MULT_BASE, voltage - 1);
}

// --- Upgrade curves -------------------------------------------------------

/**
 * `coilworks_value_multiplier` — the cumulative multiplier at `level`, walking
 * the anchor list and compounding each segment's own per-level growth. Between
 * two anchors the growth is geometric: `(b.y / a.y) ^ (1 / (b.x - a.x))`, so
 * levels 0-100 grow ~4.71%/level and 100-1000 only ~0.51%/level. Past the last
 * anchor the final segment's rate simply continues.
 */
export function anchorValueMultiplier(level: number, anchors: ValueAnchor[]): number {
  if (level <= 0 || anchors.length < 2) return 1;

  let result = anchors[0][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [aLevel, aValue] = anchors[i];
    const [bLevel, bValue] = anchors[i + 1];
    const last = i === anchors.length - 2;

    const span = last || level < bLevel ? level - aLevel : bLevel - aLevel;
    if (span <= 0) break;

    const growth = Math.pow(bValue / aValue, 1 / (bLevel - aLevel));
    result *= Math.pow(growth, span);
  }
  return result;
}

/**
 * `coilworks_upgrade_cost` for an anchor-curve stat: the price is the value
 * multiplier raised to `costPowerExponent`, so cost and effect are the same
 * curve and "scrap per point of damage" degrades smoothly instead of the two
 * running as independent geometric series.
 */
export function anchorUpgradeCost(
  baseCost: number,
  level: number,
  anchors: ValueAnchor[],
  costPowerExponent: number,
): number {
  return baseCost * Math.pow(anchorValueMultiplier(level, anchors), costPowerExponent);
}

/** `battle_upgrade_cost` / the non-anchor `coilworks_upgrade_cost`. */
export function geometricCost(baseCost: number, growth: number, level: number): number {
  return baseCost * Math.pow(growth, level);
}

// --- HUD ------------------------------------------------------------------

/**
 * `wave_progress_fraction` — the wave bar tracks the phase clock, but during
 * spawning it falls back to "how many actually spawned" whenever the clock
 * has run more than ~1.5 enemies ahead of the spawner (which happens when the
 * on-screen cap holds spawns back).
 */
export function waveProgressFraction(
  isSpawning: boolean,
  phaseTimeLeft: number,
  spawnDuration: number,
  cooldownDuration: number,
  waveSpawnTotal: number,
  enemiesLeftToSpawn: number,
): number {
  const total = spawnDuration + cooldownDuration;
  if (total <= 0) return 0;

  if (isSpawning) {
    let clockProgress = 1;
    if (spawnDuration > 0) {
      clockProgress = Math.min(1, Math.max(0, (spawnDuration - phaseTimeLeft) / spawnDuration));
    }
    let spawnFrac = clockProgress;
    if (waveSpawnTotal > 0) {
      const spawned = waveSpawnTotal - enemiesLeftToSpawn;
      const spawnProgress = Math.min(1, Math.max(0, spawned / waveSpawnTotal));
      if (clockProgress - spawnProgress > 1.5 / waveSpawnTotal) spawnFrac = spawnProgress;
    }
    return Math.min(1, Math.max(0, (spawnDuration / total) * spawnFrac));
  }

  const elapsed = spawnDuration + (cooldownDuration - phaseTimeLeft);
  return Math.min(1, Math.max(0, elapsed / total));
}
