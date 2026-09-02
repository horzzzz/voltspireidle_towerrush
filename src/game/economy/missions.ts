import { Rng } from '../core/rng';
import { DAILY_MISSION_COUNT, MISSION_TEMPLATES, type MissionType } from '../data/missions';

export interface MissionInstance {
  id: string;
  type: MissionType;
  target: number;
  current: number;
  claimed: boolean;
}

/** Deterministic string -> seed, so the same dayKey always rolls the same missions. */
function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Picks `count` distinct templates and one target each for `dayKey`. Same
 * key always reproduces the same list — the "day" is the source of
 * randomness, not wall-clock jitter, so a reload never re-rolls it.
 */
export function rollDailyMissions(dayKey: string, count: number = DAILY_MISSION_COUNT): MissionInstance[] {
  const rng = new Rng(hashSeed(dayKey));
  const pool = [...MISSION_TEMPLATES];
  const picked: MissionInstance[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = rng.int(0, pool.length);
    const template = pool.splice(idx, 1)[0];
    const target = rng.pick(template.targets);
    picked.push({ id: `${dayKey}-${template.type}`, type: template.type, target, current: 0, claimed: false });
  }
  return picked;
}

/** Types whose progress tracks a running total across the day (as opposed to a peak). */
const SUM_TYPES: MissionType[] = [
  'kill_enemies',
  'clear_waves',
  'kill_bosses',
  'buy_run_upgrades',
  'buy_coilworks',
  'collect_gems',
];

/** Bumps every mission of `type` by `amount` (sum types) or to `max(current, amount)` (reach_wave). */
export function incrementMissionProgress(
  list: MissionInstance[],
  type: MissionType,
  amount: number,
): MissionInstance[] {
  if (amount <= 0) return list;
  return list.map((m) => {
    if (m.type !== type || m.claimed) return m;
    const current = SUM_TYPES.includes(type) ? Math.min(m.target, m.current + amount) : Math.max(m.current, Math.min(m.target, amount));
    return { ...m, current };
  });
}

export interface RunMissionSummary {
  killCount: number;
  wavesCleared: number;
  bossKills: number;
  gemsCollected: number;
  waveReached: number;
  upgradesBought: number;
}

/** Folds one finished run's counters into the day's mission progress. */
export function applyRunToMissions(list: MissionInstance[], summary: RunMissionSummary): MissionInstance[] {
  let next = list;
  next = incrementMissionProgress(next, 'kill_enemies', summary.killCount);
  next = incrementMissionProgress(next, 'clear_waves', summary.wavesCleared);
  next = incrementMissionProgress(next, 'kill_bosses', summary.bossKills);
  next = incrementMissionProgress(next, 'collect_gems', summary.gemsCollected);
  next = incrementMissionProgress(next, 'reach_wave', summary.waveReached);
  next = incrementMissionProgress(next, 'buy_run_upgrades', summary.upgradesBought);
  return next;
}
