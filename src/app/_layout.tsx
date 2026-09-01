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
  const handleStart = useCallback(() => setPhase('app'), []);

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
            <Stack.Screen
              name="daily-reward"
              options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
            />
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
