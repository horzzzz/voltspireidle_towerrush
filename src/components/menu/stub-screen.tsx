import { StyleSheet, Text, View } from 'react-native';

import { Fonts, MenuColors } from '@/constants/theme';

/** Placeholder body for tabs that aren't built yet. Background comes from the tabs layout. */
export function StubScreen({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 34,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 18,
    color: MenuColors.accent,
    textTransform: 'uppercase',
  },
});
