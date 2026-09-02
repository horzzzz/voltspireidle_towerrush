import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RewardCard } from '@/components/daily-reward/reward-card';
import { SplashBackground } from '@/components/splash/splash-background';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { dailyRewardForDay } from '@/game/data/daily';
import { dayKey, effectiveNow } from '@/game/economy/clock';
import { useMetaStore } from '@/game/state/meta-store';

const TITLE = require('@/assets/images/daily-reward/title.png');
const DAY7_BAR = require('@/assets/images/ui/panel-bar.png');
const CLAIM_BUTTON = require('@/assets/images/ui/pill-button.png');

const close = () => router.back();

/**
 * Daily reward modal (Figma node 1:72). Every day pays gems on a rising
 * curve (data/daily.ts) — the original's day-3 "tool" and day-5 "power
 * cell" icons map to currencies this game doesn't have, so both cards use
 * the gem icon too (per user direction). The counter climbs past day 7
 * rather than looping — day 8+ just keeps paying the day-7 amount.
 */
export default function DailyRewardScreen() {
  // `transparentModal` (not `fullScreenModal`) keeps this screen inside the app's
  // view hierarchy so these insets are non-zero; padding is applied explicitly
  // rather than via <SafeAreaView> so the absolutely-positioned close button
  // reliably clears the status bar.
  const insets = useSafeAreaInsets();
  const daily = useMetaStore((s) => s.daily);
  const clockHighWater = useMetaStore((s) => s.clockHighWater);
  const claimDaily = useMetaStore((s) => s.claimDaily);

  const now = effectiveNow(clockHighWater);
  const today = dayKey(now);
  const alreadyClaimedToday = daily.lastClaimKey === today;
  const yesterday = dayKey(now - 24 * 60 * 60 * 1000);
  const nextDay = alreadyClaimedToday ? daily.day : daily.lastClaimKey === yesterday ? daily.day + 1 : 1;
  // Which of the 7 visual cards to highlight — the reward itself keeps
  // climbing past day 7, but the ladder art only has one cycle to show.
  const cyclePos = ((nextDay - 1) % 7) + 1;

  return (
    <View style={styles.container}>
      <SplashBackground />

      <View style={styles.safeArea}>
        <Pressable
          onPress={close}
          hitSlop={12}
          style={[styles.close, { top: insets.top + 8 }]}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}>
          <Image source={TITLE} style={styles.title} contentFit="contain" />

          <Text style={styles.subtitle}>
            {alreadyClaimedToday ? 'Come back tomorrow' : `Your day ${nextDay} reward is ready`}
          </Text>

          <View style={styles.grid}>
            {[
              [1, 2, 3],
              [4, 5, 6],
            ].map((row, i) => (
              <View key={i} style={styles.gridRow}>
                {row.map((day) => (
                  <RewardCard
                    key={day}
                    day={day}
                    amount={String(dailyRewardForDay(day))}
                    icon="gem"
                    active={day === cyclePos && !alreadyClaimedToday}
                    past={day < cyclePos || alreadyClaimedToday}
                  />
                ))}
              </View>
            ))}
          </View>

          <View style={styles.day7}>
            <Image source={DAY7_BAR} style={StyleSheet.absoluteFill} contentFit="fill" />
            <View style={[StyleSheet.absoluteFill, styles.day7Content]}>
              <View style={styles.day7Amount}>
                <Image source={require('@/assets/images/menu/icon-gem.png')} style={styles.day7Icon} contentFit="contain" />
                <Text style={styles.day7AmountText}>+{dailyRewardForDay(7)}</Text>
              </View>
              <Text style={styles.day7Label}>Day 7{nextDay > 7 ? '+' : ''}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => {
              if (claimDaily()) close();
            }}
            disabled={alreadyClaimedToday}
            style={({ pressed }) => [
              styles.claim,
              alreadyClaimedToday && styles.claimDisabled,
              pressed && !alreadyClaimedToday && styles.claimPressed,
            ]}>
            <Image source={CLAIM_BUTTON} style={StyleSheet.absoluteFill} contentFit="fill" />
            <Text style={styles.claimText}>{alreadyClaimedToday ? 'Claimed' : `Claim day ${nextDay}`}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MenuColors.bg },
  safeArea: { flex: 1 },
  close: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 20,
    color: MenuColors.text,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MenuMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    width: '58%',
    aspectRatio: 1387 / 748,
  },
  subtitle: {
    marginTop: 12,
    fontFamily: Fonts.grenzeMedium,
    fontSize: 19,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  grid: {
    width: '100%',
    marginTop: 28,
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  day7: {
    width: '100%',
    marginTop: 10,
    aspectRatio: 780 / 141,
  },
  day7Content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '4%',
  },
  day7Amount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  day7Icon: { width: 18, height: 16 },
  day7AmountText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 16,
    lineHeight: 19,
    color: MenuColors.text,
  },
  day7Label: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 16,
    lineHeight: 19,
    color: '#ff5900',
    textTransform: 'uppercase',
  },
  claim: {
    width: '78%',
    aspectRatio: 630 / 150,
    marginTop: 28,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimDisabled: { opacity: 0.5 },
  claimPressed: { transform: [{ scale: 0.96 }] },
  claimText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 16,
    lineHeight: 19,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
});
