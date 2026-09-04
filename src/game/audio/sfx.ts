/**
 * One-shot sound effect registry. `require()` targets have to be spelled out
 * literally — Metro can't resolve a dynamic one, the same constraint the
 * image assets live under.
 *
 * There are no voice pools: `engine.ts` decodes each clip once into an
 * `AudioBuffer` and spawns a throwaway source node per play, so a sound can
 * overlap itself as many times as the game asks for. What stops a wave wipe
 * from turning into noise is the per-id budget in `battle-sfx.ts`, not a
 * ceiling on voices.
 *
 * `assets/audio/CREDITS.md` lists where every clip came from, and
 * `scripts/fetch-audio.sh` rebuilds the whole directory from those sources.
 */

export type SfxId =
  // UI — every button in the app goes through `GamePressable`.
  | 'ui-click'
  | 'ui-back'
  | 'ui-denied'
  | 'ui-toggle'
  // Economy — hung off the same call sites as the reward VFX bursts.
  | 'purchase'
  | 'reward-claim'
  | 'unlock'
  | 'level-up'
  // Wheel of Luck.
  | 'wheel-win'
  | 'wheel-fail'
  // Battle — driven by the sim's own VfxEvent stream, see battle-sfx.ts.
  | 'tower-shot'
  | 'tower-crit'
  | 'enemy-death'
  | 'boss-death'
  | 'tower-hit'
  | 'boss-spawn'
  | 'wave-start'
  | 'run-upgrade'
  | 'defeat';

export const SFX_SOURCES: Record<SfxId, number> = {
  'ui-click': require('@/assets/audio/ui-click.m4a'),
  'ui-back': require('@/assets/audio/ui-back.m4a'),
  'ui-denied': require('@/assets/audio/ui-denied.m4a'),
  'ui-toggle': require('@/assets/audio/ui-toggle.m4a'),
  purchase: require('@/assets/audio/purchase.m4a'),
  'reward-claim': require('@/assets/audio/reward-claim.m4a'),
  unlock: require('@/assets/audio/unlock.m4a'),
  'level-up': require('@/assets/audio/level-up.m4a'),
  'wheel-win': require('@/assets/audio/wheel-win.m4a'),
  'wheel-fail': require('@/assets/audio/wheel-fail.m4a'),
  'tower-shot': require('@/assets/audio/tower-shot.m4a'),
  'tower-crit': require('@/assets/audio/tower-crit.m4a'),
  'enemy-death': require('@/assets/audio/enemy-death.m4a'),
  'boss-death': require('@/assets/audio/boss-death.m4a'),
  'tower-hit': require('@/assets/audio/tower-hit.m4a'),
  'boss-spawn': require('@/assets/audio/boss-spawn.m4a'),
  'wave-start': require('@/assets/audio/wave-start.m4a'),
  'run-upgrade': require('@/assets/audio/run-upgrade.m4a'),
  defeat: require('@/assets/audio/defeat.m4a'),
};

/**
 * Standing per-clip mix trim, applied by `playSfx` on top of the SOUND
 * setting. Every clip is listed, including the ones that come out at 1, so the
 * table reads as a mix rather than as a list of exceptions.
 *
 * These are computed, not dialled by ear. `scripts/fetch-audio.sh` prints each
 * clip's LOUD figure — RMS over its loudest 300 ms — and each trim is whatever
 * puts that figure on the target below, clamped so no clip is boosted past
 * -1 dBFS peak (four of them hit that clamp and land slightly under target).
 *
 * The targets are a ladder, in dB of loudness, against a music bed that sits
 * at about -24.5 (MUSIC_MIX_LEVEL in engine.ts):
 *
 *   -12   once-a-run moments        boss-death, defeat
 *   -14   payouts and unlocks       reward-claim, unlock, wheel-win
 *   -15   confirmations             purchase, level-up, run-upgrade
 *   -18   punctuation               ui-denied, tower-crit, boss-spawn, wheel-fail
 *   -19   ordinary taps             ui-click, ui-toggle, ui-back
 *   -21   the relentless ones       tower-shot, enemy-death, wave-start, tower-hit
 *
 * So the rule of thumb is frequency: anything that fires several times a
 * second sits just above the music and no further, while the things that
 * happen once a run are allowed to be loud.
 *
 * The metric matters more than it looks. An earlier version of this table was
 * built from peak instead, which put the UI click 21 dB *underneath* the music
 * — the packs master a 0.06 s blip and a 2 s explosion to the same peak even
 * though they are 20 dB apart in audibility. See `scripts/audio-levels.py`.
 */
export const SFX_GAIN: Partial<Record<SfxId, number>> = {
  'ui-click': 0.87,
  'ui-back': 1,
  'ui-denied': 0.83,
  'ui-toggle': 0.5,
  purchase: 0.66,
  'reward-claim': 1.05,
  unlock: 0.43,
  'level-up': 0.81,
  'wheel-win': 0.94,
  'wheel-fail': 0.93,
  'tower-shot': 1.19,
  'tower-crit': 0.56,
  'enemy-death': 0.91,
  'boss-death': 0.89,
  'tower-hit': 1.05,
  'boss-spawn': 1.51,
  'wave-start': 0.22,
  'run-upgrade': 0.87,
  defeat: 1.22,
};

export const WHEEL_SPIN_SOURCE: number = require('@/assets/audio/wheel-spin.m4a');
export const MUSIC_THEME_SOURCE: number = require('@/assets/audio/music-theme.m4a');
