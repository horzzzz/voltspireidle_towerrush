import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SplashBackground } from '@/components/splash/splash-background';
import { Fonts, SplashColors } from '@/constants/theme';

const LOGO_ASSET = require('@/assets/images/splash/logo.png');
const WELCOME_ASSET = require('@/assets/images/splash/welcome.png');
const READY_ASSET = require('@/assets/images/splash/ready.png');

const PROGRESS_MS = 2000;

type LoadingScreenProps = {
  onDone: () => void;
};

/** Progress screen shown right after the native splash (Figma node 1:4). */
export function LoadingScreen({ onDone }: LoadingScreenProps) {
  const progress = useSharedValue(0);
  const done = useRef(false);

  useEffect(() => {
    progress.value = withTiming(100, { duration: PROGRESS_MS });
    // Advance on a plain timer rather than the animation's completion
    // callback -- the visual bar is decorative; this is the source of truth.
    const timer = setTimeout(() => {
      if (!done.current) {
        done.current = true;
        onDone();
      }
    }, PROGRESS_MS);
    return () => clearTimeout(timer);
  }, [progress, onDone]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value}%` }));

  return (
    <View style={styles.container}>
      <SplashBackground />

      <SafeAreaView style={styles.safeArea}>
        <Image source={LOGO_ASSET} style={styles.logo} contentFit="contain" />

        <View style={styles.middle}>
          <Image source={WELCOME_ASSET} style={styles.welcome} contentFit="contain" />
          <Image source={READY_ASSET} style={styles.ready} contentFit="contain" />
        </View>

        <View style={styles.footer}>
          <Text style={styles.loadingLabel}>Loading...</Text>

          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]}>
              <LinearGradient
                colors={[SplashColors.fillFrom, SplashColors.fillTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.fillShadow} pointerEvents="none" />
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SplashColors.bg },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: '82%',
    aspectRatio: 1214 / 632,
    marginTop: 24,
  },
  middle: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  welcome: {
    width: '86%',
    aspectRatio: 2045 / 460,
  },
  ready: {
    width: '68%',
    aspectRatio: 1908 / 622,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 24,
  },
  loadingLabel: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 24,
    color: SplashColors.text,
    textTransform: 'uppercase',
  },
  track: {
    width: '86%',
    height: 32,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: SplashColors.trackBorder,
    backgroundColor: SplashColors.track,
    padding: 6,
    justifyContent: 'center',
  },
  fill: {
    height: 20,
    minWidth: 20,
    borderRadius: 31,
    overflow: 'hidden',
  },
  // Approximates the design's inset shadow (0, -5, 5.5, rgba(0,0,0,0.25)).
  fillShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth * 4,
    borderColor: 'rgba(0,0,0,0.25)',
  },
});
