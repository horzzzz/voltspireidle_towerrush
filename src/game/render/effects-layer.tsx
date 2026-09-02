import { Line, matchFont, Text } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { useBattleStore } from '@/game/state/battle-store';

/**
 * Bolts and damage popups render at the throttled ~10Hz publish rate, not
 * 60fps — a deliberate v1 trade-off. They're few and short-lived (a bolt
 * lives 0.18s, a popup 0.6s), so a plain React re-render here is simple and
 * correct; the performance-critical path (dozens of moving enemies) is the
 * one that gets the full shared-value treatment in enemy-atlas.tsx.
 */
export function EffectsLayer() {
  const bolts = useBattleStore((s) => s.bolts);
  const popups = useBattleStore((s) => s.damagePopups);

  const font = useMemo(
    () => matchFont({ fontFamily: Platform.OS === 'ios' ? 'Helvetica-Bold' : 'sans-serif', fontSize: 15 }),
    [],
  );
  // Bigger so a crit reads as a crit even before the player registers the
  // color — the only in-battle confirmation that Coilworks/Charge Crit
  // chance is actually doing something (see lazy-hugging-eagle plan, "Догон 1").
  const critFont = useMemo(
    () => matchFont({ fontFamily: Platform.OS === 'ios' ? 'Helvetica-Bold' : 'sans-serif', fontSize: 20 }),
    [],
  );

  return (
    <>
      {bolts.map((bolt) => (
        <Line
          key={bolt.id}
          p1={{ x: bolt.x1, y: bolt.y1 }}
          p2={{ x: bolt.x2, y: bolt.y2 }}
          color="#7fe9ff"
          strokeWidth={2.5}
          opacity={0.85}
        />
      ))}
      {popups.map((popup) => (
        <Text
          key={popup.id}
          font={popup.isCrit ? critFont : font}
          text={Math.round(popup.amount).toString() + (popup.isCrit ? '!' : '')}
          x={popup.x - (popup.isCrit ? 14 : 10)}
          y={popup.y - 12}
          color={popup.isCrit ? '#ffcf3a' : popup.isBoss ? '#ff5c5c' : '#ffffff'}
        />
      ))}
    </>
  );
}
