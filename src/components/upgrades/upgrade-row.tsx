import { Image } from 'expo-image';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PriceTag } from '@/components/upgrades/price-tag';
import { Fonts, MenuColors } from '@/constants/theme';
import { burstFrom } from '@/game/state/fx-store';

const ICONS = {
  attack: require('@/assets/images/ui/icon-attack.png'),
  defense: require('@/assets/images/ui/icon-defense.png'),
  utility: require('@/assets/images/ui/icon-utility.png'),
};

export type UpgradeCategory = keyof typeof ICONS;

type UpgradeRowProps = {
  category: UpgradeCategory;
  name: string;
  from: string;
  to: string;
  /** Omitted (and `PriceTag` hidden) once `maxed` is true. */
  price?: string;
  maxed?: boolean;
  /** True when the player can't afford it right now — dims the row without hiding it. */
  disabled?: boolean;
  /** Return `false` to suppress the level-up burst (e.g. the purchase was refused). */
  onBuy?: () => boolean | void;
};

/** A single buyable stat upgrade (Figma node 1:420). */
export function UpgradeRow({ category, name, from, to, price, maxed, disabled, onBuy }: UpgradeRowProps) {
  const rowRef = useRef<View>(null);
  return (
    <Pressable
      ref={rowRef}
      onPress={() => {
        if (onBuy?.() === false) return;
        burstFrom(rowRef.current, 'levelUp');
      }}
      disabled={maxed || disabled}
      style={({ pressed }) => [styles.row, disabled && styles.rowDisabled, pressed && !disabled && styles.pressed]}>
      <Image source={ICONS[category]} style={styles.icon} contentFit="contain" />
      <View style={styles.labels}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.values}>
          {from} <Text style={styles.arrow}>→</Text> <Text style={styles.to}>{maxed ? 'MAX' : to}</Text>
        </Text>
      </View>
      {!maxed && price != null && <PriceTag price={price} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
    backgroundColor: 'rgba(21,23,34,0.71)',
  },
  pressed: { opacity: 0.7 },
  rowDisabled: { opacity: 0.5 },
  icon: { width: 22, height: 22 },
  labels: { flex: 1 },
  name: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 13,
    lineHeight: 15,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  values: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
  },
  arrow: { color: 'rgba(255,255,255,0.65)' },
  to: { color: MenuColors.accent },
});
