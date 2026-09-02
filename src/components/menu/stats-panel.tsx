import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, MenuColors } from '@/constants/theme';

const PANEL_BG = require('@/assets/images/menu/stats-panel.png');
const ARROW = require('@/assets/images/menu/arrow.png');

type StatsPanelProps = {
  tier?: string;
  multiplier?: string;
  scrapPerHour?: string;
  highest?: string;
  onPrev?: () => void;
  onNext?: () => void;
};

/** "VOLTAGE" stats panel with a prev/next tier selector (Figma node 1:150). */
export function StatsPanel({
  tier = 'Voltage 1',
  multiplier = 'x1',
  scrapPerHour = '783.37',
  highest = '8',
  onPrev,
  onNext,
}: StatsPanelProps) {
  return (
    <View style={styles.panel}>
      <Image source={PANEL_BG} style={styles.panelBg} contentFit="fill" />

      <View style={[StyleSheet.absoluteFill, styles.content]}>
        <View style={styles.rowTop}>
          <Text style={styles.label}>Voltage</Text>
          <Text style={styles.labelAccent}>Best scrap farm</Text>
        </View>

        <View style={styles.rowMid}>
          <Pressable onPress={onPrev} disabled={!onPrev} hitSlop={12}>
            <Image source={ARROW} style={[styles.arrow, !onPrev && styles.arrowDim]} contentFit="contain" />
          </Pressable>
          <View style={styles.tierBox}>
            <Text style={styles.tier}>{tier}</Text>
            <Text style={styles.mult}>{multiplier}</Text>
          </View>
          <Pressable onPress={onNext} disabled={!onNext} hitSlop={12}>
            <Image source={ARROW} style={[styles.arrow, styles.arrowFlip, !onNext && styles.arrowDim]} contentFit="contain" />
          </Pressable>
        </View>

        <View style={styles.rowBot}>
          <Text style={styles.small}>Scrap/hr {scrapPerHour}</Text>
          <Text style={styles.small}>Highest reached {highest}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '88%',
    alignSelf: 'center',
  },
  panelBg: {
    width: '100%',
    aspectRatio: 915 / 249,
  },
  content: {
    paddingHorizontal: '8%',
    paddingVertical: '6%',
    justifyContent: 'space-between',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowMid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  rowBot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 11,
    lineHeight: 12,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  labelAccent: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 10,
    lineHeight: 12,
    color: MenuColors.accentBright,
    textTransform: 'uppercase',
  },
  tierBox: { alignItems: 'center' },
  tier: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 12,
    lineHeight: 13,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  mult: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 8,
    lineHeight: 9,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  small: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 8,
    lineHeight: 9,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  arrow: { width: 14, height: 12 },
  arrowFlip: { transform: [{ scaleX: -1 }] },
  arrowDim: { opacity: 0.35 },
});
