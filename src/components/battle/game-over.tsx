import { Image } from 'expo-image';
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { ADS_ENABLED } from '@/constants/features';
import { BattleColors, Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatInt, formatNumber } from '@/game/core/numbers';
import type { RunSummary } from '@/game/core/types';

const TITLE = require('@/assets/images/battle/run-over-title.png');
const PILL = require('@/assets/images/ui/pill-button.png');
const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');
const VIDEO_ICON = require('@/assets/images/menu/icon-video.png');

const noop = () => {};

type GameOverProps = {
  result: RunSummary | null;
  onRestart: () => void;
  /** The run has already ended here — no confirmation needed, unlike the in-battle settings' "To menu". */
  onExit: () => void;
};

/**
 * Run-end overlay (Figma node 1:1689). "Retired" reuses the same RUN OVER
 * title as a defeat — the original's own copy treats retiring as identical
 * to dying ("you'll keep everything earned so far, same as a defeat"), so
 * there's no separate asset or copy for it. "To menu" isn't in the design
 * (only x2-scrap and Restart are) — added per request, styled as a quieter
 * text link so it doesn't compete with the two primary pill buttons.
 *
 * A plain absolute-fill overlay, not RN's `<Modal>` — see battle-settings.tsx
 * for why: the battle screen is itself a `fullScreenModal` route, and RN's
 * own Modal nested inside it is what caused every button on the *next* run
 * to stop responding after leaving through here.
 */
export function GameOver({ result, onRestart, onExit }: GameOverProps) {
  const visible = result != null;

  // No native Modal means no built-in Android back-button handling —
  // treat hardware back the same as tapping "To menu".
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [visible, onExit]);

  if (!result) return null;

  return (
    <View style={styles.backdrop}>
      <View style={styles.content}>
        <Image source={TITLE} style={styles.title} contentFit="contain" />

        <View style={styles.stats}>
          <Text style={styles.stat} numberOfLines={1} adjustsFontSizeToFit>
            Wave reached: <Text style={styles.statValue}>{formatInt(result.waveReached)}</Text>
          </Text>
          <Text style={styles.stat} numberOfLines={1} adjustsFontSizeToFit>
            Scrap earned: <Text style={styles.statValue}>{formatNumber(result.scrapEarned)}</Text>
          </Text>
          {result.gemsCollected > 0 && (
            <View style={styles.gemsRow}>
              <Text style={styles.stat}>Gems: </Text>
              <Text style={styles.statValue}>{formatInt(result.gemsCollected)}</Text>
              <Image source={GEM_ICON} style={styles.gemIcon} contentFit="contain" />
            </View>
          )}
        </View>

        {/* TODO(ads): rewarded video, doubles scrapEarned + gemsCollected before banking. Inert until AdMob is wired up. */}
        {ADS_ENABLED && (
          <Pressable onPress={noop} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            <Image source={PILL} style={StyleSheet.absoluteFill} contentFit="fill" />
            <View style={styles.doubleContent}>
              <Text style={styles.doubleText}>x2</Text>
              <Image source={SCRAP_ICON} style={styles.scrapIcon} contentFit="contain" />
              <Image source={VIDEO_ICON} style={styles.videoIcon} contentFit="contain" />
            </View>
          </Pressable>
        )}

        <Pressable onPress={onRestart} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
          <Image source={PILL} style={StyleSheet.absoluteFill} contentFit="fill" />
          <Text style={styles.restartText}>Restart</Text>
        </Pressable>

        <Pressable onPress={onExit} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.exitText}>To menu</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(24,27,45,0.81)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MenuMaxWidth,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    width: '92%',
    aspectRatio: 337.455 / 116,
  },
  stats: {
    marginTop: 18,
    alignItems: 'center',
    gap: 4,
  },
  stat: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 22,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  statValue: { color: BattleColors.chargeAccent },
  gemsRow: { flexDirection: 'row', alignItems: 'center' },
  gemIcon: { width: 15, height: 14, marginLeft: 4 },
  pill: {
    width: '78%',
    aspectRatio: 630 / 150,
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.96 }] },
  doubleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doubleText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 17,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  scrapIcon: { width: 15, height: 18 },
  videoIcon: { width: 22, height: 17 },
  restartText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 17,
    color: '#e2611c',
    textTransform: 'uppercase',
  },
  exitText: {
    marginTop: 18,
    fontFamily: Fonts.grenzeMedium,
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
});
