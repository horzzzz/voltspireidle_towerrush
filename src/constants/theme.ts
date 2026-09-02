/**
 * Design tokens for the splash flow. The game is dark-only, so there is no
 * light/dark map -- just the values the Figma splash frames (nodes 1:4 / 1:17)
 * are drawn against.
 */

/** Natural size of the Figma splash frames, in design points. */
export const DesignFrame = { width: 430, height: 932 } as const;

export const SplashColors = {
  /** Native + JS splash background. Matches app.json's splash plugin. */
  bg: '#000000',
  /** Progress-bar track fill (Figma node 1:13). */
  track: 'rgba(60,52,48,0.52)',
  trackBorder: '#ffffff',
  /** Progress-bar fill gradient. */
  fillFrom: '#ffffff',
  fillTo: '#d8d8d8',
  text: '#ffffff',
} as const;

export const Fonts = {
  grenzeRegular: 'Grenze_400Regular',
  grenzeMedium: 'Grenze_500Medium',
  grenzeSemiBold: 'Grenze_600SemiBold',
} as const;

/** Menu / HUD tokens (Figma node 1:114). */
export const MenuColors = {
  bg: '#000000',
  text: '#ffffff',
  /** Cyan callout text ("SCRAP BONUS…"). */
  accent: '#00BBFF',
  /** Brighter cyan ("BEST SCRAP FARM"). */
  accentBright: '#00E5FF',
  /** Bottom nav bar plate. */
  navBar: 'rgba(20,22,30,0.72)',
  navBorder: 'rgba(255,255,255,0.10)',
} as const;

/** Largest width the HUD column is allowed to grow to on wide screens. */
export const MenuMaxWidth = 480;

/** Battle screen tokens (Figma node 1:1512). */
export const BattleColors = {
  chargeAccent: '#7fe9ff',
  waveFillFrom: '#2fb8ff',
  waveFillTo: '#7fe9ff',
  waveTrack: 'rgba(20,30,42,0.7)',
  hpFull: '#3ddc6b',
  hpMid: '#f2b73c',
  hpLow: '#ff4d4d',
  bossTag: '#ff5c5c',
  upgradeRow: 'rgba(21,23,34,0.71)',
  upgradeRowMaxed: 'rgba(21,23,34,0.4)',
} as const;
