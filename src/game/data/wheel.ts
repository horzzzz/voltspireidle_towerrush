/**
 * Wheel of Luck. Sector order is read straight off `sectors.png` clockwise
 * from the pointer at 12 o'clock — see `luck-wheel.tsx`, which only rotates
 * that baked image, so this order must exactly match the art or the payout
 * will land on the wrong wedge. Weights are this port's own numbers (the
 * original's wheel isn't in the confirmed-numbers teardown).
 */
export type WheelPrizeKind = 'gems' | 'scrap' | 'fail' | 'free_spin';

export interface WheelSector {
  kind: WheelPrizeKind;
  amount: number;
  weight: number;
}

/** 8 equal 45°-wide sectors, clockwise starting at the pointer (index 0 = top). */
export const WHEEL_SECTORS: WheelSector[] = [
  { kind: 'gems', amount: 10, weight: 20 },
  { kind: 'gems', amount: 15, weight: 12 },
  { kind: 'fail', amount: 0, weight: 18 },
  { kind: 'scrap', amount: 50, weight: 15 },
  { kind: 'free_spin', amount: 1, weight: 5 },
  { kind: 'gems', amount: 20, weight: 8 },
  { kind: 'fail', amount: 0, weight: 18 },
  { kind: 'scrap', amount: 100, weight: 4 },
];

export const WHEEL_SECTOR_DEGREES = 360 / WHEEL_SECTORS.length;
export const WHEEL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Picks a sector index by weight. `spinWheel` passes a seeded `Rng` (the same
 * way `pullChip` does) rather than the default `Math.random`, because a Hermes
 * cold start hands out a fixed first `Math.random()` value — which made every
 * fresh install's first spin land on the same (FAIL) wedge.
 */
export function rollWheelIndex(random: () => number = Math.random): number {
  const total = WHEEL_SECTORS.reduce((sum, s) => sum + s.weight, 0);
  let roll = random() * total;
  for (let i = 0; i < WHEEL_SECTORS.length; i++) {
    if (roll < WHEEL_SECTORS[i].weight) return i;
    roll -= WHEEL_SECTORS[i].weight;
  }
  return WHEEL_SECTORS.length - 1;
}
