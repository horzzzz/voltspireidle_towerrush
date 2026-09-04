import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SplashBackground } from '@/components/splash/splash-background';
import { GamePressable } from '@/components/ui/game-pressable';
import { openPrivacy, openTerms } from '@/constants/links';
import { Fonts, SplashColors } from '@/constants/theme';

const LOGO_ASSET = require('@/assets/images/splash/logo.png');
const TOWER_ASSET = require('@/assets/images/splash/tower.png');
const BUTTON_ASSET = require('@/assets/images/splash/button-play.png');

type StartScreenProps = {
  onStart: () => void;
};

/** Welcome / "LET'S PLAY" screen shown after the loading bar (Figma node 1:17). */
export function StartScreen({ onStart }: StartScreenProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <View style={styles.container}>
      <SplashBackground />

      <SafeAreaView style={styles.safeArea}>
        <Image source={LOGO_ASSET} style={styles.logo} contentFit="contain" />

        <View style={styles.middle}>
          <Image source={TOWER_ASSET} style={styles.tower} contentFit="contain" />
        </View>

        <View style={styles.footer}>
          <GamePressable
            onPress={onStart}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            style={[styles.button, pressed && styles.buttonPressed]}>
            <Image source={BUTTON_ASSET} style={styles.buttonImg} contentFit="contain" />
          </GamePressable>

          <Text style={styles.legal}>
            By tapping “Let’s Play” you confirm that you 18+ and
          </Text>

          <View style={styles.links}>
            <Text style={styles.linkText}>our</Text>
            <GamePressable onPress={openTerms} hitSlop={12}>
              <Text style={[styles.linkText, styles.linkUnderline]}>Terms of Use</Text>
            </GamePressable>
            <Text style={styles.linkText}>&amp;</Text>
            <GamePressable onPress={openPrivacy} hitSlop={12}>
              <Text style={[styles.linkText, styles.linkUnderline]}>Privacy policy</Text>
            </GamePressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SplashColors.bg },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: '82%',
    aspectRatio: 1214 / 632,
    marginTop: 24,
  },
  middle: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tower: {
    width: '50%',
    aspectRatio: 998 / 1018,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 12,
  },
  button: {
    width: '80%',
  },
  buttonImg: {
    width: '100%',
    aspectRatio: 600 / 204,
  },
  buttonPressed: {
    transform: [{ scale: 0.96 }],
  },
  legal: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Fonts.grenzeMedium,
    fontSize: 16,
    lineHeight: 20,
    color: SplashColors.text,
  },
  links: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: 5,
    rowGap: 2,
  },
  linkText: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 14,
    color: SplashColors.text,
  },
  linkUnderline: {
    textDecorationLine: 'underline',
  },
});
