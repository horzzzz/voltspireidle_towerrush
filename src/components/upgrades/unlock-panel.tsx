import { Image } from 'expo-image';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PriceTag } from '@/components/upgrades/price-tag';
import { Fonts, MenuColors } from '@/constants/theme';
import { burstFrom } from '@/game/state/fx-store';

const PANEL_BG = require('@/assets/images/ui/panel-bar.png');

type UnlockPanelProps = {
  label: string;
  price: string;
  /** Return `false` when the unlock was refused — nothing sparkles then. */
  onPress: () => boolean | void;
};

/** Framed "UNLOCK …" row that reveals a new upgrade when tapped (Figma node 1:477). */
export function UnlockPanel({ label, price, onPress }: UnlockPanelProps) {
  const panelRef = useRef<View>(null);
  return (
    <Pressable
      ref={panelRef}
      onPress={() => {
        if (onPress() === false) return;
        // A branch opening up is a bigger deal than a level — give it the
        // jackpot treatment rather than the ordinary level-up pop.
        burstFrom(panelRef.current, 'jackpot', 1.4);
      }}
      style={({ pressed }) => [styles.panel, pressed && styles.pressed]}>
      <Image source={PANEL_BG} style={StyleSheet.absoluteFill} contentFit="fill" />
      <View style={[StyleSheet.absoluteFill, styles.content]}>
        <Text style={styles.label}>{label}</Text>
        <PriceTag price={price} small />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    aspectRatio: 780 / 141,
    marginTop: 8,
  },
  pressed: { opacity: 0.85 },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: '14%',
  },
  label: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 13,
    lineHeight: 16,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
