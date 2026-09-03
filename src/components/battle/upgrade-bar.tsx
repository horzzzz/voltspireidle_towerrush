import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UpgradeRow } from './upgrade-row';
import type { UpgradeId } from '@/game/core/types';
import { useBattleStore } from '@/game/state/battle-store';
import { isUpgradeMaxed, upgradeCostFor, UPGRADE_DEFS, UPGRADE_ORDER } from '@/game/data/tower-stats';

type UpgradeBarProps = { onBuy: (id: UpgradeId) => void };

/**
 * The six in-run upgrades, scrollable. The Figma frame (node 1:1549) only
 * mocks one row — with six upgrades a fixed-height scroller is the natural
 * read, sized to show ~3 rows at once so buying stays a thumb's reach away.
 */
export function UpgradeBar({ onBuy }: UpgradeBarProps) {
  const insets = useSafeAreaInsets();
  const levels = useBattleStore((s) => s.upgradeLevels);
  const charge = useBattleStore((s) => s.charge);
  const loadout = useBattleStore((s) => s.loadout);
  // A stat gated behind an unbought Coilworks unlock (Crit chance, Armor)
  // has no row here at all — buying it in Coilworks is what makes it show
  // up, same rule as the "заблокированные скиллы" the Coilworks screen
  // itself already hides behind an UNLOCK panel.
  const visibleOrder = UPGRADE_ORDER.filter((id) => loadout.runUpgradesUnlocked[id]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 8 }]}
      showsVerticalScrollIndicator={false}>
      {visibleOrder.map((id) => {
        const def = UPGRADE_DEFS[id];
        const level = levels[id];
        const maxed = isUpgradeMaxed(def, level);
        const cost = maxed ? null : upgradeCostFor(def, level, loadout);
        return (
          <UpgradeRow
            key={id}
            id={id}
            def={def}
            level={level}
            cost={cost}
            affordable={cost != null && charge >= cost}
            loadout={loadout}
            onBuy={onBuy}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 46 * 3 + 8 },
  content: { gap: 1 },
});
