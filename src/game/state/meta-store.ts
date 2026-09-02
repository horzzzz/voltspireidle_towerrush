import { Storage } from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { RunResult } from '../core/types';

/** Thin sync adapter — `expo-sqlite/kv-store` is a drop-in AsyncStorage
 * replacement but also exposes sync methods, which keep zustand's persist
 * hydration simple (no loading-state dance for a couple of small numbers). */
const sqliteStateStorage: StateStorage = {
  getItem: (name) => Storage.getItemSync(name),
  setItem: (name, value) => Storage.setItemSync(name, value),
  removeItem: (name) => Storage.removeItemSync(name),
};

interface MetaState {
  /** Banked Scrap from all past runs — what Coilworks will spend, later. */
  scrap: number;
  /** Premium currency — earned from rewards, spent in the shop catalog. */
  gems: number;
  highestWave: number;
  /** Folds a finished run's earnings into the persisted totals. */
  addRunResult: (result: RunResult) => void;
  /**
   * Spend `gemCost` gems to bank `scrapAmount` scrap (shop catalog).
   * No-op returning `false` when the player can't afford it.
   */
  buyScrap: (gemCost: number, scrapAmount: number) => boolean;
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      scrap: 0,
      gems: 0,
      highestWave: 0,
      addRunResult: (result) =>
        set((s) => ({
          scrap: s.scrap + result.scrapEarned,
          highestWave: Math.max(s.highestWave, result.waveReached),
        })),
      buyScrap: (gemCost, scrapAmount) => {
        if (get().gems < gemCost) return false;
        set((s) => ({ gems: s.gems - gemCost, scrap: s.scrap + scrapAmount }));
        return true;
      },
    }),
    {
      name: 'voltspire-meta',
      storage: createJSONStorage(() => sqliteStateStorage),
    },
  ),
);
