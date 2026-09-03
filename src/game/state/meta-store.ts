import { Storage } from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { dayKey, effectiveNow, weekKey } from '../economy/clock';
import { applyRunToMissions, incrementMissionProgress, rollDailyMissions, type MissionInstance } from '../economy/missions';
import {
  COILWORKS_DEFS,
  COILWORKS_UNLOCKS,
  coilworksCost,
  createInitialCoilworksLevels,
  createInitialCoilworksUnlocked,
  isCoilworksAvailable,
  isCoilworksMaxed,
  type CoilworksUnlockId,
  type CoilworksUpgradeId,
} from '../data/coilworks';
import { DAILY_MISSION_COUNT, DAILY_MISSION_REWARD, WEEKLY_LADDER } from '../data/missions';
import { dailyRewardForDay } from '../data/daily';
import { MILESTONES, milestoneKey } from '../data/milestones';
import { getVoltage, isVoltageUnlocked } from '../data/voltages';
import { WHEEL_COOLDOWN_MS, WHEEL_SECTORS, rollWheelIndex, type WheelSector } from '../data/wheel';
import type { RunSummary } from '../core/types';

/** Thin sync adapter — `expo-sqlite/kv-store` is a drop-in AsyncStorage
 * replacement but also exposes sync methods, which keep zustand's persist
 * hydration simple (no loading-state dance for a couple of small numbers). */
const sqliteStateStorage: StateStorage = {
  getItem: (name) => Storage.getItemSync(name),
  setItem: (name, value) => Storage.setItemSync(name, value),
  removeItem: (name) => Storage.removeItemSync(name),
};

interface DailyRewardState {
  day: number;
  /** Calendar-day key (economy/clock.dayKey) of the last successful claim, or null before the first. */
  lastClaimKey: string | null;
}

interface MissionsState {
  dayKey: string;
  list: MissionInstance[];
  weekKey: string;
  weeklyCompletions: number;
  /** Ladder tiers already paid out this week — indices into data/missions.WEEKLY_LADDER. */
  weeklyClaimed: number[];
}

interface WheelState {
  lastSpinAt: number;
  freeSpins: number;
}

export interface WheelSpinResult {
  sectorIndex: number;
  sector: WheelSector;
}

interface MetaState {
  scrap: number;
  gems: number;
  /** Tier selected for the next run — see data/voltages.ts. */
  voltage: number;
  highestWaveByVoltage: Record<number, number>;
  /** Best scrap/hour seen on a finished run, per tier — hub "Scrap/hr" stat only, no offline income. */
  bestScrapPerHourByVoltage: Record<number, number>;
  coilworks: Record<CoilworksUpgradeId, number>;
  coilworksUnlocked: Record<CoilworksUnlockId, boolean>;
  /** Claimed milestone keys, "<tier>:<wave>" — see data/milestones.milestoneKey. */
  milestonesClaimed: Record<string, true>;
  daily: DailyRewardState;
  missions: MissionsState;
  wheel: WheelState;
  /** Clamps Date.now() against clock rollback — see economy/clock.effectiveNow. */
  clockHighWater: number;

  /** Folds a finished run's earnings into the persisted totals. */
  bankRun: (summary: RunSummary) => void;
  buyCoilworks: (id: CoilworksUpgradeId) => boolean;
  unlockCoilworks: (id: CoilworksUnlockId) => boolean;
  claimMilestone: (tier: number, wave: number) => boolean;
  ensureMissionsForToday: () => void;
  claimMission: (id: string) => boolean;
  claimWeeklyTier: (tierIndex: number) => boolean;
  claimDaily: () => boolean;
  spinWheel: () => WheelSpinResult | null;
  selectVoltage: (tier: number) => boolean;
  /**
   * Spend `gemCost` gems to bank `scrapAmount` scrap (shop catalog).
   * No-op returning `false` when the player can't afford it.
   */
  buyScrap: (gemCost: number, scrapAmount: number) => boolean;
}

function nowClamped(state: MetaState): number {
  return effectiveNow(state.clockHighWater);
}

