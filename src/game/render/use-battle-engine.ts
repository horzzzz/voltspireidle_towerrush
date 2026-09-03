import { useEffect, useMemo, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { buyUpgrade as buyUpgradeAction } from '../core/upgrades';
import { advanceSimulation, createWorld, retireRun, setSpeedMultiplier } from '../core/world';
import type { RunLoadout, UpgradeId } from '../core/types';
import { getTowerMaxHealth } from '../data/tower-stats';
import { useBattleStore } from '../state/battle-store';
import { BSEC_COUNT, BSec, buildFrame } from '../vfx/frame-buffer';
import { BR, G, NR, PR, RR } from '../vfx/layout';
import { VfxSystem } from '../vfx/system';
import { BOSS_RENDER_SCALE, ENEMY_RENDER_SCALE } from './enemy-atlas';
import { countEnemySections, FIELDS_PER_SLOT, packEnemiesInto } from './enemy-buffers';
import { PerfFlags, useFrameProfiler, useUiFrameMonitor } from './perf-monitor';

export type SpeedMultiplier = 1 | 2 | 3;

/** HUD publish rate — the sim itself always runs at FIXED_DT (60Hz). */
const PUBLISH_INTERVAL_MS = 100;
/** Caps a single frame's delta so a backgrounded tab / GC pause can't dump a huge chunk of sim time at once. */
const MAX_FRAME_DT = 0.25;

/**
 * Floats per entry in each frame-buffer section, indexed by `BSec`. Built once
 * at module load — `buildFrame` reads it 60 times a second.
 */
const SECTION_STRIDES = (() => {
  const strides = new Int32Array(BSEC_COUNT);
  strides[BSec.globals] = G.STRIDE;
  strides[BSec.scavenger] = FIELDS_PER_SLOT;
  strides[BSec.hulk] = FIELDS_PER_SLOT;
  strides[BSec.runner] = FIELDS_PER_SLOT;
  strides[BSec.boss0] = FIELDS_PER_SLOT;
  strides[BSec.boss1] = FIELDS_PER_SLOT;
  strides[BSec.boss2] = FIELDS_PER_SLOT;
  strides[BSec.additive] = PR.STRIDE;
  strides[BSec.normal] = PR.STRIDE;
  strides[BSec.numbers] = NR.STRIDE;
  strides[BSec.beams] = BR.STRIDE;
  strides[BSec.rings] = RR.STRIDE;
  return strides;
})();

/**
 * Owns the whole battle: the mutable sim world (outside React, in a ref), the
 * single Reanimated frame buffer the canvas reads at 60fps — enemy positions
 * *and* every VFX pool — and the throttled publish into `battle-store` that
 * the HUD reads from. One instance per battle screen.
 *
 * The split matters: HUD text can lag a tenth of a second without anyone
 * noticing, but an effect that only exists in one 10Hz snapshot can never be
 * animated. So effects go the same way enemy positions always have — straight
 * from the sim into a shared value, drained and advanced every single frame,
 * never through React.
 *
 * One shared value, not ten: each publish copies its array twice (once into a
 * C++ vector here, once into a fresh `ArrayBuffer` on the UI runtime), and
 * ten fixed-capacity buffers a frame grew the JS heap fast enough that Hermes
 * ran a full, ~150ms stop-the-world collection every ten seconds. That was
 * the micro-freeze. See vfx/frame-buffer.ts.
 */
export function useBattleEngine(loadout: RunLoadout) {
  // `seed` omitted (not `Date.now()` inline) — the React Compiler flags a
  // literal impure-function call sitting in the render body; the default
  // param inside `createWorld` itself isn't visible to that check.
  const worldRef = useRef(createWorld(undefined, loadout));
  const publish = useBattleStore((s) => s.publish);

  const vfx = useMemo(() => new VfxSystem(), []);

  // Scratch, reused forever: how many live entries each section holds this
  // frame, and the per-section write cursors the enemy packer walks. Neither
  // ever crosses a thread, so neither has to be reallocated.
  const counts = useMemo(() => new Int32Array(BSEC_COUNT), []);
  const cursors = useMemo(() => new Int32Array(BSEC_COUNT), []);

  // The single buffer the whole scene reads — enemies, particles, numbers,
  // beams, rings and globals, sized every frame to what is actually alive.
  // Seeded with an empty frame so the canvas has a valid header to read
  // before the first tick. See vfx/frame-buffer.ts for why this is one
  // exactly-sized array rather than ten fixed-capacity ones.
  const frameBuffer = useSharedValue(
    useMemo(() => {
      // Globals must be present even in the seed frame: `BattleCanvas` reads
      // the camera shake out of it before the first tick, and a zero-count
      // section would hand it `undefined` rather than 0.
      const seed = new Int32Array(BSEC_COUNT);
      seed[BSec.globals] = 1;
      return buildFrame(seed, SECTION_STRIDES, BSEC_COUNT);
    }, []),
  );

  const lastFrameRef = useRef<number | null>(null);
  const lastPublishRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // __DEV__-only frame timing. The profiler logs the *individual* frames that
  // ran long (with their stage split and the unaccounted-for remainder) rather
  // than a rolling average, which is the only shape that can catch a periodic
  // stall. See render/perf-monitor.ts.
  const profiler = useFrameProfiler('battle');
  useUiFrameMonitor('battle');

  useEffect(() => {
    publish(worldRef.current);

    const frame = (now: number) => {
      const last = lastFrameRef.current;
      lastFrameRef.current = now;
      const dt = last == null ? 0 : Math.min(MAX_FRAME_DT, (now - last) / 1000);

      const world = worldRef.current;
      const perf = PerfFlags.enabled;

      const t0 = perf ? performance.now() : 0;
      if (dt > 0) advanceSimulation(world, dt);
      const t1 = perf ? performance.now() : 0;

      // Effects run on the sim's clock, not the wall clock — at x3 a burst
      // has to clear three times as fast or the field silts up.
      if (PerfFlags.vfxSystem) {
        const maxHealth = getTowerMaxHealth(world.tower.levels, world.loadout);
        vfx.update(dt * world.speedMultiplier, world.vfx, world.vfxCount, {
          enemyCount: world.enemies.length,
          hpFraction: maxHealth > 0 ? world.tower.health / maxHealth : 0,
        });
      }
      // Rewind the queue, don't empty it — the records are pooled and get
      // refilled next tick (core/types.ts `emitVfx`).
      world.vfxCount = 0;
      const t2 = perf ? performance.now() : 0;

      // Size the frame from what survived this tick, then fill it. Counting
      // before allocating is what keeps an empty field from paying for 320
      // dead particle slots — the allocation, not the packing, is what used
      // to stall this thread.
      counts.fill(0);
      counts[BSec.globals] = 1;
      countEnemySections(world, counts);
      if (PerfFlags.vfxSystem) {
        if (PerfFlags.particles) {
          counts[BSec.additive] = vfx.additiveAlive;
          counts[BSec.normal] = vfx.normalAlive;
        }
        counts[BSec.numbers] = vfx.numberAlive;
        counts[BSec.beams] = vfx.beamAlive;
        counts[BSec.rings] = vfx.ringAlive;
      }

      const packed = buildFrame(counts, SECTION_STRIDES, BSEC_COUNT);
      packEnemiesInto(packed, world, ENEMY_RENDER_SCALE, BOSS_RENDER_SCALE, cursors);
      if (PerfFlags.vfxSystem) vfx.packInto(packed);
      const t3 = perf ? performance.now() : 0;

      frameBuffer.value = packed;

      if (perf) {
        const t4 = performance.now();
        profiler.record(
          now,
          t1 - t0,
          t2 - t1,
          t3 - t2,
          t4 - t3,
          packed.length,
          world.enemies.length,
          world.wave,
          world.wavePhase,
          world.phaseTimeLeft,
        );
      }

      if (now - lastPublishRef.current >= PUBLISH_INTERVAL_MS) {
        lastPublishRef.current = now;
        publish(world);
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // Mount-once RAF loop: `publish` (zustand action) and the shared values
    // are stable references for the component's lifetime, so this correctly
    // has nothing to react to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions = useMemo(
    () => ({
      buyUpgrade: (id: UpgradeId) => {
        const result = buyUpgradeAction(worldRef.current, id);
        publish(worldRef.current);
        return result;
      },
      setSpeed: (multiplier: SpeedMultiplier) => {
        setSpeedMultiplier(worldRef.current, multiplier);
        publish(worldRef.current);
      },
      retire: () => {
        retireRun(worldRef.current);
        publish(worldRef.current);
      },
      restart: () => {
        worldRef.current = createWorld(Date.now(), loadout);
        // Leftover sparks from the previous run would otherwise hang in the
        // air over the new one's first frames.
        vfx.reset();
        publish(worldRef.current);
      },
    }),
    [publish, loadout, vfx],
  );

  return { frame: frameBuffer, actions };
}
