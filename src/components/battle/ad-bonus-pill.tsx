import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { GamePressable } from '@/components/ui/game-pressable';

type AdBonusPillProps = {
  source: number;
  aspectRatio: number;
  onPress?: () => void;
};

/**
 * Rewarded-video bonus pill (Figma nodes 1:1532 "price" and 1:1527 "button").
 * Text/icon are baked into the art since they're fixed labels, not live
 * values. Inert for now — ads aren't wired up yet, matching how the main
 * menu's identical pill (`icon-video.png` in index.tsx) is a no-op today too.
 */
export function AdBonusPill({ source, aspectRatio, onPress }: AdBonusPillProps) {
  return (
    <GamePressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.pill, { aspectRatio }, pressed && styles.pressed]}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="fill" />
    </GamePressable>
  );
}

const styles = StyleSheet.create({
  pill: { height: 24 },
  pressed: { opacity: 0.75 },
});
