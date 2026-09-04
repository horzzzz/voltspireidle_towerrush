import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SideRail } from '@/components/menu/side-rail';
import { StatsPanel } from '@/components/menu/stats-panel';
import { TopBar } from '@/components/menu/top-bar';
import { GamePressable } from '@/components/ui/game-pressable';
import { ADS_ENABLED } from '@/constants/features';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatInt, formatNumber } from '@/game/core/numbers';
import { getVoltage, isVoltageUnlocked, voltageUnlockRequirement, VOLTAGES } from '@/game/data/voltages';
import { useMetaStore } from '@/game/state/meta-store';

const LOGO = require('@/assets/images/splash/logo.png');
const REACTOR = require('@/assets/images/splash/tower.png');
const BATTLE_BUTTON = require('@/assets/images/menu/battle-button.png');
const VIDEO_ICON = require('@/assets/images/menu/icon-video.png');

// TODO(ads): rewarded video grants x2 scrap for 10 minutes. Inert until AdMob is wired up.
const noop = () => {};

function handleRailPress(key: string) {
  if (key === 'daily') router.push('/daily-reward');
  if (key === 'settings') router.push('/settings');
  if (key === 'wheel') router.push('/wheel');
  if (key === 'shop') router.push('/shop');
}

/** Main menu / idle hub (Figma node 1:114). */
export default function GameScreen() {
  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const voltageTier = useMetaStore((s) => s.voltage);
  const highestWaveByVoltage = useMetaStore((s) => s.highestWaveByVoltage);
  const bestScrapPerHourByVoltage = useMetaStore((s) => s.bestScrapPerHourByVoltage);
  const selectVoltage = useMetaStore((s) => s.selectVoltage);

  // Which tier the panel is *browsing* — free to roam every tier, locked or not.
  // The selected tier for a run (`voltageTier`) only follows it onto unlocked ones.
  const [viewTier, setViewTier] = useState(voltageTier);
  const voltage = getVoltage(viewTier);
  const unlocked = isVoltageUnlocked(viewTier, highestWaveByVoltage);
  const req = voltageUnlockRequirement(viewTier);
  const canPrev = viewTier > 1;
  const canNext = viewTier < VOLTAGES.length;

  useEffect(() => {
    if (unlocked && viewTier !== voltageTier) selectVoltage(viewTier);
  }, [unlocked, viewTier, voltageTier, selectVoltage]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Top cluster: balances, logo, reactor + side rail */}
      <View style={styles.topCluster}>
        <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={noop} />
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <View style={styles.reactorWrap}>
          <Image source={REACTOR} style={styles.reactor} contentFit="contain" />
          <View style={styles.rail}>
            <SideRail onPress={handleRailPress} />
          </View>
        </View>
      </View>

      <StatsPanel
        tier={voltage.name}
        multiplier={`x${voltage.scrapMult}`}
        scrapPerHour={formatNumber(bestScrapPerHourByVoltage[viewTier] ?? 0)}
        highest={formatInt(highestWaveByVoltage[viewTier] ?? 0)}
        locked={!unlocked}
        lockHint={req ? `Reach wave ${req.wave} on Voltage ${req.prevTier}` : undefined}
        showScrapFarm={viewTier === 1}
        onPrev={canPrev ? () => setViewTier((t) => t - 1) : undefined}
        onNext={canNext ? () => setViewTier((t) => t + 1) : undefined}
      />

      <View style={styles.bonus}>
        {unlocked && (
          <Text style={styles.bonusPrimary} numberOfLines={1} adjustsFontSizeToFit>
            Scrap bonus in effect x{voltage.scrapMult}
          </Text>
        )}
        {ADS_ENABLED && unlocked && (
          <View style={styles.bonusRow}>
            <Text style={styles.bonusSecondary} numberOfLines={1} adjustsFontSizeToFit>
              x2 scrap bonus for 10 minutes
            </Text>
            <GamePressable onPress={noop} hitSlop={8}>
              <Image source={VIDEO_ICON} style={styles.videoIcon} contentFit="contain" />
            </GamePressable>
          </View>
        )}
      </View>

      <View style={styles.spacer} />

      <GamePressable
        onPress={() => router.push('/battle')}
        style={({ pressed }) => [styles.battle, pressed && styles.battlePressed]}>
        <Image source={BATTLE_BUTTON} style={styles.battleImg} contentFit="contain" />
      </GamePressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MenuMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    paddingBottom: 10,
  },
  topCluster: {
    width: '100%',
    alignItems: 'center',
  },
  spacer: {
    flexGrow: 1,
    minHeight: 24,
  },
  logo: {
    width: '60%',
    aspectRatio: 1214 / 632,
    marginTop: 4,
  },
  reactorWrap: {
    width: '100%',
    minHeight: 208,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    marginTop: 4,
    marginBottom: 14,
  },
  reactor: {
    width: '36%',
    aspectRatio: 1,
    minWidth: 128,
  },
  rail: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  bonus: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
  },
  bonusPrimary: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 21,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '92%',
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '92%',
  },
  bonusSecondary: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 17,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    flexShrink: 1,
  },
  videoIcon: { width: 28, height: 22 },
  battle: {
    width: '52%',
    marginBottom: 18,
  },
  battlePressed: { transform: [{ scale: 0.96 }] },
  battleImg: { width: '100%', aspectRatio: 600 / 204 },
});
