/**
 * Buffer layouts shared by the VFX simulation (system.ts, JS thread) and the
 * Skia render layer (src/game/render/vfx, UI thread). Both sides index the
 * same `Float32Array`s, so every offset lives here exactly once.
 *
 * Capacities are fixed on purpose, for the same reason as the enemy atlas
 * buffers (see render/enemy-buffers.ts): Skia's `useBuffer` re-allocates its
 * buffer and rebuilds its Reanimated mapper whenever `size` changes, so a
 * pool that grew with the action would thrash on every burst. Overflow is
 * handled by round-robin reuse — a new particle displaces the oldest one —
 * which degrades smoothly instead of stalling.
 */

/** Which procedurally-drawn brush cell in the atlas a particle uses. */
export const Brush = { Glow: 0, Spark: 1, Smoke: 2, Star: 3 } as const;
export const BRUSH_COUNT = 4;
/** Side of one square brush cell in the generated atlas, in texture px. */
export const BRUSH_CELL = 64;

/** Additive pool: everything that glows (sparks, flashes, charge motes). */
export const ADDITIVE_CAP = 320;
/** Normal-blend pool: debris and smoke, which must not wash the scene out. */
export const NORMAL_CAP = 192;

/** Per-particle simulation stride. Render never reads this layout. */
export const P = {
  x: 0,
  y: 1,
  vx: 2,
  vy: 3,
  /** Seconds of life left; <= 0 means the slot is free. */
  life: 4,
  invMaxLife: 5,
  size0: 6,
  size1: 7,
  rot: 8,
  rotVel: 9,
  r: 10,
  g: 11,
  b: 12,
  alpha: 13,
  brush: 14,
  /** Velocity damping per second, 0 = none. */
  drag: 15,
  /** Design px/s² pulling +y. */
  gravity: 16,
  /** Homing target; ignored while `homing` is 0. */
  homeX: 17,
  homeY: 18,
  /** Acceleration in design px/s² toward (homeX, homeY). 0 = travels ballistically. */
  homing: 19,
  STRIDE: 20,
} as const;

/** Per-particle render stride — what the Skia `<Atlas>` worklets read. */
export const PR = { x: 0, y: 1, size: 2, rot: 3, r: 4, g: 5, b: 6, a: 7, brush: 8, STRIDE: 9 } as const;

/** Floating damage numbers. */
export const NUMBER_CAP = 28;
export const N = {
  x: 0,
  y: 1,
  vx: 2,
  vy: 3,
  life: 4,
  invMaxLife: 5,
  /** Running total, so simultaneous hits on one body merge into one number. */
  amount: 6,
  /** 0 normal, 1 crit, 2 boss, 3 damage to the tower. */
  kind: 7,
  STRIDE: 8,
} as const;
export const NR = { x: 0, y: 1, scale: 2, a: 3, r: 4, g: 5, b: 6, STRIDE: 7 } as const;

/** Lightning bolts. */
export const BEAM_CAP = 24;
export const B = { x1: 0, y1: 1, x2: 2, y2: 3, life: 4, invMaxLife: 5, seed: 6, crit: 7, STRIDE: 8 } as const;
export const BR = { x1: 0, y1: 1, x2: 2, y2: 3, t: 4, seed: 5, crit: 6, a: 7, STRIDE: 8 } as const;

/** Expanding (or imploding) shockwave rings. */
export const RING_CAP = 16;
export const R = {
  x: 0,
  y: 1,
  r0: 2,
  r1: 3,
  life: 4,
  invMaxLife: 5,
  red: 6,
  green: 7,
  blue: 8,
  w0: 9,
  w1: 10,
  alpha: 11,
  STRIDE: 12,
} as const;
export const RR = { x: 0, y: 1, radius: 2, width: 3, r: 4, g: 5, b: 6, a: 7, STRIDE: 8 } as const;

/** Screen-wide state: camera shake, vignette, flash, tower recoil, wave banner. */
export const G = {
  shakeX: 0,
  shakeY: 1,
  vignette: 2,
  vignetteR: 3,
  vignetteG: 4,
  vignetteB: 5,
  flash: 6,
  /** Just-took-damage level, without the low-HP pulse the vignette folds in. */
  hurt: 7,
  /** Tower kickback, design px — applied to the tower sprite only. */
  recoilX: 8,
  recoilY: 9,
  /** Wave/boss banner: 0 hides it entirely. */
  bannerAlpha: 10,
  bannerScale: 11,
  bannerR: 12,
  bannerG: 13,
  bannerB: 14,
  STRIDE: 15,
} as const;

/**
 * The menus' reward overlay (components/fx/reward-overlay.tsx) reuses the same
 * particle and ring pools in *screen* coordinates instead of arena design
 * space, with its own, much smaller capacities and its own handful of globals.
 */
export const UI_ADDITIVE_CAP = 160;
export const UI_NORMAL_CAP = 64;
export const UI_RING_CAP = 12;

/** Rotating light rays behind a big win, plus a screen flash. */
export const UG = {
  raysX: 0,
  raysY: 1,
  raysAlpha: 2,
  raysRotation: 3,
  raysRadius: 4,
  raysR: 5,
  raysG: 6,
  raysB: 7,
  flash: 8,
  flashR: 9,
  flashG: 10,
  flashB: 11,
  STRIDE: 12,
} as const;

/** How many wedges the ray fan has. */
export const RAY_COUNT = 12;
