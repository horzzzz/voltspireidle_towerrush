import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBonusPill } from './ad-bonus-pill';
import { BalanceReadout } from './balance-readout';
import { SettingsButton } from './settings-button';
import { SpeedControl } from './speed-control';
import { WavePanel } from './wave-panel';
import { ADS_ENABLED } from '@/constants/features';
import { useBattleStore } from '@/game/state/battle-store';
import type { SpeedMultiplier } from '@/game/render/use-battle-engine';

const CHARGE_ICON = require('@/assets/images/battle/icon-charge.png');
const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const BONUS_CHARGE = require('@/assets/images/battle/bonus-pill-charge.png');
const BONUS_GEM = require('@/assets/images/battle/bonus-pill-gem.png');

const noop = () => {};

type HudTopProps = {
  onSettingsPress: () => void;
  onSetSpeed: (multiplier: SpeedMultiplier) => void;
};

/** Full top HUD row (Figma node 1:1512, y0-y110): balances, wave panel, settings. */
export function HudTop({ onSettingsPress, onSetSpeed }: HudTopProps) {
  const insets = useSafeAreaInsets();
  const charge = useBattleStore((s) => s.charge);
  const scrapEarned = useBattleStore((s) => s.scrapEarned);
  const wave = useBattleStore((s) => s.wave);
  const isBossWave = useBattleStore((s) => s.isBossWave);
  const total = useBattleStore((s) => s.waveEnemiesTotal);
  const remaining = useBattleStore((s) => s.waveEnemiesRemaining);
  const bossHpFraction = useBattleStore((s) => s.bossHpFraction);

  // On a boss wave the bar tracks boss HP (damage taken), not raw kill
  // count — it advances with every hit and finishes exactly when the boss
  // dies, regardless of how much escort is still alive. See battle-store.
  const progress = isBossWave ? 1 - bossHpFraction : total > 0 ? 1 - remaining / total : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.column}>
        {ADS_ENABLED && <AdBonusPill source={BONUS_CHARGE} aspectRatio={57 / 24} onPress={noop} />}
        <BalanceReadout icon={CHARGE_ICON} value={charge} iconWidth={12} iconHeight={17} />
        <BalanceReadout icon={SCRAP_ICON} value={scrapEarned} iconWidth={13} iconHeight={16} />
      </View>

      <WavePanel wave={wave} isBossWave={isBossWave} progress={progress} />

      <View style={[styles.column, styles.columnRight]}>
        <SpeedControl onSetSpeed={onSetSpeed} />
        <SettingsButton onPress={onSettingsPress} />
        {ADS_ENABLED && <AdBonusPill source={BONUS_GEM} aspectRatio={73 / 25} onPress={noop} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    gap: 8,
  },
  column: {
    gap: 8,
  },
  columnRight: {
    alignItems: 'flex-end',
  },
});
