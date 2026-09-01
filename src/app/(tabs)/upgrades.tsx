import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionHeader } from '@/components/upgrades/section-header';
import { UnlockPanel } from '@/components/upgrades/unlock-panel';
import { UpgradeRow } from '@/components/upgrades/upgrade-row';
import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';

const noop = () => {};

/** Upgrades tab — "Coilworks" (Figma node 1:399). Values and buys are stubs. */
export default function UpgradesScreen() {
  // Tapping an "UNLOCK …" panel reveals its upgrade row, styled like the rest.
  const [unlocked, setUnlocked] = useState({ critical: false, armor: false, charge: false });
  const unlock = (key: keyof typeof unlocked) => () =>
    setUnlocked((u) => ({ ...u, [key]: true }));

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <TopBar scrap="45.4" gems="7" onEnergyPress={noop} />

      <Text style={styles.title}>Coilworks</Text>

      <SectionHeader title="Attack upgrades" />
      <UpgradeRow category="attack" name="Damage" from="14" to="14.66" price="20" onBuy={noop} />
      <UpgradeRow
        category="attack"
        name="Attack speed"
        from="1.0"
        to="1.03/s"
        price="25"
        onBuy={noop}
      />
      {unlocked.critical ? (
        <UpgradeRow
          category="attack"
          name="Critical chance"
          from="0.00"
          to="1.00%"
          price="30"
          onBuy={noop}
        />
      ) : (
        <UnlockPanel
          label="Unlock critical chance upgrades"
          price="30"
          onPress={unlock('critical')}
        />
      )}

      <SectionHeader title="Defense upgrades" />
      <UpgradeRow category="defense" name="Health" from="6" to="6.28" price="25" onBuy={noop} />
      <UpgradeRow
        category="defense"
        name="Health regen"
        from="0.2"
        to="0.21/s"
        price="25"
        onBuy={noop}
      />
      <UpgradeRow
        category="defense"
        name="Deflection"
        from="0.00"
        to="0.50%"
        price="60"
        onBuy={noop}
      />
      {unlocked.armor ? (
        <UpgradeRow category="defense" name="Armor" from="0" to="1" price="150" onBuy={noop} />
      ) : (
        <UnlockPanel label="Unlock armor upgrades" price="150" onPress={unlock('armor')} />
      )}

      <SectionHeader title="Utility upgrades" />
      <UpgradeRow
        category="utility"
        name="Scrap/wave"
        from="1"
        to="2"
        price="125"
        onBuy={noop}
      />
      {unlocked.charge ? (
        <UpgradeRow
          category="utility"
          name="Charge bonus"
          from="0"
          to="5%"
          price="50"
          onBuy={noop}
        />
      ) : (
        <UnlockPanel label="Unlock charge bonuses" price="50" onPress={unlock('charge')} />
      )}

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
