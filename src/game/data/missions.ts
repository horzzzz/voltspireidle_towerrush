/**
 * Daily/weekly missions. The original runs 7 dailies at once, each worth a
 * flat 3 gems + 20 scrap (see voltspire-original-teardown memory) — kept as
 * one constant so trimming back to the Figma mock's 5 is a one-line change.
 * Weekly ladder rewards are this port's own numbers (medals/capacitors from
 * the original don't exist here — see voltspire-tech-stack memory's
 * "РЕШЕНИЕ: медалей и конденсаторов не будет", folded into scrap+gems).
 */
export type MissionType =
  | 'kill_enemies'
  | 'clear_waves'
  | 'kill_bosses'
  | 'buy_run_upgrades'
  | 'buy_coilworks'
  | 'collect_gems'
  | 'reach_wave';

export interface MissionTemplate {
  type: MissionType;
  /** Candidate targets — one is picked per roll so difficulty varies day to day. */
  targets: number[];
  label: (target: number) => string;
}

export const DAILY_MISSION_COUNT = 7;
export const DAILY_MISSION_REWARD = { gems: 3, scrap: 20 };

export const MISSION_TEMPLATES: MissionTemplate[] = [
  { type: 'kill_enemies', targets: [20, 40, 60], label: (t) => `Kill ${t} enemies` },
  { type: 'clear_waves', targets: [3, 5, 8], label: (t) => `Clear ${t} waves` },
  { type: 'kill_bosses', targets: [1, 2, 3], label: (t) => `Kill ${t} bosses` },
  { type: 'buy_run_upgrades', targets: [5, 8, 12], label: (t) => `Buy ${t} battle upgrades` },
  { type: 'buy_coilworks', targets: [3, 5, 8], label: (t) => `Buy ${t} coilworks` },
  { type: 'collect_gems', targets: [3, 5, 8], label: (t) => `Collect ${t} floating gems` },
  { type: 'reach_wave', targets: [10, 15, 20], label: (t) => `Reach wave ${t}` },
];

const TEMPLATE_BY_TYPE: Record<MissionType, MissionTemplate> = Object.fromEntries(
  MISSION_TEMPLATES.map((t) => [t.type, t]),
) as Record<MissionType, MissionTemplate>;

export function missionLabel(type: MissionType, target: number): string {
  return TEMPLATE_BY_TYPE[type].label(target);
}

export interface WeeklyTier {
  completions: number;
  reward: { gems: number; scrap: number };
}

export const WEEKLY_LADDER: WeeklyTier[] = [
  { completions: 5, reward: { gems: 10, scrap: 40 } },
  { completions: 10, reward: { gems: 15, scrap: 60 } },
  { completions: 15, reward: { gems: 20, scrap: 90 } },
  { completions: 20, reward: { gems: 25, scrap: 120 } },
  { completions: 25, reward: { gems: 30, scrap: 160 } },
  { completions: 35, reward: { gems: 40, scrap: 220 } },
  { completions: 40, reward: { gems: 50, scrap: 300 } },
];
