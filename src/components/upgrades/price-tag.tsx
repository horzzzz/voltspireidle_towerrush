import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, MenuColors } from '@/constants/theme';

const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');

/** Orange cost chip used on upgrade rows and unlock panels (Figma node 1:424). */
export function PriceTag({ price, small = false }: { price: string; small?: boolean }) {
  return (
    <View style={[styles.tag, small ? styles.tagSmall : styles.tagNormal]}>
      <Text style={[styles.text, { fontSize: small ? 11 : 14 }]}>{price}</Text>
      <Image
        source={SCRAP_ICON}
        style={small ? styles.iconSmall : styles.icon}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2611c',
    backgroundColor: 'rgba(118,49,0,0.46)',
  },
  tagNormal: { minWidth: 54, height: 24, borderRadius: 6, paddingHorizontal: 6 },
  tagSmall: { minWidth: 40, height: 18, borderRadius: 4.5, paddingHorizontal: 5 },
  text: {
    fontFamily: Fonts.grenzeSemiBold,
    color: MenuColors.text,
    lineHeight: 16,
  },
  icon: { width: 13, height: 15 },
  iconSmall: { width: 10, height: 12 },
});
