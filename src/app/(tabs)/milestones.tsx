import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { useMetaStore } from '@/game/state/meta-store';
import { formatNumber } from '@/game/core/numbers';
import { MILESTONES, milestoneKey } from '@/game/data/milestones';
import { getVoltage, isVoltageUnlocked, voltageUnlockRequirement, VOLTAGES } from '@/game/data/voltages';

const ARROW = require('@/assets/images/menu/arrow.png');
const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');

function RewardChip({ icon, amount }: { icon: number; amount: number }) {
  return (
    <View style={styles.reward}>
      <Text style={styles.rewardAmount}>{amount}</Text>
      <Image source={icon} style={styles.rewardIcon} contentFit="contain" />
    </View>
  );
}

type RowState = 'locked' | 'claimable' | 'claimed';

function MilestoneRow({
  wave,
  scrap,
  gems,
  state,
  first,
  last,
  onClaim,
}: {
  wave: number;
  scrap: number;
  gems: number;
  state: RowState;
  first: boolean;
  last: boolean;
  onClaim: () => void;
}) {
  const reached = state !== 'locked';
  return (
    <View style={styles.row}>
      <Pressable
        disabled={state !== 'claimable'}
        onPress={onClaim}
        style={({ pressed }) => [
          styles.card,
          reached ? styles.cardReached : styles.cardLocked,
          pressed && state === 'claimable' && styles.cardPressed,
        ]}>
        <RewardChip icon={SCRAP_ICON} amount={scrap} />
        <RewardChip icon={GEM_ICON} amount={gems} />
        {state === 'claimable' && <Text style={styles.claim}>Claim</Text>}
        {state === 'claimed' && <Text style={styles.claimed}>Claimed</Text>}
      </Pressable>

      <View style={styles.tick}>
        <View style={[styles.rail, first && styles.railTop, last && styles.railBottom]} />
        <View style={[styles.railFill, first && styles.railTop, reached ? undefined : styles.railHidden]} />
        <View style={[styles.node, reached ? styles.nodeReached : styles.nodeLocked]}>
          <Text style={styles.nodeText}>{wave}</Text>
        </View>
      </View>
    </View>
  );
}

/** Free milestone track (Figma node 1:1043) — no premium column, no IAP in this game. */
export default function MilestonesScreen() {
  const highestWaveByVoltage = useMetaStore((s) => s.highestWaveByVoltage);
  const claimedKeys = useMetaStore((s) => s.milestonesClaimed);
  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const claimMilestone = useMetaStore((s) => s.claimMilestone);

  const [tier, setTier] = useState(1);
  const voltage = getVoltage(tier);
  const highest = highestWaveByVoltage[tier] ?? 0;
  const unlocked = isVoltageUnlocked(tier, highestWaveByVoltage);
  const req = voltageUnlockRequirement(tier);
  const canPrev = tier > 1;
  const canNext = tier < VOLTAGES.length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={() => {}} />

      <Text style={styles.title}>Milestones</Text>

      <View style={styles.pager}>
        <Pressable hitSlop={12} disabled={!canPrev} onPress={() => setTier((t) => t - 1)}>
          <Image source={ARROW} style={[styles.arrow, !canPrev && styles.arrowDim]} contentFit="contain" />
        </Pressable>
        <View style={styles.pagerLabel}>
          <Text style={[styles.voltage, !unlocked && styles.voltageLocked]}>{voltage.name}</Text>
          {!unlocked && req && (
            <Text style={styles.lockHint}>Reach wave {req.wave} on Voltage {req.prevTier}</Text>
          )}
        </View>
        <Pressable hitSlop={12} disabled={!canNext} onPress={() => setTier((t) => t + 1)}>
          <Image source={ARROW} style={[styles.arrow, styles.arrowFlip, !canNext && styles.arrowDim]} contentFit="contain" />
        </Pressable>
      </View>

      <Text style={styles.trackLabel}>Free</Text>

      <View style={styles.list}>
        {MILESTONES.map((m, i) => {
          const key = milestoneKey(tier, m.wave);
          const state: RowState = claimedKeys[key] ? 'claimed' : highest >= m.wave ? 'claimable' : 'locked';
          return (
            <MilestoneRow
              key={m.wave}
              wave={m.wave}
              scrap={Math.round(m.scrap * voltage.scrapMult)}
              gems={m.gems}
              state={state}
              first={i === 0}
              last={i === MILESTONES.length - 1}
              onClaim={() => claimMilestone(tier, m.wave)}
            />
          );
        })}
      </View>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const RAIL_W = 4;
const NODE = 40;
/** Cyan edge on a reached milestone card (muted battle charge accent). */
const REACHED_ACCENT = '#3f7d94';

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
    fontSize: 26,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 6,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  pagerLabel: { alignItems: 'center', maxWidth: '64%' },
  voltage: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 20,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  voltageLocked: { opacity: 0.5 },
  lockHint: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 11,
    color: MenuColors.accentBright,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
  },
  arrow: { width: 20, height: 17 },
  arrowFlip: { transform: [{ scaleX: -1 }] },
  arrowDim: { opacity: 0.35 },
  trackLabel: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 18,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 6,
  },
  list: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  card: {
    flex: 1,
    minHeight: 66,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(21,23,34,0.71)',
  },
  cardReached: {
    borderColor: REACHED_ACCENT,
    backgroundColor: 'rgba(24,40,52,0.82)',
  },
  cardLocked: {
    borderColor: 'rgba(255,255,255,0.08)',
    opacity: 0.6,
  },
  cardPressed: { opacity: 0.75 },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  rewardAmount: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 18,
    color: '#ff8a1e',
    textTransform: 'uppercase',
  },
  rewardIcon: { width: 20, height: 22 },
  claim: {
    marginLeft: 'auto',
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 14,
    color: MenuColors.accentBright,
    textTransform: 'uppercase',
  },
  claimed: {
    marginLeft: 'auto',
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
  },
  tick: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: RAIL_W,
    borderRadius: RAIL_W,
    backgroundColor: 'rgba(216,216,216,0.5)',
  },
  railFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: RAIL_W,
    borderRadius: RAIL_W,
    backgroundColor: '#ffa600',
  },
  railHidden: { opacity: 0 },
  railTop: { top: '50%' },
  railBottom: { bottom: '50%' },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeReached: { backgroundColor: '#602500', borderColor: '#e18a34' },
  nodeLocked: { backgroundColor: '#413833', borderColor: '#1c1a17' },
  nodeText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 15,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  bottomSpace: { height: 28 },
});
