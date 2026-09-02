/**
 * Wave milestones — a battle-pass-shaped free track (no premium column, see
 * voltspire-tech-stack memory §"РЕШЕНИЕ: доната/IAP не будет"). Base rewards
 * are the original's confirmed Voltage-1 numbers (voltspire-original-teardown
 * memory); every tier above 1 scales scrap by that tier's `scrapMult`
 * (data/voltages.ts) — otherwise a fixed table reads as worthless once the
 * player is earning tier-2/3 scrap.
 */
export interface MilestoneDef {
  wave: number;
  scrap: number;
  gems: number;
}

export const MILESTONES: MilestoneDef[] = [
  { wave: 10, scrap: 2, gems: 1 },
  { wave: 20, scrap: 8, gems: 1 },
  { wave: 30, scrap: 14, gems: 1 },
  { wave: 40, scrap: 20, gems: 2 },
  { wave: 50, scrap: 28, gems: 3 },
  { wave: 60, scrap: 38, gems: 3 },
  { wave: 70, scrap: 46, gems: 4 },
  { wave: 80, scrap: 58, gems: 5 },
  { wave: 90, scrap: 68, gems: 5 },
  { wave: 100, scrap: 80, gems: 6 },
  { wave: 150, scrap: 92, gems: 7 },
  { wave: 200, scrap: 120, gems: 10 },
];

/** Stable key for the persisted claimed-set: "<tier>:<wave>". */
export function milestoneKey(tier: number, wave: number): string {
  return `${tier}:${wave}`;
}
