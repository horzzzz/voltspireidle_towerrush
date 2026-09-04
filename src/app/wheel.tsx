import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RewardOverlay } from '@/components/fx/reward-overlay';
import { TopBar } from '@/components/menu/top-bar';
import { SplashBackground } from '@/components/splash/splash-background';
import { GamePressable } from '@/components/ui/game-pressable';
import { LuckWheel } from '@/components/wheel/luck-wheel';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { playSfx, startWheelLoop, stopWheelLoop } from '@/game/audio/engine';
import { formatNumber } from '@/game/core/numbers';
import { WHEEL_COOLDOWN_MS, WHEEL_SECTORS, WHEEL_SECTOR_DEGREES } from '@/game/data/wheel';
import { useFxStore } from '@/game/state/fx-store';
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

/**
 * How big a deal the prize is, 1 = the smallest win. Above ~1.5 the burst
 * upgrades itself to the full treatment (light rays + screen flash), so the
 * rare 100-scrap and 20-gem wedges actually feel different from a 10-gem one.
 */
function sectorPower(sector: (typeof WHEEL_SECTORS)[number]): number {
  if (sector.kind === 'gems') return sector.amount >= 20 ? 2.2 : sector.amount >= 15 ? 1.6 : 1.2;
  if (sector.kind === 'scrap') return sector.amount >= 100 ? 2.2 : 1.4;
  return 1.5;
}

/** Wheel of Luck (Figma nodes 1:1473 / 1:1492). */
export default function WheelScreen() {
  const insets = useSafeAreaInsets();
  const rotation = useSharedValue(0);
  const [spinning, setSpinning] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ sector: (typeof WHEEL_SECTORS)[number] } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const wheel = useMetaStore((s) => s.wheel);
  const clockHighWater = useMetaStore((s) => s.clockHighWater);
  const spinWheel = useMetaStore((s) => s.spinWheel);
  const claimWheelReward = useMetaStore((s) => s.claimWheelReward);

  // Where the wheel actually sits on screen, so a win's burst originates from
  // the hub rather than from an arbitrary corner.
  const wheelRef = useRef<View>(null);
  const wheelCenter = useRef({ x: 0, y: 0 });
  const measureWheel = useCallback(() => {
    wheelRef.current?.measureInWindow((x, y, width, height) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        wheelCenter.current = { x: x + width / 2, y: y + height / 2 };
      }
    });
  }, []);

  const wheelShake = useSharedValue(0);
  const resultScale = useSharedValue(0);


  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Closing the sheet mid-spin would otherwise leave the rattle playing over
  // the hub for the rest of the clip, with no wheel on screen to explain it.
  useEffect(() => stopWheelLoop, []);

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
    setOutcome(null);
    startWheelLoop();
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

  // The spin's landing is published as state and reacted to in an effect,
  // rather than animated straight from the callback: a fresh object identity
  // is what re-fires the reaction, and it keeps every shared-value write on
  // the one code path the React Compiler is happy to see them on.
  const applySpinResult = (sector: (typeof WHEEL_SECTORS)[number]) => {
    // Fades the rattle out rather than cutting it — the wheel eases to a stop
    // and the clip is almost always still ringing when it gets there.
    stopWheelLoop();
    setSpinning(false);
    setResultText(sectorLabel(sector));
    setOutcome({ sector });
  };

  useEffect(() => {
    if (outcome === null) {
      resultScale.value = 0;
      return;
    }

    const { sector } = outcome;
    resultScale.value = withSequence(
      withTiming(1.3, { duration: 150, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 8, stiffness: 200 }),
    );

    // The wheel has actually stopped now — this is the moment the prize
    // (scrap/gems/an extra free spin) actually lands in the player's meta
    // state, not back when they tapped the button.
    claimWheelReward(sector);

    const { anchors, burst } = useFxStore.getState();
    const from = wheelCenter.current;

    if (sector.kind === 'fail') {
      // No prize — the wheel just sags and shudders.
      playSfx('wheel-fail');
      burst({ kind: 'fail', from });
      wheelShake.value = withSequence(
        withTiming(-7, { duration: 55 }),
        withTiming(6, { duration: 55 }),
        withTiming(-4, { duration: 55 }),
        withTiming(0, { duration: 70 }),
      );
      return;
    }

    const power = sectorPower(sector);
    playSfx('wheel-win');
    if (sector.kind === 'gems') burst({ kind: 'gems', from, to: anchors.gems ?? null, power });
    else if (sector.kind === 'scrap') burst({ kind: 'scrap', from, to: anchors.scrap ?? null, power });
    else burst({ kind: 'charge', from, to: null, power });
  }, [outcome, resultScale, wheelShake, claimWheelReward]);

  // Declared after every write to the shared values above: the React Compiler
  // freezes a value the moment it is captured by a hook, so a `useAnimatedStyle`
  // placed earlier would make each `.value =` below it an error.
  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: wheelShake.value }] }));
  const resultStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, resultScale.value),
    transform: [{ scale: resultScale.value }],
  }));

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

        <Animated.View ref={wheelRef} onLayout={measureWheel} style={[styles.wheelWrap, wheelStyle]}>
          <LuckWheel rotation={rotation} spinning={spinning} />
        </Animated.View>

        <View style={styles.footer}>
          {resultText && !spinning && (
            <Animated.Text style={[styles.resultText, resultStyle]}>{resultText}</Animated.Text>
          )}
          {wheel.freeSpins > 0 && <Text style={styles.timer}>{wheel.freeSpins} free spin(s) available</Text>}
          {onCooldown && <Text style={styles.timer}>Next spin in {formatCountdown(cooldownRemaining)}</Text>}

          <GamePressable
            onPress={spin}
            disabled={spinDisabled}
            style={({ pressed }) => [styles.pill, pressed && !spinDisabled && styles.pressed]}>
            <Image source={PILL} style={styles.pillImg} contentFit="fill" />
            <Text style={[styles.freeSpinText, spinDisabled && styles.disabledText]}>
              {spinning ? 'Spinning…' : wheel.freeSpins > 0 ? 'Free spin' : 'Spin'}
            </Text>
          </GamePressable>

          <GamePressable
            onPress={close}
            sfx="ui-back"
            style={({ pressed }) => [styles.pillBack, pressed && styles.pressed]}>
            <Image source={PILL} style={styles.pillImg} contentFit="fill" />
            <Text style={styles.backText}>Back</Text>
          </GamePressable>
        </View>
      </ScrollView>

      <RewardOverlay />
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
