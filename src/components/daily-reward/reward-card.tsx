import { Image } from 'expo-image';
import { useEffect, type Ref } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';

const CARD_BG = require('@/assets/images/daily-reward/card.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');
const UTILITY_ICON = require('@/assets/images/ui/icon-utility.png');
const CHIP_ICON = require('@/assets/images/daily-reward/icon-chip.png');

const ICONS = { gem: GEM_ICON, utility: UTILITY_ICON, chip: CHIP_ICON };

export type RewardIcon = keyof typeof ICONS;

// Card art ratio + the parent screen's horizontal padding / inter-card gap,
// so 3 cards + 2 gaps fill the row.
const CARD_RATIO = 397 / 257;
const SCREEN_PADDING = 20;
const GAP = 12;

type RewardCardProps = {
  day: number;
  amount: string;
  icon: RewardIcon;
  /** Today's claimable card — full opacity + accent border. */
  active?: boolean;
  /** Already claimed (or cycled past) — dimmed. */
  past?: boolean;
  /** Lets the screen measure this card, so a claim burst can start from it. */
  ref?: Ref<View>;
};

/** One day's reward tile in the 3x2 grid (Figma node 1:84 etc). */
export function RewardCard({ day, amount, icon, active, past, ref }: RewardCardProps) {
  const { width } = useWindowDimensions();
  const row = Math.min(width, MenuMaxWidth) - SCREEN_PADDING * 2;
  const cardW = (row - GAP * 2) / 3;
  const cardH = cardW / CARD_RATIO;

  // Today's card breathes, so the one thing worth tapping is the one thing
  // moving on an otherwise static grid.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [active, pulse]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.55 }));

  return (
    <View ref={ref} style={[{ width: cardW, height: cardH }, past && styles.past]}>
      <Image source={CARD_BG} style={StyleSheet.absoluteFill} contentFit="fill" />
      {active && <Animated.View style={[styles.activeRing, ringStyle]} />}
      <View style={[StyleSheet.absoluteFill, styles.content]}>
        <Image source={ICONS[icon]} style={styles.icon} contentFit="contain" />
        <Text style={styles.day}>Day {day}</Text>
        <Text style={styles.amount}>+{amount}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  past: { opacity: 0.5 },
  activeRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: MenuColors.accentBright,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    // Clear the frame's top chevron and bottom dash strip.
    paddingTop: '15%',
    paddingBottom: '13%',
    paddingHorizontal: '8%',
  },
  icon: { width: 16, height: 16 },
  day: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 12,
    lineHeight: 14,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  amount: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 11,
    lineHeight: 13,
    color: MenuColors.text,
  },
});
