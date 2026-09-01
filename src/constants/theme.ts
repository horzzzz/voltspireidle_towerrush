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
