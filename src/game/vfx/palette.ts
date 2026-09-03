/**
 * VFX colours, as premultiplied-friendly [r, g, b] floats in 0..1 — the shape
 * Skia's `SkColor` (a Float32Array RGBA) wants, so nothing has to parse a
 * string per particle per frame.
 *
 * The per-kind debris colours are sampled from the actual sprite art
 * (assets/images/battle/enemy-0N.png, boss-N.png) rather than invented, so a
 * scavenger bursts in its own teal and a hulk in its own tan.
 */

export type Rgb = readonly [number, number, number];

/** '#rrggbb' -> [r, g, b] in 0..1. Module-load only, never in a hot path. */
function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

export const VfxColors = {
  /** The tower's own electric blue — bolts, muzzle flash, charge motes. */
  bolt: rgb('#7fe9ff'),
  boltCore: rgb('#ffffff'),
  /** Crit gold. */
  crit: rgb('#ffcf3a'),
  /** Damage the tower takes. */
  hurt: rgb('#ff4d4d'),
  boss: rgb('#ff5c5c'),
  gem: rgb('#3aa7ff'),
  scrap: rgb('#ff7709'),
  /** Generic grey body debris — every enemy silhouette is dark. */
  debris: rgb('#4c433f'),
  waveScan: rgb('#2fb8ff'),
  upgrade: rgb('#3ddc6b'),
} as const;

/** Accent colour per regular enemy kind, sampled from its sprite. */
export const ENEMY_ACCENT: Record<string, Rgb> = {
  scavenger: rgb('#318ba4'),
  hulk: rgb('#ca8a5a'),
  runner: rgb('#d28a24'),
};

/** Accent per boss sprite variant, in the same order as BOSS_SOURCES. */
export const BOSS_ACCENT: Rgb[] = [rgb('#408ef6'), rgb('#c4f227'), rgb('#fba032')];
