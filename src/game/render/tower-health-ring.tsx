import { Circle, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { BattleColors } from '@/constants/theme';
import { ATTACK_RANGE, TOWER_BODY_RADIUS, TOWER_X, TOWER_Y } from '@/game/data/arena';
import { useBattleStore } from '@/game/state/battle-store';

/** Sits between the tower art and the dashed attack-range ring — clear of both. */
export const RING_RADIUS = (TOWER_BODY_RADIUS + ATTACK_RANGE) / 2;
const STROKE_WIDTH = 5;

function ringColor(fraction: number): string {
  if (fraction > 0.5) return BattleColors.hpFull;
  if (fraction > 0.25) return BattleColors.hpMid;
  return BattleColors.hpLow;
}

/**
 * Tower HP, drawn as a depleting ring around the tower rather than an RN
 * overlay: nothing in the Figma battle screen (node 1:1512) shows tower HP
 * at all, and a Skia ring guarantees it lines up with the tower regardless
 * of device aspect ratio, where an RN element positioned over the canvas
 * could drift (the canvas's design-space scale doesn't necessarily match
 * the RN overlay's own layout box). Reads the throttled ~10Hz battle-store
 * publish, same as the bolt/damage-popup effects layer — no need for the
 * 60fps shared-value path that enemy positions use.
 */
export function TowerHealthRing() {
  const health = useBattleStore((s) => s.towerHealth);
  const maxHealth = useBattleStore((s) => s.towerMaxHealth);
  const fraction = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;

  const arcPath = useMemo(() => {
    const rect = Skia.XYWHRect(TOWER_X - RING_RADIUS, TOWER_Y - RING_RADIUS, RING_RADIUS * 2, RING_RADIUS * 2);
    const path = Skia.Path.Make();
    // Starts at 12 o'clock, sweeps clockwise as a fraction of the full circle.
    path.addArc(rect, -90, 360 * fraction);
    return path;
  }, [fraction]);

  return (
    <>
      <Circle
        cx={TOWER_X}
        cy={TOWER_Y}
        r={RING_RADIUS}
        style="stroke"
        strokeWidth={STROKE_WIDTH}
        color="rgba(255,255,255,0.12)"
      />
      {fraction > 0 && (
        <Path
          path={arcPath}
          style="stroke"
          strokeWidth={STROKE_WIDTH}
          strokeCap="round"
          color={ringColor(fraction)}
        />
      )}
    </>
  );
}
