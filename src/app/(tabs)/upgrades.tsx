import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionHeader } from '@/components/upgrades/section-header';
import { UnlockPanel } from '@/components/upgrades/unlock-panel';
import { UpgradeRow, type UpgradeCategory } from '@/components/upgrades/upgrade-row';
import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatNumber } from '@/game/core/numbers';
import {
  COILWORKS_DEFS,
  COILWORKS_ORDER,
  coilworksCost,
  coilworksValue,
  isCoilworksMaxed,
  type CoilworksUpgradeId,
} from '@/game/data/coilworks';
import { useMetaStore } from '@/game/state/meta-store';

const noop = () => {};

function formatStat(unit: string, value: number): string {
  return formatNumber(value, unit === '%' ? 1 : 2) + unit;
}

/** Coilworks — the permanent, Scrap-funded upgrade tree (Figma node 1:399). */
export default function UpgradesScreen() {
  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const levels = useMetaStore((s) => s.coilworks);
  const unlocked = useMetaStore((s) => s.coilworksUnlocked);
  const buyCoilworks = useMetaStore((s) => s.buyCoilworks);
  const unlockCoilworks = useMetaStore((s) => s.unlockCoilworks);

  function renderRow(id: CoilworksUpgradeId, category: UpgradeCategory) {
    const def = COILWORKS_DEFS[id];

    if (!unlocked[id]) {
      return (
        <UnlockPanel
          key={id}
          label={`Unlock ${def.label.toLowerCase()} upgrades`}
          price={formatNumber(def.unlockCost ?? 0, 0)}
          onPress={() => unlockCoilworks(id)}
        />
      );
    }

    const level = levels[id];
    const maxed = isCoilworksMaxed(def, level);
    const cost = maxed ? null : coilworksCost(def, level);
    const affordable = cost == null || scrap >= cost;

    return (
      <UpgradeRow
        key={id}
        category={category}
        name={def.label}
        from={formatStat(def.unit, coilworksValue(def, level))}
        to={maxed ? '' : formatStat(def.unit, coilworksValue(def, level + 1))}
        price={cost != null ? formatNumber(cost, 0) : undefined}
        maxed={maxed}
        disabled={!maxed && !affordable}
        onBuy={() => buyCoilworks(id)}
      />
    );
  }

  const attackIds = COILWORKS_ORDER.filter((id) => COILWORKS_DEFS[id].category === 'attack');
  const defenseIds = COILWORKS_ORDER.filter((id) => COILWORKS_DEFS[id].category === 'defense');
  const utilityIds = COILWORKS_ORDER.filter((id) => COILWORKS_DEFS[id].category === 'utility');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={noop} />

      <Text style={styles.title}>Coilworks</Text>

      <SectionHeader title="Attack upgrades" />
      {attackIds.map((id) => renderRow(id, 'attack'))}

      <SectionHeader title="Defense upgrades" />
      {defenseIds.map((id) => renderRow(id, 'defense'))}

      <SectionHeader title="Utility upgrades" />
      {utilityIds.map((id) => renderRow(id, 'utility'))}

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MenuMaxWidth,
    alignSelf: 'center',
  },
  title: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 22,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginVertical: 8,
  },
  bottomSpace: { height: 24 },
});
