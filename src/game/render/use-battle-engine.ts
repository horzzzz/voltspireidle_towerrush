import { useEffect, useMemo, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { buyUpgrade as buyUpgradeAction } from '../core/upgrades';
import { advanceSimulation, createWorld, retireRun, setSpeedMultiplier } from '../core/world';
import type { UpgradeId } from '../core/types';
import { useBattleStore } from '../state/battle-store';
import { ENEMY_RENDER_SCALE } from './enemy-atlas';
import { createEmptyEnemyBuffers, packEnemyBuffers } from './enemy-buffers';

export type SpeedMultiplier = 1 | 2 | 3;

/** HUD/effects publish rate — the sim itself always runs at FIXED_DT (60Hz). */
const PUBLISH_INTERVAL_MS = 100;
/** Caps a single frame's delta so a backgrounded tab / GC pause can't dump a huge chunk of sim time at once. */
const MAX_FRAME_DT = 0.25;

/**
 * Owns the whole battle: the mutable sim world (outside React, in a ref),
 * the three per-kind Reanimated buffers the canvas reads at 60fps, and the
 * throttled publish into `battle-store` that everything else (HUD, upgrade
 * bar, overlays) reads from. One instance per battle screen.
 */
export function useBattleEngine() {
  const worldRef = useRef(createWorld());
  const publish = useBattleStore((s) => s.publish);

  const scavengerBuffer = useSharedValue(createEmptyEnemyBuffers().scavenger);
  const hulkBuffer = useSharedValue(createEmptyEnemyBuffers().hulk);
  const runnerBuffer = useSharedValue(createEmptyEnemyBuffers().runner);

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

      // Fresh arrays every frame — see enemy-buffers.ts on why a new
      // reference (not an in-place mutation) is what makes the Atlas
      // buffers' Reanimated mapper actually re-run.
      const packed = packEnemyBuffers(world, ENEMY_RENDER_SCALE);
      scavengerBuffer.value = packed.scavenger;
      hulkBuffer.value = packed.hulk;
      runnerBuffer.value = packed.runner;

      if (now - lastPublishRef.current >= PUBLISH_INTERVAL_MS) {
        lastPublishRef.current = now;
        publish(world);
        // Drain right after the snapshot is taken — see combat.ts's
        // pruneCombatState for why bolts/popups accumulate instead of
        // being time-pruned on the sim's own clock.
        world.bolts = [];
        world.damagePopups = [];
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
        worldRef.current = createWorld();
        publish(worldRef.current);
      },
    }),
    [publish],
  );

  return {
    buffers: { scavenger: scavengerBuffer, hulk: hulkBuffer, runner: runnerBuffer },
    actions,
  };
}
