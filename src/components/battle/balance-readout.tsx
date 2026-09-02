import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, MenuColors } from '@/constants/theme';
import { formatNumber } from '@/game/core/numbers';

type BalanceReadoutProps = {
  icon: number;
  value: number;
  iconWidth?: number;
  iconHeight?: number;
};

/** Icon + live-formatted value — the Charge/Scrap counters (Figma nodes 1:1519 / 1:1522). */
export function BalanceReadout({ icon, value, iconWidth = 16, iconHeight = 22 }: BalanceReadoutProps) {
  return (
    <View style={styles.row}>
      <Image source={icon} style={{ width: iconWidth, height: iconHeight }} contentFit="contain" />
      <Text style={styles.value}>{formatNumber(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 17,
    color: MenuColors.text,
  },
});
