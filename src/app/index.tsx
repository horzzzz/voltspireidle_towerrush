import { StyleSheet, Text, View } from 'react-native';

import { Fonts, SplashColors } from '@/constants/theme';

/** Placeholder screen reached after the splash flow. */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SplashColors.bg,
  },
  text: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 32,
    color: SplashColors.text,
    textTransform: 'uppercase',
  },
});
