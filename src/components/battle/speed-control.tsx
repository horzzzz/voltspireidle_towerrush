import { Pressable, StyleSheet, Text } from 'react-native';

import { BattleColors, Fonts, MenuColors } from '@/constants/theme';
import { useBattleStore } from '@/game/state/battle-store';
import type { SpeedMultiplier } from '@/game/render/use-battle-engine';

const CYCLE: SpeedMultiplier[] = [1, 2, 3];

function nextSpeed(current: SpeedMultiplier): SpeedMultiplier {
  const index = CYCLE.indexOf(current);
  return CYCLE[(index + 1) % CYCLE.length];
}

/**
 * Game-speed toggle — the engine (`world.speedMultiplier`, `actions.setSpeed`)
 * has supported this since the first battle-screen pass, but nothing in the
 * Figma HUD (node 1:1512) is a speed control (its two pills are rewarded-ad
 * bonuses, see `ad-bonus-pill.tsx`), so this is an original piece styled to
 * match the rest of the HUD rather than a traced Figma node. Tapping cycles
 * ×1 → ×2 → ×3 → ×1.
 */
export function SpeedControl({ onSetSpeed }: { onSetSpeed: (multiplier: SpeedMultiplier) => void }) {
  const speed = useBattleStore((s) => s.speedMultiplier) as SpeedMultiplier;

  return (
    <Pressable
      onPress={() => onSetSpeed(nextSpeed(speed))}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
      <Text style={styles.text}>×{speed}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 38,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BattleColors.chargeAccent,
    backgroundColor: 'rgba(20,30,42,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  text: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 13,
    color: MenuColors.text,
  },
});
