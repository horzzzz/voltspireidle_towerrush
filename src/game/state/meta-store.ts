import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
import {
  CHIP_BY_ID,
  CHIP_LEVEL_UP_GEMS,
  CHIP_MAX_LEVEL,
  CHIP_PULL_COST,
  nextSocketCost,
  rollChipId,
} from '../data/chips';
import { DAILY_MISSION_COUNT, DAILY_MISSION_REWARD, WEEKLY_LADDER } from '../data/missions';
import { dailyRewardForDay } from '../data/daily';
import { MILESTONES, milestoneKey } from '../data/milestones';
import { DEFAULT_SKIN_ID, isSkinUnlocked, SKINS } from '../data/skins';
import { getVoltage, isVoltageUnlocked } from '../data/voltages';
import { RUN_REWARD_MULTIPLIER } from '../data/balance';
import { WHEEL_COOLDOWN_MS, WHEEL_SECTORS, rollWheelIndex, type WheelSector } from '../data/wheel';
import { Rng } from '../core/rng';
import type { RunSummary } from '../core/types';
import { sqliteStateStorage } from './persist-storage';

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

/**
 * The Chips collection — same split as the original's save (`chip_levels`,
 * `chip_copies`, `equipped_chip_ids`): a chip is *owned* once it has a level,
 * and every later copy of it lands in `copies` as a duplicate that can be
 * spent on a level-up.
 */
interface ChipsState {
  /** Owned chips only, 1..CHIP_MAX_LEVEL. Absence = never pulled. */
  levels: Record<string, number>;
  /** Unspent duplicates per chip. */
  copies: Record<string, number>;
  /** Unlocked loadout sockets, 1..CHIP_MAX_SOCKETS. */
  sockets: number;
  /** Equipped chip ids, in socket order; never longer than `sockets`. */
  equipped: string[];
  pulls: number;
  /** Pulls since the last rare — see CHIP_PITY_PULLS. */
  pityCounter: number;
}

function createInitialChipsState(): ChipsState {
  return { levels: {}, copies: {}, sockets: 1, equipped: [], pulls: 0, pityCounter: 0 };
}

export interface ChipPullResult {
  id: string;
  /** False when the pull produced a duplicate of a chip already owned. */
  isNew: boolean;
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
  /** Tower skin worn in battle — see data/skins.ts. Always an unlocked id. */
  selectedSkin: string;
  /** Chips collection + loadout — see data/chips.ts. */
  chips: ChipsState;

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
  /** Pays out the prize from a spin already consumed by `spinWheel` — called once the wheel visually stops. */
  claimWheelReward: (sector: WheelSector) => void;
  selectVoltage: (tier: number) => boolean;
  /** Wear an unlocked skin. No-op returning `false` if it is still locked. */
  selectSkin: (id: string) => boolean;
  /**
   * Spend `gemCost` gems to bank `scrapAmount` scrap (shop catalog).
   * No-op returning `false` when the player can't afford it.
   */
  buyScrap: (gemCost: number, scrapAmount: number) => boolean;

  /** One gacha pull for CHIP_PULL_COST gems. `null` when unaffordable. */
  pullChip: () => ChipPullResult | null;
  /** Spends one duplicate + CHIP_LEVEL_UP_GEMS gems to raise a chip a level. */
  levelUpChip: (id: string) => boolean;
  /** Puts an owned chip into the first free socket. */
  equipChip: (id: string) => boolean;
  unequipChip: (id: string) => boolean;
  /** Buys the next loadout socket — see data/chips.CHIP_SOCKET_COSTS. */
  unlockChipSocket: () => boolean;
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
      selectedSkin: DEFAULT_SKIN_ID,
      chips: createInitialChipsState(),

