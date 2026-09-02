import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { BattleColors, Fonts, MenuColors } from '@/constants/theme';

const PANEL_BG = require('@/assets/images/battle/wave-panel.png');

type WavePanelProps = {
  wave: number;
  isBossWave: boolean;
  /** 0..1 — killed vs. this wave's total enemy count. */
  progress: number;
};

/** "WAVE N" chrome + progress bar (Figma node 1:1514) — text/bar are live, the PNG is just the frame. */
export function WavePanel({ wave, isBossWave, progress }: WavePanelProps) {
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={styles.panel}>
      <Image source={PANEL_BG} style={StyleSheet.absoluteFill} contentFit="fill" />
      <View style={styles.content}>
        <Text style={styles.label} numberOfLines={1}>
          {isBossWave ? `Boss · Wave ${wave}` : `Wave ${wave}`}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${clamped * 100}%` }, isBossWave && styles.fillBoss]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 159,
    aspectRatio: 159 / 54,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  label: {
    width: '100%',
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 13,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  track: {
    // ~matches the design's Rectangle 4318 width relative to the panel.
    width: '67%',
    height: 6,
    borderRadius: 3,
    backgroundColor: BattleColors.waveTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: BattleColors.waveFillTo,
  },
  fillBoss: {
    backgroundColor: BattleColors.bossTag,
  },
});
