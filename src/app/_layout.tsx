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
import { initAudio, startMusic } from '@/game/audio/engine';
import { applySavedAudioSettings } from '@/game/state/audio-store';
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

  // Decoding twenty clips takes a moment, so it runs alongside the fonts and
  // the loading bar rather than after them. Nothing waits on it: every entry
  // point in `audio/engine.ts` is a no-op until it resolves, which at worst
  // costs the very first tap its click.
  useEffect(() => {
    // Before init, so the engine builds its gain nodes at the saved level
    // rather than at full and then correcting.
    applySavedAudioSettings();
    void initAudio();
  }, []);

  const handleLoadingDone = useCallback(() => setPhase('start'), []);
  const handleStart = useCallback(() => {
    // Rolls today's daily/weekly missions if the calendar day/week has
    // turned over since the last session — before any screen that reads
    // them mounts, so Missions never flashes yesterday's list first.
    useMetaStore.getState().ensureMissionsForToday();
    // The theme starts here rather than on mount because this tap is the only
    // user gesture the app is guaranteed to get, and a browser hands out a
    // suspended audio context until it sees one.
    startMusic();
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
