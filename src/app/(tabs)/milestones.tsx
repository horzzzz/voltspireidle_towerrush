import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { useMetaStore } from '@/game/state/meta-store';
import { formatNumber } from '@/game/core/numbers';

const ARROW = require('@/assets/images/menu/arrow.png');
const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');

/**
 * Free milestone track for the current voltage (Figma node 1:1043).
 * The premium column and "premium pass" copy from the design are dropped —
 * there is no IAP in the game — so the single track is drawn larger.
 */
type Milestone = { wave: number; scrap: number; gems: number };

const VOLTAGES: { name: string; milestones: Milestone[] }[] = [
  {
    name: 'Voltage 1',
    milestones: [
      { wave: 10, scrap: 2, gems: 1 },
      { wave: 20, scrap: 3, gems: 1 },
      { wave: 30, scrap: 4, gems: 2 },
      { wave: 40, scrap: 5, gems: 2 },
      { wave: 50, scrap: 6, gems: 3 },
      { wave: 60, scrap: 8, gems: 3 },
      { wave: 70, scrap: 10, gems: 4 },
      { wave: 80, scrap: 12, gems: 4 },
      { wave: 100, scrap: 15, gems: 5 },
      { wave: 150, scrap: 20, gems: 6 },
      { wave: 200, scrap: 30, gems: 10 },
    ],
  },
];

function RewardChip({ icon, amount }: { icon: number; amount: number }) {
  return (
    <View style={styles.reward}>
      <Text style={styles.rewardAmount}>{amount}</Text>
      <Image source={icon} style={styles.rewardIcon} contentFit="contain" />
    </View>
  );
}

function MilestoneRow({
  milestone,
  reached,
  first,
  last,
}: {
  milestone: Milestone;
  reached: boolean;
  first: boolean;
  last: boolean;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        disabled={!reached}
        style={({ pressed }) => [
          styles.card,
          reached ? styles.cardReached : styles.cardLocked,
          pressed && reached && styles.cardPressed,
        ]}>
        <RewardChip icon={SCRAP_ICON} amount={milestone.scrap} />
        <RewardChip icon={GEM_ICON} amount={milestone.gems} />
        {reached && <Text style={styles.claim}>Claim</Text>}
      </Pressable>

      <View style={styles.tick}>
        <View style={[styles.rail, first && styles.railTop, last && styles.railBottom]} />
        <View style={[styles.railFill, first && styles.railTop, reached ? undefined : styles.railHidden]} />
        <View style={[styles.node, reached ? styles.nodeReached : styles.nodeLocked]}>
          <Text style={styles.nodeText}>{milestone.wave}</Text>
        </View>
      </View>
    </View>
  );
}

export default function MilestonesScreen() {
  const highestWave = useMetaStore((s) => s.highestWave);
  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);

  const voltage = VOLTAGES[0];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={() => {}} />

      <Text style={styles.title}>Milestones</Text>

      <View style={styles.pager}>
        <Pressable hitSlop={12} disabled>
          <Image source={ARROW} style={[styles.arrow, styles.arrowDim]} contentFit="contain" />
        </Pressable>
        <Text style={styles.voltage}>{voltage.name}</Text>
        <Pressable hitSlop={12} disabled>
          <Image source={ARROW} style={[styles.arrow, styles.arrowFlip, styles.arrowDim]} contentFit="contain" />
        </Pressable>
      </View>

      <Text style={styles.trackLabel}>Free</Text>

      <View style={styles.list}>
        {voltage.milestones.map((m, i) => (
          <MilestoneRow
            key={m.wave}
            milestone={m}
            reached={highestWave >= m.wave}
            first={i === 0}
            last={i === voltage.milestones.length - 1}
          />
        ))}
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
  voltage: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 20,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
