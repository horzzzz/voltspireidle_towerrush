import { Atlas, useColorBuffer, useRSXformBuffer, useRectBuffer } from '@shopify/react-native-skia';
import { memo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { secCount, secOffset } from '@/game/vfx/frame-buffer';
import { BRUSH_CELL, PR } from '@/game/vfx/layout';
import { useBrushAtlas } from './brush-atlas';

type Props = {
  /** A frame buffer (vfx/frame-buffer.ts) holding this layer's particle section. */
  frame: SharedValue<Float32Array>;
  /** Which section inside it — `BSec.additive`, `USec.normal`, … */
  section: number;
  /** Atlas slot count. Fixed for the layer's lifetime; live particles fill it from the front. */
  capacity: number;
  /** 'plus' for glowing effects, 'srcOver' for solid debris. */
  additive?: boolean;
};

/**
 * One Skia `<Atlas>` draws an entire particle pool in a single GPU call, no
 * matter how many particles are alive — the same trick `enemy-atlas.tsx` uses
 * for the swarm, extended with the two per-instance buffers that pool needs:
 * `sprites` (which procedural brush cell) and `colors` (tint *and* alpha, via
 * `colorBlendMode="modulate"` against the all-white sheet).
 *
 * Three Reanimated mappers per layer, fixed. Slots past the section's live
 * count write size 0, which collapses their quads to nothing.
 */
/**
 * Memoized for the same reason as `EnemyAtlas`: `frame` is a stable
 * SharedValue for the battle's lifetime, and this component registers THREE
 * buffer-hook mappers (sprites/transforms/colors) — the most of any node in
 * the scene — so an unmemoized re-render here is the single biggest source
 * of avoidable Reanimated mapper churn (and strict-mode log spam) per frame.
 */
export const ParticleLayer = memo(function ParticleLayer({ frame, section, capacity, additive }: Props) {
  const image = useBrushAtlas();

  const sprites = useRectBuffer(capacity, (val, i) => {
    'worklet';
    const data = frame.value;
    const brush = i < secCount(data, section) ? data[secOffset(data, section) + i * PR.STRIDE + PR.brush] : 0;
    val.setXYWH(brush * BRUSH_CELL, 0, BRUSH_CELL, BRUSH_CELL);
  });

  const transforms = useRSXformBuffer(capacity, (val, i) => {
    'worklet';
    const data = frame.value;
    // Past the live count the section holds nothing; size 0 hides the slot.
    if (i >= secCount(data, section)) {
      val.set(0, 0, 0, 0);
      return;
    }
    const base = secOffset(data, section) + i * PR.STRIDE;
    const scale = data[base + PR.size] / BRUSH_CELL;
    const rot = data[base + PR.rot];
    const scos = Math.cos(rot) * scale;
    const ssin = Math.sin(rot) * scale;
    // Centering translation for a rotated cell: its middle must land on (x, y).
    const c = BRUSH_CELL / 2;
    val.set(scos, ssin, data[base + PR.x] - (scos * c - ssin * c), data[base + PR.y] - (ssin * c + scos * c));
  });

  const colors = useColorBuffer(capacity, (val, i) => {
    'worklet';
    const data = frame.value;
    if (i >= secCount(data, section)) {
      val[0] = 0;
      val[1] = 0;
      val[2] = 0;
      val[3] = 0;
      return;
    }
    const base = secOffset(data, section) + i * PR.STRIDE;
    val[0] = data[base + PR.r];
    val[1] = data[base + PR.g];
    val[2] = data[base + PR.b];
    val[3] = data[base + PR.a];
  });

  return (
    <Atlas
      image={image}
      sprites={sprites}
      transforms={transforms}
      colors={colors}
      colorBlendMode="modulate"
      blendMode={additive ? 'plus' : 'srcOver'}
    />
  );
});
