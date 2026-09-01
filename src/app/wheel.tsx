import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LuckWheel } from '@/components/wheel/luck-wheel';
import { TopBar } from '@/components/menu/top-bar';
import { SplashBackground } from '@/components/splash/splash-background';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';

const PILL = require('@/assets/images/ui/pill-button.png');

const SPIN_MS = 4200;
const close = () => router.back();

/** Wheel of Luck (Figma nodes 1:1473 / 1:1492). Spin outcome is a stub. */
export default function WheelScreen() {
  const insets = useSafeAreaInsets();
  const rotation = useSharedValue(0);
  const [spinning, setSpinning] = useState(false);
  const [onCooldown, setOnCooldown] = useState(false);

  const spin = () => {
    if (spinning || onCooldown) return;
    setSpinning(true);
    const target = rotation.value + 360 * 6 + Math.floor(Math.random() * 360);
    rotation.value = withTiming(
      target,
      { duration: SPIN_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setSpinning)(false);
          runOnJS(setOnCooldown)(true);
        }
      },
    );
  };

  const freeSpinDisabled = spinning || onCooldown;

  return (
    <View style={styles.container}>
      <SplashBackground />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}>
        <TopBar scrap="0" gems="0" onEnergyPress={() => {}} />

        <Text style={styles.title}>Wheel of luck</Text>

        <View style={styles.wheelWrap}>
          <LuckWheel rotation={rotation} />
        </View>

        <View style={styles.footer}>
          {onCooldown && <Text style={styles.timer}>23H:59M:00S</Text>}

          <Pressable
            onPress={spin}
            disabled={freeSpinDisabled}
            style={({ pressed }) => [styles.pill, pressed && !freeSpinDisabled && styles.pressed]}>
            <Image source={PILL} style={styles.pillImg} contentFit="fill" />
            <Text style={[styles.freeSpinText, freeSpinDisabled && styles.disabledText]}>
              {spinning ? 'Spinning…' : 'Free spin'}
            </Text>
          </Pressable>

          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.pillBack, pressed && styles.pressed]}>
            <Image source={PILL} style={styles.pillImg} contentFit="fill" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MenuColors.bg },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MenuMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 24,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  wheelWrap: {
    width: '100%',
    maxWidth: 360,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
    gap: 14,
  },
  timer: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 14,
    color: MenuColors.text,
    letterSpacing: 1,
  },
  pill: {
    width: '78%',
    aspectRatio: 630 / 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBack: {
    width: '62%',
    aspectRatio: 630 / 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pressed: { transform: [{ scale: 0.96 }] },
  freeSpinText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 17,
    lineHeight: 20,
    color: '#ff8a1e',
    textTransform: 'uppercase',
  },
  disabledText: { color: 'rgba(255,255,255,0.4)' },
  backText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 14,
    lineHeight: 17,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
});
