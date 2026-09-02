import { Atlas, Skia, useImage, useRSXformBuffer } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { ENEMY_BASE_RADIUS } from '@/game/data/arena';
import type { EnemyKind } from '@/game/core/types';
import { FIELDS_PER_SLOT, MAX_PER_KIND } from './enemy-buffers';

/** On-screen diameter, in design px, for a kind-1.0-scale enemy. */
const BASE_DIAMETER = ENEMY_BASE_RADIUS * 2;

/** Real pixel size of each source PNG — needed to compute the Atlas source rect and the pivot offset that centers a sprite on its (x, y). */
const SOURCES: Record<EnemyKind, { module: number; width: number; height: number }> = {
  scavenger: { module: require('@/assets/images/battle/enemy-01.png'), width: 444, height: 533 },
  hulk: { module: require('@/assets/images/battle/enemy-02.png'), width: 319, height: 480 },
  runner: { module: require('@/assets/images/battle/enemy-03.png'), width: 277, height: 506 },
};

/** "Design px per source px" at profile scale 1 — see enemy-buffers.ts. */
export const ENEMY_RENDER_SCALE: Record<EnemyKind, number> = {
  scavenger: BASE_DIAMETER / SOURCES.scavenger.width,
  hulk: BASE_DIAMETER / SOURCES.hulk.width,
  runner: BASE_DIAMETER / SOURCES.runner.width,
};

type Props = {
  kind: EnemyKind;
  /** Packed [x, y, finalScale] × MAX_PER_KIND, refreshed every sim tick. */
  buffer: SharedValue<Float32Array>;
};

/**
 * One Skia `<Atlas>` per enemy kind — every instance of that kind, in one
 * GPU draw call, regardless of how many are alive. A boss is just a larger
 * `finalScale` value in the same buffer, not a separate draw path.
 */
export function EnemyAtlas({ kind, buffer }: Props) {
  const { module: source, width, height } = SOURCES[kind];
  const image = useImage(source);

  const sprites = useMemo(
    () => Array.from({ length: MAX_PER_KIND }, () => Skia.XYWHRect(0, 0, width, height)),
    [width, height],
  );

  const transforms = useRSXformBuffer(MAX_PER_KIND, (val, i) => {
    'worklet';
    const data = buffer.value;
    const base = i * FIELDS_PER_SLOT;
    const scale = data[base + 2];
    const x = data[base];
    const y = data[base + 1];
    const dirX = data[base + 3];
    const dirY = data[base + 4];
    // Every sprite's front (mandibles/head) faces down (+Y) in its source
    // art. Rotate so that front points along (dirX, dirY) — the walk
    // direction toward the tower — instead of always drawing it upright.
    // For a rotation-scale matrix [[scos,-ssin],[ssin,scos]], mapping the
    // local front vector (0,1) onto (dirX,dirY) gives scos=scale*dirY,
    // ssin=-scale*dirX (dirY=1,dirX=0 recovers the old no-rotation case).
    const scos = scale * dirY;
    const ssin = -scale * dirX;
    const cx = width / 2;
    const cy = height / 2;
    // Centering translation for a rotated rect: source center (cx, cy) must
    // land on (x, y) under this same matrix.
    val.set(scos, ssin, x - (scos * cx - ssin * cy), y - (ssin * cx + scos * cy));
  });

  if (!image) return null;

  return <Atlas image={image} sprites={sprites} transforms={transforms} />;
}
