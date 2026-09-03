/**
 * Difficulty tiers. The original ships 21; this port ships 3, but the
 * multipliers are its own ladders (`voltage_hp_ladder_steps`,
 * `voltage_scrap_ladder_steps`, `voltage_dmg_mult_base`) evaluated by
 * `core/formulas.ts`, so extending the list later needs no new numbers —
 * only more entries.
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

const TIER_COUNT = 3;
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

/** Whether `tier` is playable given each tier's highest wave reached so far. */
export function isVoltageUnlocked(tier: number, highestWaveByVoltage: Record<number, number>): boolean {
  const def = VOLTAGES.find((v) => v.tier === tier);
  if (!def) return false;
  if (def.unlockAtPrevWave === 0) return true;
  return (highestWaveByVoltage[tier - 1] ?? 0) >= def.unlockAtPrevWave;
}
