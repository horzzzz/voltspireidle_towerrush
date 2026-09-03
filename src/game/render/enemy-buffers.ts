import { BOSS_VARIANT_COUNT } from '../data/enemies';
import type { EnemyKind, WorldState } from '../core/types';
import { BSec, secOffset } from '../vfx/frame-buffer';

/**
 * Fixed capacity per kind's Skia `<Atlas>`. Fixed on purpose: `useRSXformBuffer`
 * allocates its buffer once per `size` (see @shopify/react-native-skia's
 * `useBuffer`, keyed on `[size]` via `useMemo`) — a size that changes every
 * tick as enemies spawn/die would tear down and rebuild the buffer + its
 * Reanimated mapper constantly. Padding to a constant size and hiding unused
 * slots (scale 0) keeps that allocation a one-time cost.
 */
// Sized above the sim's own NORMAL_MAX_ON_SCREEN cap (120), because that cap
// is on *total* enemies — a late wave can legitimately be 120 of one kind.
export const MAX_PER_KIND = 128;
/** Bosses are rare — at most one per boss wave, plus stragglers from an earlier one. */
export const MAX_BOSS = 8;
/** Packed layout per slot: [x, y, finalSkiaScale, dirX, dirY, hitFlash]. */
export const FIELDS_PER_SLOT = 6;
/** Offset of the 0..1 "just got hit" value the atlas tints the sprite by. */
export const HIT_FLASH_OFFSET = 5;

/**
 * Seconds an enemy spends warping in. Its sprite scales up over this window
 * instead of popping in at full size at the arena edge — paired with the
 * imploding ring the VFX system draws on the same `spawn` event.
 */
const WARP_SECONDS = 0.26;

/**
 * Frame-buffer section index per enemy kind / boss variant, in the order
 * `BSec` declares them. Both the counting and the packing pass index by this.
 */
export const ENEMY_SECTIONS: Record<EnemyKind, number> = {
  scavenger: BSec.scavenger,
  hulk: BSec.hulk,
  runner: BSec.runner,
};
export const BOSS_SECTIONS: number[] = [BSec.boss0, BSec.boss1, BSec.boss2].slice(0, BOSS_VARIANT_COUNT);

/** Overshooting ease so a warp-in lands with a little snap. */
function warpScale(age: number): number {
  if (age >= WARP_SECONDS) return 1;
  const t = age / WARP_SECONDS;
  const inv = 1 - t;
  return 1 + 1.9 * inv * inv * inv - 2.9 * inv * inv;
}

/**
 * Section index this enemy renders into, or -1 if its boss variant has no
 * sprite. Shared by the counting and the packing pass so the two can never
 * disagree about where an enemy belongs.
 */
function sectionFor(enemy: WorldState['enemies'][number]): number {
  return enemy.isBoss ? (BOSS_SECTIONS[enemy.bossVariant] ?? -1) : ENEMY_SECTIONS[enemy.kind];
}

/**
 * First pass: how many enemies each section will hold, written into `counts`
 * (indexed by section). The frame buffer can't be allocated until this is
 * known — see vfx/frame-buffer.ts.
 *
 * The render-only caps still apply here: past them the sim keeps simulating
 * an enemy that simply isn't drawn.
 */
export function countEnemySections(world: WorldState, counts: Int32Array): void {
  const enemies = world.enemies;
  // Indexed, not `for...of` — this runs twice a frame over the whole field,
  // and Hermes allocates an iterator result per step. Same reason as the sim's
  // own loops (core/systems/combat.ts).
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const section = sectionFor(enemy);
    if (section < 0) continue;
    const cap = enemy.isBoss ? MAX_BOSS : MAX_PER_KIND;
    if (counts[section] >= cap) continue;
    counts[section]++;
  }
}

/**
 * Second pass: writes live enemy positions into the frame buffer's per-kind
 * sections. `renderScale[kind]` and `bossRenderScale[variant]` are "design px
 * of on-screen diameter, at scale 1, per source pixel" — precomputed in
 * enemy-atlas.tsx from each sprite's real PNG dimensions — so this stays free
 * of any asset-pixel knowledge.
 *
 * A boss is routed to its `boss${bossVariant}` section by its wave-cycled
 * sprite variant, never to its `kind` section.
 *
 * Must be called with a buffer whose header came from the same frame's
 * `countEnemySections`, or a section will overrun into the next one.
 */
export function packEnemiesInto(
  out: Float32Array,
  world: WorldState,
  renderScale: Record<EnemyKind, number>,
  bossRenderScale: number[],
  cursors: Int32Array,
): void {
  cursors.fill(0);

  const enemies = world.enemies;
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const section = sectionFor(enemy);
    if (section < 0) continue;
    const cap = enemy.isBoss ? MAX_BOSS : MAX_PER_KIND;
    const cursor = cursors[section];
    if (cursor >= cap) continue; // render-only cap; sim keeps simulating the rest

    const baseScale = enemy.isBoss
      ? enemy.scale * (bossRenderScale[enemy.bossVariant] ?? 0)
      : enemy.scale * renderScale[enemy.kind];

    const base = secOffset(out, section) + cursor * FIELDS_PER_SLOT;
    out[base] = enemy.x;
    out[base + 1] = enemy.y;
    out[base + 2] = baseScale * warpScale(enemy.age);
    out[base + 3] = enemy.dirX;
    out[base + 4] = enemy.dirY;
    out[base + HIT_FLASH_OFFSET] = enemy.hitFlash;
    cursors[section] = cursor + 1;
  }
}
