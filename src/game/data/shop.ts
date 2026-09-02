/** Shop catalog — scrap packs sold for gems (soft currency, not IAP; see
 * voltspire-tech-stack memory's "РЕШЕНИЕ: доната/IAP не будет"). */
export interface ScrapPack {
  scrap: number;
  gems: number;
}

export const SCRAP_PACKS: ScrapPack[] = [
  { scrap: 25, gems: 10 },
  { scrap: 50, gems: 18 },
  { scrap: 100, gems: 30 },
];

/** Daily rewarded-video gem gift (Shop "Daily" tab) — inert until ads are wired up. */
export const SHOP_DAILY_GIFT_GEMS = 10;
