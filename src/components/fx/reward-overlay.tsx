import {
  BlendMode,
  Canvas,
  Group,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  TileMode,
  createPicture,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { useFxStore } from '@/game/state/fx-store';
import { secCount, secOffset, USec } from '@/game/vfx/frame-buffer';
import { RAY_COUNT, RR, UG, UI_ADDITIVE_CAP, UI_NORMAL_CAP } from '@/game/vfx/layout';
import { RewardFxSystem } from '@/game/vfx/reward-system';
import { ParticleLayer } from '@/game/render/vfx/particle-layer';

/** Comfortably past any phone, so the flash rect never falls short of an edge. */
const OVERSCAN = 2000;
/** Idle frames to coast before shutting the loop down. */
const IDLE_FRAMES_BEFORE_SLEEP = 12;

/**
 * Rings, light rays and the win flash — the parts of a reward burst that are
 * paths rather than particles. Same one-recorded-picture approach the battle
 * scene uses (render/vfx/vfx-picture.tsx).
 */
function RewardPicture({ frame }: { frame: SharedValue<Float32Array> }) {
  const paints = useMemo(() => {
    const stroke = Skia.Paint();
    stroke.setAntiAlias(true);
    stroke.setStyle(PaintStyle.Stroke);
    stroke.setStrokeCap(StrokeCap.Round);
    stroke.setBlendMode(BlendMode.Plus);

    const fill = Skia.Paint();
    fill.setAntiAlias(true);
    fill.setBlendMode(BlendMode.Plus);

    return { stroke, fill, scratch: Float32Array.of(0, 0, 0, 0) };
  }, []);

  const picture = useDerivedValue(() => {
    const data = frame.value;
    const gBase = secOffset(data, USec.globals);
    const { stroke, fill, scratch } = paints;

    const setColor = (paint: typeof stroke, r: number, gc: number, b: number, a: number) => {
      'worklet';
      scratch[0] = r;
      scratch[1] = gc;
      scratch[2] = b;
      scratch[3] = a;
      paint.setColor(scratch);
    };

    return createPicture((canvas) => {
      // ---- rotating light rays (a big win) --------------------------------
      const raysAlpha = data[gBase + UG.raysAlpha];
      if (raysAlpha > 0.005) {
        const x = data[gBase + UG.raysX];
        const y = data[gBase + UG.raysY];
        const radius = data[gBase + UG.raysRadius];
        const step = (Math.PI * 2) / RAY_COUNT;
        const half = step * 0.22;
        const rotation = data[gBase + UG.raysRotation];

        const path = Skia.Path.Make();
        for (let i = 0; i < RAY_COUNT; i++) {
          const angle = rotation + i * step;
          path.moveTo(x, y);
          path.lineTo(x + Math.cos(angle - half) * radius, y + Math.sin(angle - half) * radius);
          path.lineTo(x + Math.cos(angle + half) * radius, y + Math.sin(angle + half) * radius);
          path.close();
        }
        // Bright at the hub, gone by the tip — a hard-edged fan reads as a bug.
        fill.setShader(
          Skia.Shader.MakeRadialGradient(
            { x, y },
            radius,
            [
              Float32Array.of(data[gBase + UG.raysR], data[gBase + UG.raysG], data[gBase + UG.raysB], raysAlpha),
              Float32Array.of(data[gBase + UG.raysR], data[gBase + UG.raysG], data[gBase + UG.raysB], 0),
            ],
            [0.05, 1],
            TileMode.Clamp,
          ),
        );
        canvas.drawPath(path, fill);
        fill.setShader(null);
      }

      // ---- rings -----------------------------------------------------------
      const ringBase = secOffset(data, USec.rings);
      const ringCount = secCount(data, USec.rings);
      for (let i = 0; i < ringCount; i++) {
        const base = ringBase + i * RR.STRIDE;
        const alpha = data[base + RR.a];
        if (alpha <= 0.004) continue;
        setColor(stroke, data[base + RR.r], data[base + RR.g], data[base + RR.b], alpha);
        stroke.setStrokeWidth(data[base + RR.width]);
        canvas.drawCircle(data[base + RR.x], data[base + RR.y], data[base + RR.radius], stroke);
      }

      // ---- win flash -------------------------------------------------------
      const flash = data[gBase + UG.flash];
      if (flash > 0.01) {
        setColor(fill, data[gBase + UG.flashR], data[gBase + UG.flashG], data[gBase + UG.flashB], flash * 0.3);
        canvas.drawRect(Skia.XYWHRect(-OVERSCAN, -OVERSCAN, OVERSCAN * 2, OVERSCAN * 2), fill);
      }
    });
  });

  return <Picture picture={picture} />;
}

/**
 * Screen-wide reward effects for the menus. Mount one per screen tree; every
 * claim button anywhere below just calls `useFxStore.burst(...)` with screen
 * coordinates and this draws it.
 *
 * The rAF loop only runs while something is on screen and shuts itself down a
 * few frames after the last particle dies, so a menu the player is just
 * reading costs nothing at all.
 *
 * Coordinates are window dp: the overlay measures its own origin and shifts
 * the scene by it, so a burst aimed at a `measureInWindow` position lands in
 * the right place no matter how deep in the layout this happens to be mounted.
 */
export function RewardOverlay() {
  const viewRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const system = useMemo(() => new RewardFxSystem(), []);

  const frameBuffer = useSharedValue(system.buffer);

  const onLayout = useCallback(() => {
    viewRef.current?.measureInWindow((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) setOrigin({ x, y });
    });
  }, []);

  useEffect(() => {
    let raf: number | null = null;
    let last: number | null = null;
    let idle = 0;

    const frame = (now: number) => {
      const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;

      const queued = useFxStore.getState().drain();
      for (const request of queued) system.burst(request);
      system.update(dt);

      frameBuffer.value = system.buffer;

      idle = system.busy || queued.length > 0 ? 0 : idle + 1;
      if (idle > IDLE_FRAMES_BEFORE_SLEEP) {
        raf = null;
        last = null;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf != null) return;
      last = null;
      idle = 0;
      raf = requestAnimationFrame(frame);
    };

    const unsubscribe = useFxStore.subscribe(() => {
      if (useFxStore.getState().queue.length > 0) start();
    });
    if (useFxStore.getState().queue.length > 0) start();

    return () => {
      unsubscribe();
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [system, frameBuffer]);

  const transform = useMemo(() => [{ translateX: -origin.x }, { translateY: -origin.y }], [origin]);

  return (
    <View ref={viewRef} onLayout={onLayout} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={transform}>
          <ParticleLayer frame={frameBuffer} section={USec.normal} capacity={UI_NORMAL_CAP} />
          <ParticleLayer frame={frameBuffer} section={USec.additive} capacity={UI_ADDITIVE_CAP} additive />
          <RewardPicture frame={frameBuffer} />
        </Group>
      </Canvas>
    </View>
  );
}
