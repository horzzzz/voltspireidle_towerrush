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

/** Render buffer keys: one per regular enemy kind, plus one per boss sprite variant. */
export type EnemyBufferKey = EnemyKind | `boss${number}`;

export type EnemyBufferSet = Record<EnemyBufferKey, Float32Array>;

const BOSS_KEYS = Array.from({ length: BOSS_VARIANT_COUNT }, (_, i) => `boss${i}` as const);

/**
 * One buffer per kind, all zeroed. Used both for the throwaway seed passed to
 * `useSharedValue` and, every frame after that, freshly by `packEnemyBuffers`
 * itself — see that function's own note on why a fresh set is non-negotiable.
 */
export function createEmptyEnemyBuffers(): EnemyBufferSet {
  const buffers = {
    scavenger: new Float32Array(MAX_PER_KIND * FIELDS_PER_SLOT),
    hulk: new Float32Array(MAX_PER_KIND * FIELDS_PER_SLOT),
    runner: new Float32Array(MAX_PER_KIND * FIELDS_PER_SLOT),
  } as EnemyBufferSet;
  for (const key of BOSS_KEYS) buffers[key] = new Float32Array(MAX_BOSS * FIELDS_PER_SLOT);
  return buffers;
}

/** Overshooting ease so a warp-in lands with a little snap. */
function warpScale(age: number): number {
  if (age >= WARP_SECONDS) return 1;
  const t = age / WARP_SECONDS;
  const inv = 1 - t;
  return 1 + 1.9 * inv * inv * inv - 2.9 * inv * inv;
}

/**
 * Packs live enemy positions into a fresh set of per-kind arrays.
 * `renderScale[kind]` and `bossRenderScale[variant]` are "design px of
 * on-screen diameter, at scale 1, per source pixel" — precomputed in
 * enemy-atlas.tsx from each sprite's real PNG dimensions — so this stays free
 * of any asset-pixel knowledge.
 *
 * A boss is routed to its `boss${bossVariant}` buffer by its wave-cycled
 * sprite variant, never to its `kind` buffer.
 *
 * A brand-new `Float32Array` set every call, on purpose, not reused/mutated
 * in place: Reanimated's cross-thread propagation for a shared value keys off
 * the array's own object identity, so handing back the *same* reference with
 * new numbers in it never reaches the UI thread's copy — the Atlas nodes
 * reading it would just freeze at whatever they last saw. This is cheap
 * enough (tens of KB/frame) to not trouble Hermes' GC.
 */
export function packEnemyBuffers(
  world: WorldState,
  renderScale: Record<EnemyKind, number>,
  bossRenderScale: number[],
): EnemyBufferSet {
  const target = createEmptyEnemyBuffers();
  const cursors: Record<string, number> = { scavenger: 0, hulk: 0, runner: 0 };
  for (const key of BOSS_KEYS) cursors[key] = 0;

  for (const enemy of world.enemies) {
    const isBoss = enemy.isBoss;
    const key: EnemyBufferKey = isBoss ? (`boss${enemy.bossVariant}` as const) : enemy.kind;
    const cap = isBoss ? MAX_BOSS : MAX_PER_KIND;
    const cursor = cursors[key];
    if (cursor >= cap) continue; // render-only cap; sim keeps simulating the rest

    const baseScale = isBoss
      ? enemy.scale * (bossRenderScale[enemy.bossVariant] ?? 0)
      : enemy.scale * renderScale[enemy.kind];

    const buffer = target[key];
    const base = cursor * FIELDS_PER_SLOT;
    buffer[base] = enemy.x;
    buffer[base + 1] = enemy.y;
    buffer[base + 2] = baseScale * warpScale(enemy.age);
    buffer[base + 3] = enemy.dirX;
    buffer[base + 4] = enemy.dirY;
    buffer[base + HIT_FLASH_OFFSET] = enemy.hitFlash;
    cursors[key] = cursor + 1;
  }

  return target;
}
