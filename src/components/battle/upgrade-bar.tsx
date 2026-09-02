import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UpgradeRow } from './upgrade-row';
import type { UpgradeId } from '@/game/core/types';
import { useBattleStore } from '@/game/state/battle-store';
import { UPGRADE_DEFS, UPGRADE_ORDER } from '@/game/data/tower-stats';

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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 8 }]}
      showsVerticalScrollIndicator={false}>
      {UPGRADE_ORDER.map((id) => (
        <UpgradeRow key={id} def={UPGRADE_DEFS[id]} level={levels[id]} charge={charge} onBuy={() => onBuy(id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 46 * 3 + 8 },
  content: { gap: 1 },
});
