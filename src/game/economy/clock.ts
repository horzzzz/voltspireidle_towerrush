/**
 * Real-time clock for everything outside a run: daily reward, daily/weekly
 * missions, the wheel's cooldown. The original learned this the hard way —
 * anything keyed off *game* time gets farmed at high speed multipliers (a
 * 15-gem daily every 20 real seconds at x28); see voltspire-original-teardown
 * memory's "Чему научили полтора месяца патчей" → "Эксплойты". So nothing
 * here ever reads `world.time` — only `Date.now()`, guarded by a persisted
 * high-water mark against the player winding their system clock back
 * (`daily_reward_clock_high_water` in the original's save).
 */

/** Clamps `Date.now()` to never regress below the last time we've seen. */
export function effectiveNow(clockHighWater: number): number {
  return Math.max(Date.now(), clockHighWater);
}

/** UTC calendar-day key, e.g. "2026-09-02" — stable across timezone-less comparisons. */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** ISO-8601 week key, e.g. "2026-W36". Weeks run Monday–Sunday. */
export function weekKey(ts: number): string {
  const date = new Date(Date.UTC(new Date(ts).getUTCFullYear(), new Date(ts).getUTCMonth(), new Date(ts).getUTCDate()));
  // ISO week: Thursday of the same week determines the week-numbering year.
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Whole days between two calendar-day keys (both "YYYY-MM-DD"), can be negative. */
export function daysBetweenKeys(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / 86400000);
}
