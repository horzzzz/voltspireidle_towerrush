import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatNumber } from '@/game/core/numbers';
import { useMetaStore } from '@/game/state/meta-store';

const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');
const VIDEO_ICON = require('@/assets/images/menu/icon-video.png');

type Tab = 'daily' | 'weekly';

type Reward = { gems: number; scrap: number };

type DailyMission = { id: string; label: string; current: number; target: number; reward: Reward };

/** Daily missions (Figma node 1:504). Progress is a stub — all start at 0. */
const DAILY: DailyMission[] = [
  { id: 'gems8', label: 'Collect 8 floating gems', current: 0, target: 8, reward: { gems: 3, scrap: 20 } },
  { id: 'coil8', label: 'Buy 8 coilworks', current: 0, target: 8, reward: { gems: 3, scrap: 20 } },
  { id: 'gems3', label: 'Collect 3 floating gems', current: 0, target: 3, reward: { gems: 3, scrap: 20 } },
  { id: 'coil3', label: 'Buy 3 coilworks', current: 0, target: 3, reward: { gems: 3, scrap: 20 } },
  { id: 'boss3', label: 'Kill 3 bosses', current: 0, target: 3, reward: { gems: 3, scrap: 20 } },
];

/**
 * Weekly completion ladder (Figma node 1:932). The design rewards each tier
 * with gems + a medal + a capacitor; medals and capacitors don't exist in the
 * game, so both are folded into scrap.
 */
const WEEKLY: { completions: number; reward: Reward }[] = [
  { completions: 5, reward: { gems: 10, scrap: 40 } },
  { completions: 10, reward: { gems: 15, scrap: 60 } },
  { completions: 15, reward: { gems: 20, scrap: 90 } },
  { completions: 20, reward: { gems: 25, scrap: 120 } },
  { completions: 25, reward: { gems: 30, scrap: 160 } },
  { completions: 35, reward: { gems: 40, scrap: 220 } },
  { completions: 40, reward: { gems: 50, scrap: 300 } },
];

const WEEKLY_COMPLETIONS = 0;

function RewardChips({ reward, dim }: { reward: Reward; dim?: boolean }) {
  return (
    <View style={[styles.rewardRow, dim && styles.dim]}>
      <View style={styles.reward}>
        <Text style={styles.rewardValue}>{reward.gems}</Text>
        <Image source={GEM_ICON} style={styles.gemIcon} contentFit="contain" />
      </View>
      <View style={styles.reward}>
        <Text style={styles.rewardValue}>{reward.scrap}</Text>
        <Image source={SCRAP_ICON} style={styles.scrapIcon} contentFit="contain" />
      </View>
    </View>
  );
}

function MiniButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon?: number;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniBtn,
        disabled ? styles.miniBtnOff : styles.miniBtnOn,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.miniBtnText, disabled && styles.dim]}>{label}</Text>
      {icon != null && <Image source={icon} style={styles.miniBtnIcon} contentFit="contain" />}
    </Pressable>
  );
}

function DailyRow({ mission }: { mission: DailyMission }) {
  const claimable = mission.current >= mission.target;
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.missionLabel} numberOfLines={1}>
          {mission.label}{' '}
          <Text style={styles.progress}>
            ({mission.current}/{mission.target})
          </Text>
        </Text>
        <View style={styles.rewardLine}>
          <Text style={styles.rewardLabel}>Reward:</Text>
          <RewardChips reward={mission.reward} />
        </View>
      </View>
      <View style={styles.rowButtons}>
        <MiniButton label="Claim" disabled={!claimable} />
        <MiniButton label="Reroll" icon={VIDEO_ICON} />
      </View>
    </View>
  );
}

export default function MissionsScreen() {
  const [tab, setTab] = useState<Tab>('daily');
  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={() => {}} />

      <Text style={styles.title}>Missions</Text>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('daily')} hitSlop={8}>
          <Text style={[styles.tab, tab !== 'daily' && styles.tabInactive]}>Daily</Text>
        </Pressable>
        <Pressable onPress={() => setTab('weekly')} hitSlop={8}>
          <Text style={[styles.tab, tab !== 'weekly' && styles.tabInactive]}>Weekly</Text>
        </Pressable>
      </View>

      {tab === 'daily' ? (
        <>
          <Text style={styles.subtitle}>Next mission in 4:09:00</Text>
          <View style={styles.list}>
            {DAILY.map((m) => (
              <DailyRow key={m.id} mission={m} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            {WEEKLY_COMPLETIONS} completions this week · resets in 92:09:00
          </Text>
          <View style={styles.weeklyPanel}>
            {WEEKLY.map((tier, i) => {
              const reached = WEEKLY_COMPLETIONS >= tier.completions;
              return (
                <View
                  key={tier.completions}
                  style={[styles.weeklyRow, i > 0 && styles.weeklyDivider]}>
                  <Text style={[styles.weeklyMult, !reached && styles.dim]}>
                    {tier.completions}
                    <Text style={styles.weeklyMultX}>x</Text>
                  </Text>
                  <RewardChips reward={tier.reward} dim={!reached} />
                </View>
              );
            })}
          </View>
        </>
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
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 25,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 6,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 44,
    marginTop: 14,
  },
  tab: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 26,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
  tabInactive: { opacity: 0.5 },
  subtitle: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 15,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  list: { width: '100%', gap: 6 },
  row: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(21,23,34,0.71)',
  },
  rowMain: { flex: 1, gap: 5 },
  missionLabel: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 13,
    lineHeight: 15,
    color: '#ffa600',
    textTransform: 'uppercase',
  },
  progress: {
    fontFamily: Fonts.grenzeRegular,
    color: MenuColors.text,
  },
  rewardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardLabel: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 11,
    lineHeight: 13,
    color: '#ffa600',
    textTransform: 'uppercase',
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardValue: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 12,
    lineHeight: 14,
    color: MenuColors.text,
  },
  gemIcon: { width: 13, height: 12 },
  scrapIcon: { width: 11, height: 13 },
  rowButtons: {
    gap: 6,
    alignItems: 'stretch',
  },
  miniBtn: {
    minWidth: 72,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    borderWidth: 1,
  },
  miniBtnOn: {
    borderColor: '#3a6ea5',
    backgroundColor: 'rgba(20,34,58,0.9)',
  },
  miniBtnOff: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(21,23,34,0.6)',
  },
  miniBtnText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 11,
    lineHeight: 13,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  miniBtnIcon: { width: 14, height: 11 },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.5 },
  weeklyPanel: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(21,23,34,0.71)',
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  weeklyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  weeklyDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  weeklyMult: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 34,
    lineHeight: 38,
    color: '#ffa600',
    textTransform: 'uppercase',
  },
  weeklyMultX: { fontSize: 17 },
  bottomSpace: { height: 28 },
});
