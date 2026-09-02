import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TopBar } from '@/components/menu/top-bar';
import { SplashBackground } from '@/components/splash/splash-background';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatNumber } from '@/game/core/numbers';
import { useMetaStore } from '@/game/state/meta-store';

const PANEL = require('@/assets/images/ui/panel-bar.png');
const PILL = require('@/assets/images/ui/pill-button.png');
const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');
const VIDEO_ICON = require('@/assets/images/menu/icon-video.png');

type Tab = 'daily' | 'catalog';

/** Scrap packs sold for gems. Prices scale down per unit as the pack grows. */
const SCRAP_PACKS: { scrap: number; gems: number }[] = [
  { scrap: 25, gems: 10 },
  { scrap: 50, gems: 18 },
  { scrap: 100, gems: 30 },
];

const close = () => router.back();

/**
 * Wide art panel (`panel-bar.png`). The sizing Image is an in-flow child with
 * an explicit `aspectRatio`; content is layered on top via `absoluteFill`.
 * (An `aspectRatio` on the wrapper itself collapses to 0 height on
 * react-native-web when every child is absolutely positioned — see the
 * rn-web-layout-gotchas note.)
 */
function Panel({ children }: { children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <Image source={PANEL} style={StyleSheet.absoluteFill} contentFit="fill" />
      <View style={styles.panelContent}>{children}</View>
    </View>
  );
}

/** Shop (Figma nodes 1:783 "Daily" / 1:803 "Catalog"). */
export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('daily');

  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const buyScrap = useMetaStore((s) => s.buyScrap);

  return (
    <View style={styles.container}>
      <SplashBackground />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}>
        <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={() => {}} />

        <Text style={styles.title}>Shop</Text>

        <View style={styles.tabs}>
          <Pressable onPress={() => setTab('daily')} hitSlop={8}>
            <Text style={[styles.tab, tab !== 'daily' && styles.tabInactive]}>Daily</Text>
          </Pressable>
          <Pressable onPress={() => setTab('catalog')} hitSlop={8}>
            <Text style={[styles.tab, tab !== 'catalog' && styles.tabInactive]}>Catalog</Text>
          </Pressable>
        </View>

        {tab === 'daily' ? (
          <View style={styles.list}>
            <Panel>
              <Image source={VIDEO_ICON} style={styles.videoIcon} contentFit="contain" />
              <Text style={styles.panelTitle}>Daily gems gift</Text>
              <View style={styles.row}>
                <Text style={styles.amount}>+10</Text>
                <Image source={GEM_ICON} style={styles.gemIcon} contentFit="contain" />
              </View>
            </Panel>
          </View>
        ) : (
          <View style={styles.list}>
            {SCRAP_PACKS.map((pack) => {
              const affordable = gems >= pack.gems;
              return (
                <Pressable
                  key={pack.scrap}
                  onPress={() => buyScrap(pack.gems, pack.scrap)}
                  disabled={!affordable}
                  style={({ pressed }) => [
                    pressed && affordable && styles.panelPressed,
                    !affordable && styles.panelDisabled,
                  ]}>
                  <Panel>
                    <View style={styles.row}>
                      <Text style={styles.panelTitle}>+{pack.scrap}</Text>
                      <Image source={SCRAP_ICON} style={styles.scrapIcon} contentFit="contain" />
                      <Text style={styles.panelTitle}>Scrap</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.amount}>{pack.gems}</Text>
                      <Image source={GEM_ICON} style={styles.gemIcon} contentFit="contain" />
                    </View>
                  </Panel>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={close}
          style={({ pressed }) => [styles.back, pressed && styles.panelPressed]}>
          <Image source={PILL} style={styles.backImg} contentFit="fill" />
          <View style={[StyleSheet.absoluteFill, styles.backContent]}>
            <Text style={styles.backText}>Back</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MenuColors.bg },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MenuMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 25,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginTop: 18,
    marginBottom: 8,
  },
  tab: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 26,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
  tabInactive: { opacity: 0.5 },
  list: {
    width: '100%',
    marginTop: 16,
    gap: 14,
  },
  panel: {
    width: '100%',
    // `panel-bar.png` is a ~5.5:1 bar; a stack of three Grenze lines doesn't
    // fit inside that native ratio, so the art stretches (contentFit="fill")
    // to whatever height the content needs, with a floor so it still reads
    // as a bar for short content.
    minHeight: 104,
    justifyContent: 'center',
  },
  panelPressed: { transform: [{ scale: 0.97 }] },
  panelDisabled: { opacity: 0.45 },
  panelContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: '10%',
    paddingVertical: 14,
  },
  panelTitle: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 17,
    lineHeight: 19,
    color: '#ff5900',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amount: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 15,
    lineHeight: 17,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  scrapIcon: { width: 15, height: 18 },
  gemIcon: { width: 17, height: 15 },
  videoIcon: { width: 22, height: 17 },
  back: {
    width: '62%',
    marginTop: 28,
  },
  backImg: {
    width: '100%',
    aspectRatio: 630 / 150,
  },
  backContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 14,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
});
