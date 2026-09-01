import { Image } from 'expo-image';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';

const CARD_BG = require('@/assets/images/daily-reward/card.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');
const UTILITY_ICON = require('@/assets/images/daily-reward/icon-utility.png');
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
};

/** One day's reward tile in the 3x2 grid (Figma node 1:84 etc). */
export function RewardCard({ day, amount, icon }: RewardCardProps) {
  const { width } = useWindowDimensions();
  const row = Math.min(width, MenuMaxWidth) - SCREEN_PADDING * 2;
  const cardW = (row - GAP * 2) / 3;
  const cardH = cardW / CARD_RATIO;

  return (
    <View style={{ width: cardW, height: cardH }}>
      <Image source={CARD_BG} style={StyleSheet.absoluteFill} contentFit="fill" />
      <View style={[StyleSheet.absoluteFill, styles.content]}>
        <Image source={ICONS[icon]} style={styles.icon} contentFit="contain" />
        <Text style={styles.day}>Day {day}</Text>
        <Text style={styles.amount}>+{amount}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
