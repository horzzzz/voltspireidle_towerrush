/**
 * Per-entry strides shared by the VFX simulation (system.ts, JS thread) and
 * the Skia render layer (src/game/render/vfx, UI thread). Both sides index the
 * same `Float32Array`, so every field offset lives here exactly once.
 *
 * *Where* each pool's entries land in that array is not here — sections are
 * laid out per frame, sized to what is alive, by vfx/frame-buffer.ts.
 *
 * The `_CAP` capacities are the pools' own fixed sizes and the Skia atlases'
 * slot counts: `useBuffer` re-allocates and rebuilds its Reanimated mapper
 * whenever `size` changes, so an atlas that grew with the action would thrash
 * on every burst. Overflow is handled by round-robin reuse — a new particle
 * displaces the oldest one — which degrades smoothly instead of stalling.
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
/**
 * The render side gets the raw `amount` and `kind` rather than a formatted
 * string: the label text is built (and cached) on the UI thread instead, so a
 * 28-entry string array no longer has to be rebuilt and serialised every
 * frame a single damage number changes. `kind` also picks the colour, so
 * there is no need to ship r/g/b per number either.
 */
export const NR = { x: 0, y: 1, scale: 2, a: 3, amount: 4, kind: 5, STRIDE: 6 } as const;

/** Number kinds — shared by the sim (which classifies) and the renderer (which colours). */
export const KIND_NORMAL = 0;
export const KIND_CRIT = 1;
export const KIND_BOSS = 2;
export const KIND_TOWER = 3;

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

/**
 * Screen-wide state: camera shake, vignette, flash, tower recoil, wave banner,
 * tower HP. Colours are gone from here on purpose — the vignette is always
 * `VfxColors.hurt` (baked into its texture, see render/vfx/overlay-texture.ts)
 * and the banner picks its colour from `bannerBoss`.
 */
export const G = {
  shakeX: 0,
  shakeY: 1,
  vignette: 2,
  flash: 3,
  /** Just-took-damage level, without the low-HP pulse the vignette folds in. */
  hurt: 4,
  /** Tower kickback, design px — applied to the tower sprite only. */
  recoilX: 5,
  recoilY: 6,
  /** Wave/boss banner: 0 hides it entirely. */
  bannerAlpha: 7,
  bannerScale: 8,
  /** Tower HP 0..1 — drives the HP ring, drawn straight from this buffer. */
  hp: 9,
  /**
   * Which wave the banner is announcing, and whether it is a boss wave. The
   * render layer builds the label from these on the UI thread rather than
   * subscribing to `battle-store` — see render/vfx/vfx-picture.tsx on why the
   * banner no longer goes through React at all.
   */
  bannerWave: 10,
  bannerBoss: 11,
  STRIDE: 12,
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