/** Advances `clockHighWater` alongside any action that reads the clock, so a later rollback can't replay it. */
function withClockAdvance(now: number) {
  return { clockHighWater: now };
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      scrap: 0,
      gems: 0,
      voltage: 1,
      highestWaveByVoltage: {},
      bestScrapPerHourByVoltage: {},
      coilworks: createInitialCoilworksLevels(),
      coilworksUnlocked: createInitialCoilworksUnlocked(),
      milestonesClaimed: {},
      daily: { day: 1, lastClaimKey: null },
      missions: { dayKey: '', list: [], weekKey: '', weeklyCompletions: 0, weeklyClaimed: [] },
      wheel: { lastSpinAt: 0, freeSpins: 0 },
      clockHighWater: 0,

      bankRun: (summary) => {
        const state = get();
        const now = nowClamped(state);
        const tier = summary.voltageTier;
        const scrapPerHour = summary.timeSurvived > 0 ? (summary.scrapEarned / summary.timeSurvived) * 3600 : 0;

        set((s) => ({
          ...withClockAdvance(now),
          scrap: s.scrap + summary.scrapEarned,
          gems: s.gems + summary.gemsCollected,
          highestWaveByVoltage: {
            ...s.highestWaveByVoltage,
            [tier]: Math.max(s.highestWaveByVoltage[tier] ?? 0, summary.waveReached),
          },
          bestScrapPerHourByVoltage: {
            ...s.bestScrapPerHourByVoltage,
            [tier]: Math.max(s.bestScrapPerHourByVoltage[tier] ?? 0, scrapPerHour),
          },
          missions: { ...s.missions, list: applyRunToMissions(s.missions.list, summary) },
        }));
      },

      buyCoilworks: (id) => {
        const state = get();
        const def = COILWORKS_DEFS[id];
        if (!isCoilworksAvailable(def, state.coilworksUnlocked)) return false;
        const level = state.coilworks[id];
        if (isCoilworksMaxed(def, level)) return false;
        const cost = coilworksCost(def, level);
        if (state.scrap < cost) return false;
        set((s) => ({
          scrap: s.scrap - cost,
          coilworks: { ...s.coilworks, [id]: level + 1 },
          missions: { ...s.missions, list: incrementMissionProgress(s.missions.list, 'buy_coilworks', 1) },
        }));
        return true;
      },

      // One unlock can reveal several branches at once — "Unlock defense
      // upgrades" opens Health, Regen and Deflection together, which is why
      // this is keyed by unlock id rather than by branch.
      unlockCoilworks: (id) => {
        const state = get();
        const unlock = COILWORKS_UNLOCKS[id];
        if (!unlock || state.coilworksUnlocked[id]) return false;
        if (state.scrap < unlock.cost) return false;
        set((s) => ({ scrap: s.scrap - unlock.cost, coilworksUnlocked: { ...s.coilworksUnlocked, [id]: true } }));
        return true;
      },

      claimMilestone: (tier, wave) => {
        const state = get();
        const key = milestoneKey(tier, wave);
        if (state.milestonesClaimed[key]) return false;
        if ((state.highestWaveByVoltage[tier] ?? 0) < wave) return false;
        const def = MILESTONES.find((m) => m.wave === wave);
        if (!def) return false;
        const scrapMult = getVoltage(tier).scrapMult;
        set((s) => ({
          scrap: s.scrap + def.scrap * scrapMult,
          gems: s.gems + def.gems,
          milestonesClaimed: { ...s.milestonesClaimed, [key]: true },
        }));
        return true;
      },

      ensureMissionsForToday: () => {
        const state = get();
        const now = nowClamped(state);
        const today = dayKey(now);
        const thisWeek = weekKey(now);
        if (state.missions.dayKey === today && state.missions.weekKey === thisWeek) return;

        set((s) => {
          const rolledToday = s.missions.dayKey === today ? s.missions.list : rollDailyMissions(today, DAILY_MISSION_COUNT);
          const weekChanged = s.missions.weekKey !== thisWeek;
          return {
            ...withClockAdvance(now),
            missions: {
              dayKey: today,
              list: rolledToday,
              weekKey: thisWeek,
              weeklyCompletions: weekChanged ? 0 : s.missions.weeklyCompletions,
              weeklyClaimed: weekChanged ? [] : s.missions.weeklyClaimed,
            },
          };
        });
      },

      // "Weekly completions" = daily missions claimed this week, one per
      // claim — the original's own weekly challenge isn't documented in
      // enough detail to know what it counts (see voltspire-original-teardown
      // memory), so this is this port's own reading of "completion".
      claimMission: (id) => {
        const state = get();
        const mission = state.missions.list.find((m) => m.id === id);
        if (!mission || mission.claimed || mission.current < mission.target) return false;
        set((s) => ({
          scrap: s.scrap + DAILY_MISSION_REWARD.scrap,
          gems: s.gems + DAILY_MISSION_REWARD.gems,
          missions: {
            ...s.missions,
            list: s.missions.list.map((m) => (m.id === id ? { ...m, claimed: true } : m)),
            weeklyCompletions: s.missions.weeklyCompletions + 1,
          },
        }));
        return true;
      },

      claimWeeklyTier: (tierIndex) => {
        const state = get();
        const tier = WEEKLY_LADDER[tierIndex];
        if (!tier) return false;
        if (state.missions.weeklyCompletions < tier.completions) return false;
        if (state.missions.weeklyClaimed.includes(tierIndex)) return false;
        set((s) => ({
          scrap: s.scrap + tier.reward.scrap,
          gems: s.gems + tier.reward.gems,
          missions: { ...s.missions, weeklyClaimed: [...s.missions.weeklyClaimed, tierIndex] },
        }));
        return true;
      },

      claimDaily: () => {
        const state = get();
        const now = nowClamped(state);
        const today = dayKey(now);
        if (state.daily.lastClaimKey === today) return false;

        const yesterday = dayKey(now - 24 * 60 * 60 * 1000);
        const nextDay = state.daily.lastClaimKey === yesterday ? state.daily.day + 1 : 1;
        const reward = dailyRewardForDay(nextDay);

        set(() => ({
          ...withClockAdvance(now),
          gems: get().gems + reward,
          daily: { day: nextDay, lastClaimKey: today },
        }));
        return true;
      },

      spinWheel: () => {
        const state = get();
        const now = nowClamped(state);
        const usingFreeSpin = state.wheel.freeSpins > 0;
        if (!usingFreeSpin && now - state.wheel.lastSpinAt < WHEEL_COOLDOWN_MS) return null;

        const sectorIndex = rollWheelIndex();
        const sector = WHEEL_SECTORS[sectorIndex];

        set((s) => ({
          ...withClockAdvance(now),
          scrap: sector.kind === 'scrap' ? s.scrap + sector.amount : s.scrap,
          gems: sector.kind === 'gems' ? s.gems + sector.amount : s.gems,
          wheel: {
            lastSpinAt: usingFreeSpin ? s.wheel.lastSpinAt : now,
            freeSpins: (usingFreeSpin ? s.wheel.freeSpins - 1 : s.wheel.freeSpins) + (sector.kind === 'free_spin' ? sector.amount : 0),
          },
        }));
        return { sectorIndex, sector };
      },

      selectVoltage: (tier) => {
        const state = get();
        if (!isVoltageUnlocked(tier, state.highestWaveByVoltage)) return false;
        set({ voltage: tier });
        return true;
      },

      buyScrap: (gemCost, scrapAmount) => {
        if (get().gems < gemCost) return false;
        set((s) => ({ gems: s.gems - gemCost, scrap: s.scrap + scrapAmount }));
        return true;
      },
    }),
    {
      name: 'voltspire-meta',
      version: 3,
      storage: createJSONStorage(() => sqliteStateStorage),
      // v1 only had {scrap, gems, highestWave}. v2 fanned that out per-Voltage
      // and added the rest of the economy. v3 reworked Coilworks to the
      // original's own branch set and its group-based unlocks, so levels and
      // unlock flags can't carry over field-for-field — currencies, wave
      // records and every other system do.
      migrate: (persisted) => {
        const old = persisted as
          | { scrap?: number; gems?: number; highestWave?: number; highestWaveByVoltage?: Record<number, number> }
          | undefined;
        return {
          ...(persisted as object),
          scrap: old?.scrap ?? 0,
          gems: old?.gems ?? 0,
          voltage: 1,
          highestWaveByVoltage: old?.highestWaveByVoltage ?? (old?.highestWave ? { 1: old.highestWave } : {}),
          coilworks: createInitialCoilworksLevels(),
          coilworksUnlocked: createInitialCoilworksUnlocked(),
        };
      },
    },
  ),
);
