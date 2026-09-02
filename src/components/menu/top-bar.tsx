import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ADS_ENABLED } from '@/constants/features';
import { Fonts, MenuColors } from '@/constants/theme';

const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');
const ENERGY_PILL = require('@/assets/images/menu/energy-pill.png');

type TopBarProps = {
  scrap?: string;
  gems?: string;
  onEnergyPress?: () => void;
};

/** Top HUD row: scrap + gem balances, energy pill (Figma node 1:114, y40). */
export function TopBar({ scrap = '0', gems = '0', onEnergyPress }: TopBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.balances}>
        <View style={styles.balance}>
          <Image source={SCRAP_ICON} style={styles.scrapIcon} contentFit="contain" />
          <Text style={styles.value}>{scrap}</Text>
        </View>
        <View style={styles.balance}>
          <Image source={GEM_ICON} style={styles.gemIcon} contentFit="contain" />
          <Text style={styles.value}>{gems}</Text>
        </View>
      </View>
      { ADS_ENABLED &&
          <Pressable onPress={onEnergyPress} hitSlop={8}>
            <Image source={ENERGY_PILL} style={styles.energy} contentFit="contain" />
          </Pressable>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    height: 44,
  },
  balances: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scrapIcon: { width: 20, height: 24 },
  gemIcon: { width: 24, height: 22 },
  value: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 20,
    color: MenuColors.text,
  },
  energy: { width: 92, height: 31 },
});
