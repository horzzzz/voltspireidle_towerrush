/**
 * Daily login reward. Per-user direction: every day pays gems only (the
 * original's day-3 "tool" and day-5 "power cell" icons map to currencies
 * this game doesn't have — see voltspire-original-teardown memory — so both
 * are folded into gems), on a rising 7-day curve. Day 8 and beyond keep
 * paying the day-7 amount and the cycle does NOT reset back to day 1 — the
 * counter just keeps climbing, it only ever plateaus.
 */
export const DAILY_REWARD_GEMS = [5, 8, 12, 15, 20, 25, 40];

/** Gems for `day` (1-indexed). Days past the curve's length pay the last value. */
export function dailyRewardForDay(day: number): number {
  const index = Math.min(day, DAILY_REWARD_GEMS.length) - 1;
  return DAILY_REWARD_GEMS[Math.max(0, index)];
}
