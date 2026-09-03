/**
 * Arena geometry, in Figma design pixels (frame `game`, node 1:1512, 430×932).
 * The render layer scales this space to the device screen; the sim never
 * needs to know the actual pixel size of the phone.
 */

/** Natural size of the battle frame in the design. */
export const ARENA_WIDTH = 430;
export const ARENA_HEIGHT = 932;

/** Tower center, derived from `tower_1` bounds (x154 y404 w121.56 h124). */
export const TOWER_X = 215;
export const TOWER_Y = 466;

/** Half the tower's average footprint — enemies stop this far from center. */
export const TOWER_BODY_RADIUS = 60;

/** Auto-attack radius, matches the dashed `Ellipse 1` ring in the design. */
export const ATTACK_RANGE = 91;

/** Extra distance beyond the frame edge enemies spawn at, so they walk into view. */
export const SPAWN_MARGIN = 36;

/** Enemy footprint radius at scale 1, used for spawn placement and contact checks. */
export const ENEMY_BASE_RADIUS = 26;

/**
 * Point on a ray from the arena center at `angle`, placed just outside the
 * arena rectangle (by `SPAWN_MARGIN`) regardless of direction — enemies pop
 * in beyond every edge, not on a fixed circle, matching how corners vs. mid-edges
 * differ in a portrait frame.
 */
export function raySpawnPoint(angle: number): { x: number; y: number } {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const halfW = ARENA_WIDTH / 2;
  const halfH = ARENA_HEIGHT / 2;
  const tToVerticalEdge = dx !== 0 ? Math.abs(halfW / dx) : Infinity;
  const tToHorizontalEdge = dy !== 0 ? Math.abs(halfH / dy) : Infinity;
  const t = Math.min(tToVerticalEdge, tToHorizontalEdge) + SPAWN_MARGIN;
  return { x: TOWER_X + dx * t, y: TOWER_Y + dy * t };
}

/**
 * Where the battle HUD's Charge and Scrap readouts sit, expressed in this
 * same design space, so canvas effects can fly a reward mote to the counter
 * it is paying into (see vfx/system.ts `onKill`).
 *
 * Approximate on purpose: the HUD is React Native laid over the canvas, with
 * its own safe-area inset, so there is no exact mapping. These are the values
 * for a typical portrait phone (`HudTop`'s left column, ~x12 + a 20px icon,
 * under a ~48pt status-bar inset) and only ever need to be close enough that a
 * mote reads as flying "up into the counter".
 */
export const CHARGE_HUD_ANCHOR = { x: 38, y: 74 } as const;
export const SCRAP_HUD_ANCHOR = { x: 38, y: 104 } as const;
