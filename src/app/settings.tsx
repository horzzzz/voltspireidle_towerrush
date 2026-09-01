import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toggle } from '@/components/settings/toggle';
import { openPrivacy, openTerms } from '@/constants/links';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';

const BACK_BUTTON = require('@/assets/images/ui/pill-button.png');

const close = () => router.back();

type Settings = { music: boolean; sound: boolean; vibration: boolean; notification: boolean };

const DEFAULTS: Settings = { music: true, sound: false, vibration: true, notification: false };

/** Settings modal (Figma node 1:229). Values are local state for now. */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const set = (key: keyof Settings) => (next: boolean) =>
    setSettings((s) => ({ ...s, [key]: next }));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.panel}>
          <View style={styles.panelInner}>
            <Row label="Music" value={settings.music} onChange={set('music')} />
            <Row label="Sound" value={settings.sound} onChange={set('sound')} />
            <View style={styles.groupGap} />
            <Row label="Vibration" value={settings.vibration} onChange={set('vibration')} />
            <Row label="Notification" value={settings.notification} onChange={set('notification')} />

            <View style={styles.links}>
              <Pressable onPress={openTerms} hitSlop={10}>
                <Text style={styles.link}>Terms of use</Text>
              </Pressable>
              <Pressable onPress={openPrivacy} hitSlop={10}>
                <Text style={styles.link}>Privacy policy</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable
          onPress={close}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
          <Image source={BACK_BUTTON} style={StyleSheet.absoluteFill} contentFit="fill" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Toggle value={value} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Dim tint over the menu behind (Figma node 1:260). Kept fairly opaque
  // since we have no blur to soften the screen underneath.
  container: { flex: 1, backgroundColor: 'rgba(19,22,35,0.96)' },
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
    marginBottom: 24,
  },
  panel: {
    width: '92%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3b19ff',
    backgroundColor: '#3b19ff',
    padding: 3,
    marginTop: 8,
  },
  panelInner: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: '#131c2e',
    paddingHorizontal: 22,
    paddingTop: 36,
    paddingBottom: 34,
  },
  row: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 22,
    lineHeight: 26,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  groupGap: { height: 20 },
  links: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 15,
    color: MenuColors.text,
    textTransform: 'capitalize',
    textDecorationLine: 'underline',
  },
  back: {
    width: '62%',
    aspectRatio: 630 / 150,
    marginTop: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { transform: [{ scale: 0.96 }] },
  backText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 15,
    lineHeight: 18,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
});
