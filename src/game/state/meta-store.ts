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
  highestWave: number;
  /** Folds a finished run's earnings into the persisted totals. */
  addRunResult: (result: RunResult) => void;
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set) => ({
      scrap: 0,
      highestWave: 0,
      addRunResult: (result) =>
        set((s) => ({
          scrap: s.scrap + result.scrapEarned,
          highestWave: Math.max(s.highestWave, result.waveReached),
        })),
    }),
    {
      name: 'voltspire-meta',
      storage: createJSONStorage(() => sqliteStateStorage),
    },
  ),
);
