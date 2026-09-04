import { Storage } from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Thin sync adapter shared by every persisted store — `expo-sqlite/kv-store`
 * is a drop-in AsyncStorage replacement but also exposes sync methods, which
 * keep zustand's persist hydration simple (no loading-state dance for a
 * handful of small values).
 *
 * Note that importing this is what pulls `expo-sqlite/kv-store` in, and on web
 * that reaches a `.wasm` file Metro only resolves because of the `assetExts`
 * line in metro.config.js.
 */
export const sqliteStateStorage: StateStorage = {
  getItem: (name) => Storage.getItemSync(name),
  setItem: (name, value) => Storage.setItemSync(name, value),
  removeItem: (name) => Storage.removeItemSync(name),
};
