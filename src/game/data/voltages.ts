/**
 * Difficulty tiers. The original ships 21 (see voltspire-original-teardown
 * memory); this port ships 3 for now — each one unlocks by reaching wave 100
 * on the previous tier, same as the original's own Voltage-2 gate. Extending
 * the array later is the whole story: nothing else hardcodes a tier count.
 */
export interface VoltageDef {
  tier: number;
  name: string;
  /** Multiplies every scrap reward (wave clear + milestones) earned on this tier. */
  scrapMult: number;
  /** Multiplies enemy HP on this tier, on top of the wave curve. */
  enemyHpMult: number;
  /** Multiplies enemy contact damage on this tier, on top of the wave curve. */
  enemyDmgMult: number;
  /** Highest wave reached on the *previous* tier required to unlock this one. */
  unlockAtPrevWave: number;
}

export const VOLTAGES: VoltageDef[] = [
  { tier: 1, name: 'Voltage 1', scrapMult: 1, enemyHpMult: 1, enemyDmgMult: 1, unlockAtPrevWave: 0 },
  { tier: 2, name: 'Voltage 2', scrapMult: 6, enemyHpMult: 10, enemyDmgMult: 3, unlockAtPrevWave: 100 },
  { tier: 3, name: 'Voltage 3', scrapMult: 36, enemyHpMult: 100, enemyDmgMult: 9, unlockAtPrevWave: 100 },
];

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
