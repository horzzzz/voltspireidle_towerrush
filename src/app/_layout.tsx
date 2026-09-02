import {
  Grenze_400Regular,
  Grenze_500Medium,
  Grenze_600SemiBold,
  useFonts,
} from '@expo-google-fonts/grenze';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/splash/loading-screen';
import { StartScreen } from '@/components/splash/start-screen';
import { useMetaStore } from '@/game/state/meta-store';

SplashScreen.preventAutoHideAsync().catch(() => {});

type Phase = 'loading' | 'start' | 'app';

export default function RootLayout() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [fontsLoaded] = useFonts({
    Grenze_400Regular,
    Grenze_500Medium,
    Grenze_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  const handleLoadingDone = useCallback(() => setPhase('start'), []);
  const handleStart = useCallback(() => {
    // Rolls today's daily/weekly missions if the calendar day/week has
    // turned over since the last session — before any screen that reads
    // them mounts, so Missions never flashes yesterday's list first.
    useMetaStore.getState().ensureMissionsForToday();
    setPhase('app');
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {phase === 'loading' && <LoadingScreen onDone={handleLoadingDone} />}
        {phase === 'start' && <StartScreen onStart={handleStart} />}
        {phase === 'app' && (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="battle" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen
              name="daily-reward"
              options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="settings"
              options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="wheel"
              options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="shop"
              options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
            />
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
