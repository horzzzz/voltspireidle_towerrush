import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RewardCard, type RewardIcon } from '@/components/daily-reward/reward-card';
import { SplashBackground } from '@/components/splash/splash-background';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';

const TITLE = require('@/assets/images/daily-reward/title.png');
const DAY7_BAR = require('@/assets/images/daily-reward/day7-bar.png');
const CLAIM_BUTTON = require('@/assets/images/ui/pill-button.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');

const CURRENT_DAY = 1;

const REWARDS: { day: number; amount: string; icon: RewardIcon }[] = [
  { day: 1, amount: '10', icon: 'gem' },
  { day: 2, amount: '10', icon: 'gem' },
  { day: 3, amount: '12', icon: 'utility' },
  { day: 4, amount: '15', icon: 'gem' },
  { day: 5, amount: '4', icon: 'chip' },
  { day: 6, amount: '20', icon: 'gem' },
];
const DAY_7_AMOUNT = '40';

const close = () => router.back();

/** Daily reward modal (Figma node 1:72). Claiming is a stub for now. */
export default function DailyRewardScreen() {
  // `transparentModal` (not `fullScreenModal`) keeps this screen inside the app's
  // view hierarchy so these insets are non-zero; padding is applied explicitly
  // rather than via <SafeAreaView> so the absolutely-positioned close button
  // reliably clears the status bar.
  const insets = useSafeAreaInsets();

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

          <Text style={styles.subtitle}>Your day {CURRENT_DAY} reward is ready</Text>

          <View style={styles.grid}>
            {[REWARDS.slice(0, 3), REWARDS.slice(3, 6)].map((row, i) => (
              <View key={i} style={styles.gridRow}>
                {row.map((r) => (
                  <RewardCard key={r.day} day={r.day} amount={r.amount} icon={r.icon} />
                ))}
              </View>
            ))}
          </View>

          <View style={styles.day7}>
            <Image source={DAY7_BAR} style={StyleSheet.absoluteFill} contentFit="fill" />
            <View style={[StyleSheet.absoluteFill, styles.day7Content]}>
              <View style={styles.day7Amount}>
                <Image source={GEM_ICON} style={styles.day7Icon} contentFit="contain" />
                <Text style={styles.day7AmountText}>+{DAY_7_AMOUNT}</Text>
              </View>
              <Text style={styles.day7Label}>Day 7</Text>
            </View>
          </View>

          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.claim, pressed && styles.claimPressed]}>
            <Image source={CLAIM_BUTTON} style={StyleSheet.absoluteFill} contentFit="fill" />
            <Text style={styles.claimText}>Claim day {CURRENT_DAY}</Text>
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
  claimPressed: { transform: [{ scale: 0.96 }] },
  claimText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 16,
    lineHeight: 19,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
});
