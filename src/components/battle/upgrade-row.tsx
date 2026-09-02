import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BattleColors, Fonts, MenuColors } from '@/constants/theme';
import { formatNumber } from '@/game/core/numbers';
import { isUpgradeMaxed, upgradeCost, upgradeValue, type UpgradeDef } from '@/game/data/tower-stats';

const ICONS: Record<UpgradeDef['icon'], number> = {
  damage: require('@/assets/images/battle/up-damage.png'),
  speed: require('@/assets/images/battle/up-speed.png'),
  health: require('@/assets/images/battle/up-health.png'),
  regen: require('@/assets/images/battle/up-regen.png'),
  shield: require('@/assets/images/battle/up-shield.png'),
  scrap: require('@/assets/images/battle/up-scrap.png'),
};

function formatStat(def: UpgradeDef, level: number): string {
  const value = upgradeValue(def, level);
  return formatNumber(value, def.unit === '%' ? 1 : 2) + def.unit;
}

type UpgradeRowProps = {
  def: UpgradeDef;
  level: number;
  charge: number;
  onBuy: () => void;
};

/** One buyable in-run upgrade (Figma node 1:1549) — icon, current → next stat, Charge cost. */
export function UpgradeRow({ def, level, charge, onBuy }: UpgradeRowProps) {
  const maxed = isUpgradeMaxed(def, level);
  const cost = maxed ? null : upgradeCost(def, level);
  const affordable = cost != null && charge >= cost;

  return (
    <Pressable
      onPress={onBuy}
      disabled={maxed || !affordable}
      style={({ pressed }) => [styles.row, maxed && styles.rowMaxed, pressed && affordable && styles.pressed]}>
      <Image source={ICONS[def.icon]} style={styles.icon} contentFit="contain" />
      <View style={styles.labels}>
        <Text style={styles.name}>{def.label}</Text>
        <Text style={styles.values}>
          {formatStat(def, level)} <Text style={styles.arrow}>→</Text>{' '}
          <Text style={styles.to}>{maxed ? 'MAX' : formatStat(def, level + 1)}</Text>
        </Text>
      </View>
      {!maxed && (
        <View style={[styles.price, !affordable && styles.priceDisabled]}>
          <Text style={styles.priceText}>{formatNumber(cost!, 1)}</Text>
          <Text style={styles.priceUnit}>⚡</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    backgroundColor: BattleColors.upgradeRow,
  },
  rowMaxed: { backgroundColor: BattleColors.upgradeRowMaxed },
  pressed: { opacity: 0.7 },
  icon: { width: 26, height: 32 },
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
  },
  arrow: { color: 'rgba(255,255,255,0.65)' },
  to: { color: MenuColors.accent },
  price: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 54,
    height: 24,
    borderRadius: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: BattleColors.chargeAccent,
    backgroundColor: 'rgba(20,60,72,0.5)',
  },
  priceDisabled: { opacity: 0.4 },
  priceText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 14,
    color: MenuColors.text,
  },
  priceUnit: { fontSize: 12 },
});
