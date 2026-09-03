import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RewardOverlay } from '@/components/fx/reward-overlay';
import { SplashBackground } from '@/components/splash/splash-background';
import { BottomNav } from '@/components/menu/bottom-nav';
import { MenuColors, MenuMaxWidth } from '@/constants/theme';

/**
 * Shell for the tabbed app screens. The background and the bottom nav live
 * here so they persist across tab switches instead of remounting per route.
 *
 * Headless tabs (`expo-router/ui`) rather than the built-in `<Tabs>`
 * navigator: the bar is fully custom game art, so `BottomNav` renders it as
 * a plain flex child and `<TabList>` only declares the routes.
 */
export default function TabsLayout() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // Hide Android's system navigation bar inside the app (immersive).
    NavigationBar.setVisibilityAsync('hidden').catch(() => {});
  }, []);

  return (
    <Tabs style={{ flex: 1, backgroundColor: MenuColors.bg }}>
      <SplashBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <TabSlot style={{ flex: 1 }} />
        <View style={{ width: '100%', maxWidth: MenuMaxWidth, alignSelf: 'center' }}>
          <BottomNav />
        </View>
      </SafeAreaView>

      {/* One overlay for every tab screen — claim bursts from Milestones,
          Missions and Coilworks all draw through it. */}
      <RewardOverlay />

      <TabList style={{ display: 'none' }}>
        <TabTrigger name="game" href="/" />
        <TabTrigger name="upgrades" href="/upgrades" />
        <TabTrigger name="chips" href="/chips" />
        <TabTrigger name="milestones" href="/milestones" />
        <TabTrigger name="missions" href="/missions" />
        <TabTrigger name="relics" href="/relics" />
      </TabList>
    </Tabs>
  );
}
