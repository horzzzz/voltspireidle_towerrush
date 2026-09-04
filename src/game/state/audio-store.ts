import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { setMusicVolume, setSfxVolume } from '../audio/engine';
import { sqliteStateStorage } from './persist-storage';

/**
 * The MUSIC / SOUND switches, persisted under their own key rather than in the
 * economy store — an unrelated concern, and one the player expects to survive
 * a reinstall of their save just as much as their Scrap.
 *
 * Booleans, not levels, because both screens that expose them (`app/settings`
 * and the in-battle `BattleSettings`) draw a two-state `Toggle`. The engine
 * takes a 0..1 volume, so each write maps the flag onto the ends of that range
 * — leaving room for real sliders later without touching the engine.
 *
 * Every write pushes into the engine immediately, so a toggle flipped mid-run
 * takes effect on the sound already playing rather than on the next one.
 */
type AudioSettingsState = {
  music: boolean;
  sound: boolean;
  setMusic: (value: boolean) => void;
  setSound: (value: boolean) => void;
};

export const useAudioSettingsStore = create<AudioSettingsState>()(
  persist(
    (set) => ({
      music: true,
      sound: true,
      setMusic: (value) => {
        setMusicVolume(value ? 1 : 0);
        set({ music: value });
      },
      setSound: (value) => {
        setSfxVolume(value ? 1 : 0);
        set({ sound: value });
      },
    }),
    {
      name: 'voltspire-audio',
      storage: createJSONStorage(() => sqliteStateStorage),
      // Pushes the rehydrated flags into the engine once the storage read
      // finishes — `initAudio()` otherwise starts everything at the module's
      // default (full) volume regardless of what was saved.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        setMusicVolume(state.music ? 1 : 0);
        setSfxVolume(state.sound ? 1 : 0);
      },
    },
  ),
);

/**
 * Pushes the saved flags into the audio engine.
 *
 * The `persist` middleware already does this from `onRehydrateStorage` — but
 * only once something imports this module, and the two Settings screens are
 * the only things that otherwise would. A player who never opens Settings
 * would then hear everything at full volume no matter what they had turned
 * off last session. Calling this at startup is what makes the setting apply
 * to the session it was saved for.
 */
export function applySavedAudioSettings(): void {
  const { music, sound } = useAudioSettingsStore.getState();
  setMusicVolume(music ? 1 : 0);
  setSfxVolume(sound ? 1 : 0);
}
