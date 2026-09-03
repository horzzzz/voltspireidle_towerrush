import { BOSS_VARIANT_COUNT } from '../data/enemies';
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
/** Bosses are rare — at most one per boss wave, plus stragglers from an earlier one. */
export const MAX_BOSS = 8;
/** Packed layout per slot: [x, y, finalSkiaScale, dirX, dirY]. */
export const FIELDS_PER_SLOT = 5;

/** Render buffer keys: one per regular enemy kind, plus one per boss sprite variant. */
export type EnemyBufferKey = EnemyKind | `boss${number}`;

const BOSS_KEYS = Array.from({ length: BOSS_VARIANT_COUNT }, (_, i) => `boss${i}` as const);

/**
 * One fresh Float32Array per buffer, every call — see use-battle-engine's
 * publish step for why a new reference (not an in-place mutation) is what
 * makes Reanimated's mapper actually re-run.
 */
export function createEmptyEnemyBuffers(): Record<EnemyBufferKey, Float32Array> {
  const buffers = {
    scavenger: new Float32Array(MAX_PER_KIND * FIELDS_PER_SLOT),
    hulk: new Float32Array(MAX_PER_KIND * FIELDS_PER_SLOT),
    runner: new Float32Array(MAX_PER_KIND * FIELDS_PER_SLOT),
  } as Record<EnemyBufferKey, Float32Array>;
  for (const key of BOSS_KEYS) buffers[key] = new Float32Array(MAX_BOSS * FIELDS_PER_SLOT);
  return buffers;
}

/**
 * Packs live enemy positions into per-buffer arrays. `renderScale[kind]` and
 * `bossRenderScale[variant]` are "design px of on-screen diameter, at scale 1,
 * per source pixel" — precomputed in enemy-atlas.tsx from each sprite's real
 * PNG dimensions — so this stays free of any asset-pixel knowledge.
 *
 * A boss is routed to its `boss${bossVariant}` buffer by its wave-cycled
 * sprite variant, never to its `kind` buffer.
 */
export function packEnemyBuffers(
  world: WorldState,
  renderScale: Record<EnemyKind, number>,
  bossRenderScale: number[],
): Record<EnemyBufferKey, Float32Array> {
  const buffers = createEmptyEnemyBuffers();
  const cursors: Record<string, number> = { scavenger: 0, hulk: 0, runner: 0 };
  for (const key of BOSS_KEYS) cursors[key] = 0;

  for (const enemy of world.enemies) {
    const isBoss = enemy.isBoss;
    const key: EnemyBufferKey = isBoss ? (`boss${enemy.bossVariant}` as const) : enemy.kind;
    const cap = isBoss ? MAX_BOSS : MAX_PER_KIND;
    const cursor = cursors[key];
    if (cursor >= cap) continue; // render-only cap; sim keeps simulating the rest

    const scale = isBoss
      ? enemy.scale * (bossRenderScale[enemy.bossVariant] ?? 0)
      : enemy.scale * renderScale[enemy.kind];

    const buffer = buffers[key];
    const base = cursor * FIELDS_PER_SLOT;
    buffer[base] = enemy.x;
    buffer[base + 1] = enemy.y;
    buffer[base + 2] = scale;
    buffer[base + 3] = enemy.dirX;
    buffer[base + 4] = enemy.dirY;
    cursors[key] = cursor + 1;
  }

  return buffers;
}
