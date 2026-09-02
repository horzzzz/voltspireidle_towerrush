import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LuckWheel } from '@/components/wheel/luck-wheel';
import { TopBar } from '@/components/menu/top-bar';
import { SplashBackground } from '@/components/splash/splash-background';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatNumber } from '@/game/core/numbers';
import { WHEEL_COOLDOWN_MS, WHEEL_SECTORS, WHEEL_SECTOR_DEGREES } from '@/game/data/wheel';
import { useMetaStore } from '@/game/state/meta-store';

const PILL = require('@/assets/images/ui/pill-button.png');

const SPIN_MS = 4200;
const SPIN_LAPS = 6;
const close = () => router.back();

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}H:${String(m).padStart(2, '0')}M:${String(s).padStart(2, '0')}S`;
}

/** Rotation (deg) that brings sector `index`'s center under the fixed top pointer. */
function targetRotationForSector(currentRotation: number, index: number): number {
  const desiredMod = (360 - index * WHEEL_SECTOR_DEGREES) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  const delta = ((desiredMod - currentMod) % 360 + 360) % 360;
  return currentRotation + 360 * SPIN_LAPS + delta;
}

function sectorLabel(sector: (typeof WHEEL_SECTORS)[number]): string {
  if (sector.kind === 'fail') return 'No luck this time';
  if (sector.kind === 'free_spin') return 'Free spin!';
  return `+${sector.amount} ${sector.kind === 'gems' ? 'gems' : 'scrap'}`;
}

/** Wheel of Luck (Figma nodes 1:1473 / 1:1492). */
export default function WheelScreen() {
  const insets = useSafeAreaInsets();
  const rotation = useSharedValue(0);
  const [spinning, setSpinning] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const wheel = useMetaStore((s) => s.wheel);
  const clockHighWater = useMetaStore((s) => s.clockHighWater);
  const spinWheel = useMetaStore((s) => s.spinWheel);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const effectiveNowMs = Math.max(now, clockHighWater);
  const cooldownRemaining = WHEEL_COOLDOWN_MS - (effectiveNowMs - wheel.lastSpinAt);
  const onCooldown = wheel.freeSpins === 0 && cooldownRemaining > 0;
  const spinDisabled = spinning || onCooldown;

  const spin = () => {
    if (spinDisabled) return;
    const outcome = spinWheel();
    if (!outcome) return;

    setSpinning(true);
    setResultText(null);
    const target = targetRotationForSector(rotation.value, outcome.sectorIndex);
    // `withTiming`'s completion callback runs on the UI thread (a worklet) —
    // `sectorLabel` is a plain JS function, so it must be called *inside* the
    // runOnJS-wrapped callback (JS thread), never applied to its result out
    // here. Calling it out here crashed with "Tried to synchronously call a
    // Remote Function" the moment a spin landed.
    const finishSpin = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(applySpinResult)(outcome.sector);
    };
    rotation.value = withTiming(target, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) }, finishSpin);
  };

  const applySpinResult = (sector: (typeof WHEEL_SECTORS)[number]) => {
    setSpinning(false);
    setResultText(sectorLabel(sector));
  };

  return (
    <View style={styles.container}>
      <SplashBackground />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}>
        <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={() => {}} />

        <Text style={styles.title}>Wheel of luck</Text>

        <View style={styles.wheelWrap}>
          <LuckWheel rotation={rotation} />
        </View>

        <View style={styles.footer}>
          {resultText && !spinning && <Text style={styles.resultText}>{resultText}</Text>}
          {wheel.freeSpins > 0 && <Text style={styles.timer}>{wheel.freeSpins} free spin(s) available</Text>}
          {onCooldown && <Text style={styles.timer}>Next spin in {formatCountdown(cooldownRemaining)}</Text>}

          <Pressable
            onPress={spin}
            disabled={spinDisabled}
            style={({ pressed }) => [styles.pill, pressed && !spinDisabled && styles.pressed]}>
            <Image source={PILL} style={styles.pillImg} contentFit="fill" />
            <Text style={[styles.freeSpinText, spinDisabled && styles.disabledText]}>
              {spinning ? 'Spinning…' : wheel.freeSpins > 0 ? 'Free spin' : 'Spin'}
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
  resultText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 17,
    color: MenuColors.accentBright,
    textTransform: 'uppercase',
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
