import { Atlas, Skia, useColorBuffer, useImage, useRSXformBuffer } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { ENEMY_BASE_RADIUS } from '@/game/data/arena';
import type { EnemyKind } from '@/game/core/types';
import { FIELDS_PER_SLOT, HIT_FLASH_OFFSET, MAX_BOSS, MAX_PER_KIND } from './enemy-buffers';

/** On-screen diameter, in design px, for a kind-1.0-scale enemy. */
const BASE_DIAMETER = ENEMY_BASE_RADIUS * 2;

/** Real pixel size of each source PNG — needed to compute the Atlas source rect and the pivot offset that centers a sprite on its (x, y). */
const SOURCES: Record<EnemyKind, { module: number; width: number; height: number }> = {
  scavenger: { module: require('@/assets/images/battle/enemy-01.png'), width: 444, height: 533 },
  hulk: { module: require('@/assets/images/battle/enemy-02.png'), width: 319, height: 480 },
  runner: { module: require('@/assets/images/battle/enemy-03.png'), width: 277, height: 506 },
};

/**
 * Dedicated boss sprites (top-down), indexed by `enemy.bossVariant` — a wave
 * cycle, see `pickBossVariant`. `front` is the unit vector the artwork's
 * "nose" points along in its own source pixels; the transform rotates that
 * onto the walk direction so the boss faces the tower.
 */
const BOSS_SOURCES: { module: number; width: number; height: number; front: [number, number] }[] = [
  // boss-1: blue spider — radial body, glowing head toward the bottom.
  { module: require('@/assets/images/battle/boss-1.png'), width: 190, height: 139, front: [0, 1] },
  // boss-2: green worm — head/mandibles on the left.
  { module: require('@/assets/images/battle/boss-2.png'), width: 185, height: 59, front: [-1, 0] },
  // boss-3: orange beetle — mandibles pointing up.
  { module: require('@/assets/images/battle/boss-3.png'), width: 119, height: 117, front: [0, -1] },
];

/** "Design px per source px" at scale 1 — see enemy-buffers.ts. */
export const ENEMY_RENDER_SCALE: Record<EnemyKind, number> = {
  scavenger: BASE_DIAMETER / SOURCES.scavenger.width,
  hulk: BASE_DIAMETER / SOURCES.hulk.width,
  runner: BASE_DIAMETER / SOURCES.runner.width,
};

/**
 * Boss sprites vary wildly in aspect (the worm is wide and short), so scale
 * by the larger dimension to keep a consistent on-screen footprint. Tunable —
 * verify on web/emulator.
 */
export const BOSS_RENDER_SCALE: number[] = BOSS_SOURCES.map(
  (s) => BASE_DIAMETER / Math.max(s.width, s.height),
);

type Props = {
  /** Regular enemy kind — its source sprite. Ignored when `bossVariant` is set. */
  kind?: EnemyKind;
  /** When set, draw the dedicated boss sprite for this variant instead. */
  bossVariant?: number;
  /** Packed [x, y, finalScale, dirX, dirY, hitFlash] × capacity, refreshed every frame. */
  buffer: SharedValue<Float32Array>;
};

/**
 * One Skia `<Atlas>` per enemy kind (and per boss sprite variant) — every
 * instance in one GPU draw call, regardless of how many are alive. A boss is
 * just a different source + a larger `finalScale`, not a separate draw path.
 */
/**
 * Memoized: its `buffer` prop is a stable SharedValue for the whole battle's
 * lifetime (see use-battle-engine.ts), so without this the component — and
 * every `useRSXformBuffer`/`useColorBuffer` mapper it registers — would
 * re-run on every one of `BattleCanvas`'s ~10Hz re-renders for no reason.
 * With 6 of these on screen at once that churn is real: each buffer hook
 * re-registers its Reanimated mapper (and, in dev, logs a strict-mode
 * warning) from the render body every single time, so unmemoized this can
 * flood the JS thread badly enough to stall the sim's own rAF loop.
 */
export const EnemyAtlas = memo(function EnemyAtlas({ kind, bossVariant, buffer }: Props) {
  const isBoss = bossVariant != null;
  const bossSrc = isBoss ? BOSS_SOURCES[bossVariant] : null;
  const src = bossSrc ?? SOURCES[kind ?? 'scavenger'];
  const { module: source, width, height } = src;
  const [frontX, frontY] = bossSrc ? bossSrc.front : [0, 1];
  const capacity = isBoss ? MAX_BOSS : MAX_PER_KIND;
  const image = useImage(source);

  const sprites = useMemo(
    () => Array.from({ length: capacity }, () => Skia.XYWHRect(0, 0, width, height)),
    [capacity, width, height],
  );

  const transforms = useRSXformBuffer(capacity, (val, i) => {
    'worklet';
    const data = buffer.value;
    const base = i * FIELDS_PER_SLOT;
    const scale = data[base + 2];
    const x = data[base];
    const y = data[base + 1];
    const dirX = data[base + 3];
    const dirY = data[base + 4];
    // Rotate the sprite so its art-space front vector (frontX, frontY) points
    // along (dirX, dirY) — the walk direction toward the tower. For a
    // rotation-scale matrix [[scos,-ssin],[ssin,scos]], the rotation taking
    // (frontX,frontY) to (dirX,dirY) is scos = f·d, ssin = f×d.
    // (frontX,frontY)=(0,1) recovers the old scos=scale*dirY, ssin=-scale*dirX.
    const scos = scale * (frontX * dirX + frontY * dirY);
    const ssin = scale * (frontX * dirY - frontY * dirX);
    const cx = width / 2;
    const cy = height / 2;
    // Centering translation for a rotated rect: source center (cx, cy) must
    // land on (x, y) under this same matrix.
    val.set(scos, ssin, x - (scos * cx - ssin * cy), y - (ssin * cx + scos * cy));
  });

  // Per-instance white flash on hit. `screen` brightens toward white without
  // being able to push a channel past 1 (which a `plus` blend would), and a
  // zero colour is a no-op under it — so an un-hit enemy draws exactly as
  // before and a just-hit one lights up for a fraction of a second. That is
  // what makes a shot land on a *specific* body in a crowded swarm.
  const colors = useColorBuffer(capacity, (val, i) => {
    'worklet';
    const flash = buffer.value[i * FIELDS_PER_SLOT + HIT_FLASH_OFFSET] * 0.85;
    val[0] = flash;
    val[1] = flash;
    val[2] = flash;
    val[3] = 0;
  });

  if (!image) return null;

  return (
    <Atlas image={image} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode="screen" />
  );
});
