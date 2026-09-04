import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GamePressable } from '@/components/ui/game-pressable';
import { ADS_ENABLED } from '@/constants/features';
import { BattleColors, Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatInt, formatNumber } from '@/game/core/numbers';
import type { RunSummary } from '@/game/core/types';

const TITLE = require('@/assets/images/battle/run-over-title.png');
const PILL = require('@/assets/images/ui/pill-button.png');
const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');
const VIDEO_ICON = require('@/assets/images/menu/icon-video.png');

const noop = () => {};

/** How long the stat counters take to roll up to their final value. */
const COUNT_UP_MS = 850;

/**
 * Rolls a number up from zero on mount. A run's numbers are the only thing
 * this screen is about, so they arrive rather than simply being there.
 *
 * Plain React state on a rAF rather than a Reanimated value: the output is
 * text that has to go through `formatNumber`, which means a re-render either
 * way, and ~50 of them over less than a second on a screen with nothing else
 * happening is not worth a worklet-side text node to avoid.
 */
function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      // Ease-out, so it sprints and then settles onto the real figure.
      setValue(target * (1 - (1 - t) ** 3));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else setValue(target);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return value;
}

type GameOverProps = {
  result: RunSummary | null;
  onRestart: () => void;
  /** The run has already ended here — no confirmation needed, unlike the in-battle settings' "To menu". */
  onExit: () => void;
};

/**
 * Run-end overlay (Figma node 1:1689). "Retired" reuses the same RUN OVER
 * title as a defeat — the original's own copy treats retiring as identical
 * to dying ("you'll keep everything earned so far, same as a defeat"), so
 * there's no separate asset or copy for it. "To menu" isn't in the design
 * (only x2-scrap and Restart are) — added per request, styled as a quieter
 * text link so it doesn't compete with the two primary pill buttons.
 *
 * A plain absolute-fill overlay, not RN's `<Modal>` — see battle-settings.tsx
 * for why: the battle screen is itself a `fullScreenModal` route, and RN's
 * own Modal nested inside it is what caused every button on the *next* run
 * to stop responding after leaving through here.
 */
export function GameOver({ result, onRestart, onExit }: GameOverProps) {
  const visible = result != null;

  // No native Modal means no built-in Android back-button handling —
  // treat hardware back the same as tapping "To menu".
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [visible, onExit]);

  // Mounted only while there is a result, so the entry animation and the stat
  // counters start from zero every run without any manual resetting.
  if (!result) return null;
  return <RunOverPanel result={result} onRestart={onRestart} onExit={onExit} />;
}

function RunOverPanel({ result, onRestart, onExit }: GameOverProps & { result: RunSummary }) {
  const backdrop = useSharedValue(0);
  const titleScale = useSharedValue(0.6);
  const statsReveal = useSharedValue(0);

  const wave = useCountUp(result.waveReached);
  const scrap = useCountUp(result.scrapEarned);
  const gems = useCountUp(result.gemsCollected);

  useEffect(() => {
    backdrop.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) });
    // The title lands hard, overshoots, and settles — the run just ended.
    titleScale.value = withSequence(
      withTiming(1.16, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 9, stiffness: 190 }),
    );
    statsReveal.value = withDelay(200, withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }));
  }, [backdrop, titleScale, statsReveal]);

  // Declared below every write above: the React Compiler freezes a shared
  // value the moment a hook captures it, so an animated style placed earlier
  // would turn each `.value =` in the effect into an error.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const titleStyle = useAnimatedStyle(() => ({ transform: [{ scale: titleScale.value }] }));
  const statsStyle = useAnimatedStyle(() => ({
    opacity: statsReveal.value,
    transform: [{ translateY: (1 - statsReveal.value) * 14 }],
  }));

  return (
    <Animated.View style={[styles.backdrop, backdropStyle]}>
      <View style={styles.content}>
        <Animated.View style={[styles.titleWrap, titleStyle]}>
          <Image source={TITLE} style={styles.title} contentFit="contain" />
        </Animated.View>

        <Animated.View style={[styles.stats, statsStyle]}>
          <Text style={styles.stat} numberOfLines={1} adjustsFontSizeToFit>
            Wave reached: <Text style={styles.statValue}>{formatInt(wave)}</Text>
          </Text>
          <Text style={styles.stat} numberOfLines={1} adjustsFontSizeToFit>
            Scrap earned: <Text style={styles.statValue}>{formatNumber(scrap)}</Text>
          </Text>
          {result.gemsCollected > 0 && (
            <View style={styles.gemsRow}>
              <Text style={styles.stat}>Gems: </Text>
              <Text style={styles.statValue}>{formatInt(gems)}</Text>
              <Image source={GEM_ICON} style={styles.gemIcon} contentFit="contain" />
            </View>
          )}
        </Animated.View>

        {/* TODO(ads): rewarded video, doubles scrapEarned + gemsCollected before banking. Inert until AdMob is wired up. */}
        {ADS_ENABLED && (
          <GamePressable onPress={noop} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            <Image source={PILL} style={StyleSheet.absoluteFill} contentFit="fill" />
            <View style={styles.doubleContent}>
              <Text style={styles.doubleText}>x2</Text>
              <Image source={SCRAP_ICON} style={styles.scrapIcon} contentFit="contain" />
              <Image source={VIDEO_ICON} style={styles.videoIcon} contentFit="contain" />
            </View>
          </GamePressable>
        )}

        <GamePressable onPress={onRestart} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
          <Image source={PILL} style={StyleSheet.absoluteFill} contentFit="fill" />
          <Text style={styles.restartText}>Restart</Text>
        </GamePressable>

        <GamePressable
          onPress={onExit}
          sfx="ui-back"
          hitSlop={10}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.exitText}>To menu</Text>
        </GamePressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(24,27,45,0.81)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MenuMaxWidth,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  titleWrap: { width: '92%' },
  title: {
    width: '100%',
    aspectRatio: 337.455 / 116,
  },
  stats: {
    marginTop: 18,
    alignItems: 'center',
    gap: 4,
  },
  stat: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 22,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  statValue: { color: BattleColors.chargeAccent },
  gemsRow: { flexDirection: 'row', alignItems: 'center' },
  gemIcon: { width: 15, height: 14, marginLeft: 4 },
  pill: {
    width: '78%',
    aspectRatio: 630 / 150,
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.96 }] },
  doubleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doubleText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 17,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  scrapIcon: { width: 15, height: 18 },
  videoIcon: { width: 22, height: 17 },
  restartText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 17,
    color: '#e2611c',
    textTransform: 'uppercase',
  },
  exitText: {
    marginTop: 18,
    fontFamily: Fonts.grenzeMedium,
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
});
