/**
 * Difficulty tiers — 21, matching the original. The multipliers are its own
 * ladders (`voltage_hp_ladder_steps`, `voltage_scrap_ladder_steps`,
 * `voltage_dmg_mult_base`) evaluated by `core/formulas.ts`; only the first 9
 * steps are the source's confirmed numbers, tiers 10+ extrapolate by repeating
 * the last step (see `voltspire-pck-extraction` memory for the exact table).
 */

import { voltageDmgMultiplier, voltageHpMultiplier, voltageScrapMultiplier } from '../core/formulas';

export interface VoltageDef {
  tier: number;
  name: string;
  /** Multiplies every scrap reward (kills, wave payouts, milestones) on this tier. */
  scrapMult: number;
  /** Multiplies enemy HP on this tier, on top of the wave curve. */
  enemyHpMult: number;
  /** Multiplies enemy contact damage on this tier, on top of the wave curve. */
  enemyDmgMult: number;
  /** Highest wave reached on the *previous* tier required to unlock this one. */
  unlockAtPrevWave: number;
}

/** The original ships 21 tiers. Steps 10+ reuse the last ladder entry (see
 * balance.ts `VOLTAGE_*_LADDER_STEPS`) — an extrapolation, not the source's
 * exact numbers (see `voltspire-pck-extraction` memory to pull those). */
const TIER_COUNT = 21;
/** Wave 100 on the previous tier, the same gate the original puts on Voltage 2. */
const UNLOCK_WAVE = 100;

export const VOLTAGES: VoltageDef[] = Array.from({ length: TIER_COUNT }, (_, i) => {
  const tier = i + 1;
  return {
    tier,
    name: `Voltage ${tier}`,
    scrapMult: voltageScrapMultiplier(tier),
    enemyHpMult: voltageHpMultiplier(tier),
    enemyDmgMult: voltageDmgMultiplier(tier),
    unlockAtPrevWave: tier === 1 ? 0 : UNLOCK_WAVE,
  };
});

export function getVoltage(tier: number): VoltageDef {
  return VOLTAGES.find((v) => v.tier === tier) ?? VOLTAGES[0];
}

/**
 * What unlocking `tier` requires: reaching wave `wave` on tier `prevTier`.
 * `null` when the tier is always open (tier 1) or doesn't exist.
 */
export function voltageUnlockRequirement(tier: number): { prevTier: number; wave: number } | null {
  const def = VOLTAGES.find((v) => v.tier === tier);
  if (!def || def.unlockAtPrevWave === 0) return null;
  return { prevTier: tier - 1, wave: def.unlockAtPrevWave };
}

/** Whether `tier` is playable given each tier's highest wave reached so far. */
export function isVoltageUnlocked(tier: number, highestWaveByVoltage: Record<number, number>): boolean {
  const def = VOLTAGES.find((v) => v.tier === tier);
  if (!def) return false;
  if (def.unlockAtPrevWave === 0) return true;
  return (highestWaveByVoltage[tier - 1] ?? 0) >= def.unlockAtPrevWave;
}
