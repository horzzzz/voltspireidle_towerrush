import type { EnemyKind, WorldState } from '../core/types';

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
/** Packed layout per slot: [x, y, finalSkiaScale, dirX, dirY]. */
export const FIELDS_PER_SLOT = 5;

/**
 * One fresh Float32Array per kind, every call — see use-battle-engine's
 * publish step for why a new reference (not an in-place mutation) is what
 * makes Reanimated's mapper actually re-run.
 */
export function createEmptyEnemyBuffers(): Record<EnemyKind, Float32Array> {
  return {
    scavenger: new Float32Array(MAX_PER_KIND * FIELDS_PER_SLOT),
    hulk: new Float32Array(MAX_PER_KIND * FIELDS_PER_SLOT),
    runner: new Float32Array(MAX_PER_KIND * FIELDS_PER_SLOT),
  };
}

/**
 * Packs live enemy positions into per-kind buffers. `renderScale[kind]` is
 * "design px of on-screen diameter, at profile scale 1, per source pixel" —
 * precomputed in enemy-atlas.tsx from each sprite's real PNG dimensions —
 * so this stays free of any asset-pixel knowledge.
 */
export function packEnemyBuffers(
  world: WorldState,
  renderScale: Record<EnemyKind, number>,
): Record<EnemyKind, Float32Array> {
  const buffers = createEmptyEnemyBuffers();
  const cursors: Record<EnemyKind, number> = { scavenger: 0, hulk: 0, runner: 0 };

  for (const enemy of world.enemies) {
    const cursor = cursors[enemy.kind];
    if (cursor >= MAX_PER_KIND) continue; // render-only cap; sim keeps simulating the rest
    const buffer = buffers[enemy.kind];
    const base = cursor * FIELDS_PER_SLOT;
    buffer[base] = enemy.x;
    buffer[base + 1] = enemy.y;
    buffer[base + 2] = enemy.scale * renderScale[enemy.kind];
    buffer[base + 3] = enemy.dirX;
    buffer[base + 4] = enemy.dirY;
    cursors[enemy.kind] = cursor + 1;
  }

  return buffers;
}
