import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

const BG = require('@/assets/images/battle/settings-bg.png');
const GEAR = require('@/assets/images/battle/settings-gear.png');

/** Opens the in-battle settings overlay (Figma nodes 1:1525 / 1:1526). */
export function SettingsButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="fill" />
      <Image source={GEAR} style={styles.gear} contentFit="contain" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  gear: { width: 19, height: 20 },
});