      bankRun: (summary) => {
        const state = get();
        const now = nowClamped(state);
        const tier = summary.voltageTier;
        const scrapPerHour = summary.timeSurvived > 0 ? (summary.scrapEarned / summary.timeSurvived) * 3600 : 0;

        set((s) => ({
          ...withClockAdvance(now),
          scrap: s.scrap + summary.scrapEarned * RUN_REWARD_MULTIPLIER,
          gems: s.gems + summary.gemsCollected * RUN_REWARD_MULTIPLIER,
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

        // Seeded like `pullChip`, not `Math.random` — a Hermes cold start
        // returns a fixed first `Math.random()`, so every fresh install's first
        // spin rolled the identical (FAIL) index.
        const seed =
          (Date.now() ^ Math.imul(state.wheel.freeSpins + 1, 2654435761) ^ (state.wheel.lastSpinAt | 0)) >>> 0;
        const rng = new Rng(seed);
        const sectorIndex = rollWheelIndex(() => rng.next());
        const sector = WHEEL_SECTORS[sectorIndex];

        // Consumes the spin right away (cooldown reset / one free spin
        // spent), so a second tap can't double-spin — but deliberately does
        // NOT pay out the prize yet, including a won free spin. The wheel
        // screen calls `claimWheelReward` once the wheel has actually
        // stopped, so every part of the reward lands when the player sees
        // the result, not the instant they tap the button.
        set((s) => ({
          ...withClockAdvance(now),
          wheel: {
            lastSpinAt: usingFreeSpin ? s.wheel.lastSpinAt : now,
            freeSpins: usingFreeSpin ? s.wheel.freeSpins - 1 : s.wheel.freeSpins,
          },
        }));
        return { sectorIndex, sector };
      },

      claimWheelReward: (sector) => {
        if (sector.kind === 'fail') return;
        set((s) => ({
          scrap: sector.kind === 'scrap' ? s.scrap + sector.amount : s.scrap,
          gems: sector.kind === 'gems' ? s.gems + sector.amount : s.gems,
          wheel:
            sector.kind === 'free_spin'
              ? { ...s.wheel, freeSpins: s.wheel.freeSpins + sector.amount }
              : s.wheel,
        }));
      },

      selectVoltage: (tier) => {
        const state = get();
        if (!isVoltageUnlocked(tier, state.highestWaveByVoltage)) return false;
        set({ voltage: tier });
        return true;
      },

      selectSkin: (id) => {
        const state = get();
        const skin = SKINS.find((s) => s.id === id);
        if (!skin || !isSkinUnlocked(skin, state.highestWaveByVoltage)) return false;
        set({ selectedSkin: id });
        return true;
      },

      buyScrap: (gemCost, scrapAmount) => {
        if (get().gems < gemCost) return false;
        set((s) => ({ gems: s.gems - gemCost, scrap: s.scrap + scrapAmount }));
        return true;
      },

      // Unlike the daily missions (deterministic from the day key), a pull is
      // meant to be unpredictable, so the seed is wall-clock mixed with the
      // pull counter — two taps in the same millisecond still roll apart.
      pullChip: () => {
        const state = get();
        if (state.gems < CHIP_PULL_COST) return null;

        const rng = new Rng((Date.now() ^ Math.imul(state.chips.pulls + 1, 2654435761)) >>> 0);
        const id = rollChipId(rng, state.chips.pityCounter);
        const isNew = (state.chips.levels[id] ?? 0) === 0;
        const isRare = CHIP_BY_ID[id].rarity === 'rare';

        set((s) => {
          const levels = isNew ? { ...s.chips.levels, [id]: 1 } : s.chips.levels;
          const copies = isNew ? s.chips.copies : { ...s.chips.copies, [id]: (s.chips.copies[id] ?? 0) + 1 };
          // The very first chip goes straight into the empty socket: a first
          // pull that visibly does nothing is the worst possible read of the
          // system. Every later pull is the player's own choice to equip.
          const autoEquip = isNew && s.chips.equipped.length === 0;
          return {
            gems: s.gems - CHIP_PULL_COST,
            chips: {
              ...s.chips,
              levels,
              copies,
              equipped: autoEquip ? [id] : s.chips.equipped,
              pulls: s.chips.pulls + 1,
              pityCounter: isRare ? 0 : s.chips.pityCounter + 1,
            },
          };
        });
        return { id, isNew };
      },

      levelUpChip: (id) => {
        const state = get();
        const level = state.chips.levels[id] ?? 0;
        if (level < 1 || level >= CHIP_MAX_LEVEL) return false;
        if ((state.chips.copies[id] ?? 0) < 1) return false;
        if (state.gems < CHIP_LEVEL_UP_GEMS) return false;

        set((s) => ({
          gems: s.gems - CHIP_LEVEL_UP_GEMS,
          chips: {
            ...s.chips,
            levels: { ...s.chips.levels, [id]: level + 1 },
            copies: { ...s.chips.copies, [id]: (s.chips.copies[id] ?? 0) - 1 },
          },
        }));
        return true;
      },

      equipChip: (id) => {
        const state = get();
        if (!CHIP_BY_ID[id]) return false;
        if ((state.chips.levels[id] ?? 0) < 1) return false;
        if (state.chips.equipped.includes(id)) return false;
        if (state.chips.equipped.length >= state.chips.sockets) return false;
        set((s) => ({ chips: { ...s.chips, equipped: [...s.chips.equipped, id] } }));
        return true;
      },

      unequipChip: (id) => {
        const state = get();
        if (!state.chips.equipped.includes(id)) return false;
        set((s) => ({ chips: { ...s.chips, equipped: s.chips.equipped.filter((c) => c !== id) } }));
        return true;
      },

      unlockChipSocket: () => {
        const state = get();
        const cost = nextSocketCost(state.chips.sockets);
        if (cost == null) return false;
        if (state.gems < cost) return false;
        set((s) => ({ gems: s.gems - cost, chips: { ...s.chips, sockets: s.chips.sockets + 1 } }));
        return true;
      },
    }),
    {
      name: 'voltspire-meta',
      version: 5,
      storage: createJSONStorage(() => sqliteStateStorage),
      // v1 only had {scrap, gems, highestWave}. v2 fanned that out per-Voltage
      // and added the rest of the economy. v3 reworked Coilworks to the
      // original's own branch set and its group-based unlocks, so levels and
      // unlock flags can't carry over field-for-field — currencies, wave
      // records and every other system do. v4 added the equipped tower skin,
      // v5 the Chips collection.
      //
      // Version-aware on purpose: only a pre-v3 save has Coilworks in the old
      // shape, so only it gets reset. Ignoring `version` here (as this did
      // before v5) would wipe every player's Coilworks progress on any later
      // bump — the reset is a one-time shape change, not a migration policy.
      migrate: (persisted, version) => {
        const old = persisted as
          | {
              scrap?: number;
              gems?: number;
              highestWave?: number;
              highestWaveByVoltage?: Record<number, number>;
              selectedSkin?: string;
              coilworks?: Record<CoilworksUpgradeId, number>;
              coilworksUnlocked?: Record<CoilworksUnlockId, boolean>;
              chips?: ChipsState;
            }
          | undefined;
        const coilworksIsStale = version < 3;
        return {
          ...(persisted as object),
          scrap: old?.scrap ?? 0,
          gems: old?.gems ?? 0,
          voltage: 1,
          highestWaveByVoltage: old?.highestWaveByVoltage ?? (old?.highestWave ? { 1: old.highestWave } : {}),
          coilworks: coilworksIsStale ? createInitialCoilworksLevels() : (old?.coilworks ?? createInitialCoilworksLevels()),
          coilworksUnlocked: coilworksIsStale
            ? createInitialCoilworksUnlocked()
            : (old?.coilworksUnlocked ?? createInitialCoilworksUnlocked()),
          selectedSkin: old?.selectedSkin ?? DEFAULT_SKIN_ID,
          chips: old?.chips ?? createInitialChipsState(),
        };
      },
    },
  ),
);
