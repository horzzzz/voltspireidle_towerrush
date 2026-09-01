import { StyleSheet, Text, View } from 'react-native';

import { Fonts, MenuColors } from '@/constants/theme';

/** Category divider (Figma node 1:468). */
export function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(21,23,34,0.71)',
    borderBottomWidth: 1,
    borderBottomColor: MenuColors.accent,
    marginTop: 12,
  },
  text: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 15,
    lineHeight: 18,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
});
