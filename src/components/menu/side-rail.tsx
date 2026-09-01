import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

const BUTTON_BG = require('@/assets/images/menu/rail-button.png');

const ITEMS = [
  { key: 'settings', icon: require('@/assets/images/menu/rail-settings.png') },
  { key: 'daily', icon: require('@/assets/images/menu/rail-daily.png') },
  { key: 'shop', icon: require('@/assets/images/menu/rail-shop.png') },
  { key: 'wheel', icon: require('@/assets/images/menu/rail-wheel.png') },
] as const;

const BUTTON_W = 48;
const BUTTON_H = BUTTON_W * (193 / 206); // rail-button.png aspect

/** Vertical rail of quick-action buttons on the right (Figma node 1:114). */
export function SideRail({ onPress }: { onPress?: (key: string) => void }) {
  return (
    <View style={styles.rail}>
      {ITEMS.map((item) => (
        <Pressable key={item.key} onPress={() => onPress?.(item.key)} style={styles.button} hitSlop={4}>
          <Image source={BUTTON_BG} style={StyleSheet.absoluteFill} contentFit="fill" />
          <Image source={item.icon} style={styles.icon} contentFit="contain" />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: 6,
    alignItems: 'center',
  },
  button: {
    width: BUTTON_W,
    height: BUTTON_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: BUTTON_W * 0.5,
    height: BUTTON_H * 0.5,
  },
});
