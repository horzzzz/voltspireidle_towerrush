/** A payout of the two meta currencies — the shape every reward source (milestones,
 * missions, daily login, wheel) produces, so `meta-store` has one place that applies it. */
export interface Reward {
  scrap: number;
  gems: number;
}

export function combineRewards(a: Reward, b: Reward): Reward {
  return { scrap: a.scrap + b.scrap, gems: a.gems + b.gems };
}
