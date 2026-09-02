import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatNumber } from '@/game/core/numbers';
import { DAILY_MISSION_REWARD, WEEKLY_LADDER, missionLabel } from '@/game/data/missions';
import { useMetaStore } from '@/game/state/meta-store';
import type { MissionInstance } from '@/game/economy/missions';

const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');
const VIDEO_ICON = require('@/assets/images/menu/icon-video.png');

type Tab = 'daily' | 'weekly';

function RewardChips({ gems, scrap, dim }: { gems: number; scrap: number; dim?: boolean }) {
  return (
    <View style={[styles.rewardRow, dim && styles.dim]}>
      <View style={styles.reward}>
        <Text style={styles.rewardValue}>{gems}</Text>
        <Image source={GEM_ICON} style={styles.gemIcon} contentFit="contain" />
      </View>
      <View style={styles.reward}>
        <Text style={styles.rewardValue}>{scrap}</Text>
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

function DailyRow({ mission, onClaim }: { mission: MissionInstance; onClaim: () => void }) {
  const claimable = mission.current >= mission.target && !mission.claimed;
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.missionLabel} numberOfLines={1}>
          {missionLabel(mission.type, mission.target)}{' '}
          <Text style={styles.progress}>
            ({Math.min(mission.current, mission.target)}/{mission.target})
          </Text>
        </Text>
        <View style={styles.rewardLine}>
          <Text style={styles.rewardLabel}>Reward:</Text>
          <RewardChips gems={DAILY_MISSION_REWARD.gems} scrap={DAILY_MISSION_REWARD.scrap} dim={mission.claimed} />
        </View>
      </View>
      <View style={styles.rowButtons}>
        <MiniButton label={mission.claimed ? 'Claimed' : 'Claim'} disabled={!claimable} onPress={onClaim} />
        {/* TODO(ads): rewarded video re-rolls this mission for a new template/target. Inert until ads are wired up. */}
        <MiniButton label="Reroll" icon={VIDEO_ICON} disabled={mission.claimed} />
      </View>
    </View>
  );
}

export default function MissionsScreen() {
  const [tab, setTab] = useState<Tab>('daily');
  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const missions = useMetaStore((s) => s.missions);
  const ensureMissionsForToday = useMetaStore((s) => s.ensureMissionsForToday);
  const claimMission = useMetaStore((s) => s.claimMission);
  const claimWeeklyTier = useMetaStore((s) => s.claimWeeklyTier);

  useEffect(() => {
    ensureMissionsForToday();
  }, [ensureMissionsForToday]);

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
        <View style={styles.list}>
          {missions.list.map((m) => (
            <DailyRow key={m.id} mission={m} onClaim={() => claimMission(m.id)} />
          ))}
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>{missions.weeklyCompletions} completions this week</Text>
          <View style={styles.weeklyPanel}>
            {WEEKLY_LADDER.map((tier, i) => {
              const claimed = missions.weeklyClaimed.includes(i);
              const claimable = !claimed && missions.weeklyCompletions >= tier.completions;
              return (
                <Pressable
                  key={tier.completions}
                  disabled={!claimable}
                  onPress={() => claimWeeklyTier(i)}
                  style={[styles.weeklyRow, i > 0 && styles.weeklyDivider]}>
                  <Text style={[styles.weeklyMult, !claimable && !claimed && styles.dim]}>
                    {tier.completions}
                    <Text style={styles.weeklyMultX}>x</Text>
                  </Text>
                  <RewardChips gems={tier.reward.gems} scrap={tier.reward.scrap} dim={!claimable && !claimed} />
                  {claimable && <Text style={styles.claim}>Claim</Text>}
                  {claimed && <Text style={styles.claimedText}>Claimed</Text>}
                </Pressable>
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
  list: { width: '100%', gap: 6, marginTop: 12 },
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
    gap: 10,
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
  claim: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 13,
    color: MenuColors.accentBright,
    textTransform: 'uppercase',
  },
  claimedText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
  },
  bottomSpace: { height: 28 },
});
