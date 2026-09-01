import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { SplashColors } from '@/constants/theme';

const BG_ASSET = require('@/assets/images/splash/bg.png');

/**
 * Full-bleed backdrop shared by the loading and start splash screens
 * (Figma node 1:1760). Drawn edge-to-edge behind the status bar / home
 * indicator, on a solid black ground so any letterboxing stays black.
 */
export function SplashBackground() {
  return (
    <View style={styles.container}>
      <Image source={BG_ASSET} style={StyleSheet.absoluteFill} contentFit="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SplashColors.bg,
    overflow: 'hidden',
  },
});
