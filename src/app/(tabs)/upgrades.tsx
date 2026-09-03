import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionHeader } from '@/components/upgrades/section-header';
import { UnlockPanel } from '@/components/upgrades/unlock-panel';
import { UpgradeRow } from '@/components/upgrades/upgrade-row';
import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatNumber, formatStatValue } from '@/game/core/numbers';
import {
  COILWORKS_DEFS,
  COILWORKS_ORDER,
  coilworksCost,
  coilworksUnlocksInCategory,
  coilworksValue,
  isCoilworksAvailable,
  isCoilworksMaxed,
  type CoilworksCategory,
  type CoilworksUpgradeId,
} from '@/game/data/coilworks';
import { useMetaStore } from '@/game/state/meta-store';

const noop = () => {};

const SECTION_TITLES: Record<CoilworksCategory, string> = {
  attack: 'Attack upgrades',
  defense: 'Defense upgrades',
  utility: 'Utility upgrades',
};

/** Coilworks — the permanent, Scrap-funded upgrade tree (Figma node 1:399). */
export default function UpgradesScreen() {
  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const levels = useMetaStore((s) => s.coilworks);
  const unlocked = useMetaStore((s) => s.coilworksUnlocked);
  const buyCoilworks = useMetaStore((s) => s.buyCoilworks);
  const unlockCoilworks = useMetaStore((s) => s.unlockCoilworks);

  function renderRow(id: CoilworksUpgradeId, category: CoilworksCategory) {
    const def = COILWORKS_DEFS[id];
    const level = levels[id];
    const maxed = isCoilworksMaxed(def, level);
    const cost = maxed ? null : coilworksCost(def, level);
    const affordable = cost == null || scrap >= cost;

    return (
      <UpgradeRow
        key={id}
        category={category}
        name={def.label}
        from={formatStatValue(def.display, coilworksValue(def, level))}
        to={maxed ? '' : formatStatValue(def.display, coilworksValue(def, level + 1))}
        price={cost != null ? formatNumber(cost, 0) : undefined}
        maxed={maxed}
        disabled={!maxed && !affordable}
        onBuy={() => buyCoilworks(id)}
      />
    );
  }

  /**
   * A category shows the branches it has unlocked, then one panel per unlock
   * still to buy. One unlock can cover several branches at once (Defense opens
   * Health, Regen and Deflection together), which is why the panels come from
   * `coilworksUnlocksInCategory` rather than from the rows.
   */
  function renderSection(category: CoilworksCategory) {
    const ids = COILWORKS_ORDER.filter(
      (id) => COILWORKS_DEFS[id].category === category && isCoilworksAvailable(COILWORKS_DEFS[id], unlocked),
    );
    const pending = coilworksUnlocksInCategory(category).filter((u) => !unlocked[u.id]);

    return (
      <View key={category}>
        <SectionHeader title={SECTION_TITLES[category]} />
        {ids.map((id) => renderRow(id, category))}
        {pending.map((unlock) => (
          <UnlockPanel
            key={unlock.id}
            label={unlock.label}
            price={formatNumber(unlock.cost, 0)}
            onPress={() => unlockCoilworks(unlock.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={noop} />

      <Text style={styles.title}>Coilworks</Text>

      {(['attack', 'defense', 'utility'] as CoilworksCategory[]).map(renderSection)}

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
