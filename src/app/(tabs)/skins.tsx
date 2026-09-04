import { Image, ImageBackground } from 'expo-image';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/menu/top-bar';
import { GamePressable } from '@/components/ui/game-pressable';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatNumber } from '@/game/core/numbers';
import { isSkinUnlocked, SKINS, type SkinDef } from '@/game/data/skins';
import { useMetaStore } from '@/game/state/meta-store';

const CARD_FRAME = require('@/assets/images/skins/card-frame.png');
const CARD_BUTTON = require('@/assets/images/skins/card-button.png');
const LOCK = require('@/assets/images/skins/lock.png');

type CardState = 'locked' | 'unlocked' | 'selected';

function SkinCard({
  skin,
  state,
  onSelect,
}: {
  skin: SkinDef;
  state: CardState;
  onSelect: () => void;
}) {
  const locked = state === 'locked';
  return (
    <GamePressable
      disabled={locked || state === 'selected'}
      onPress={onSelect}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <ImageBackground source={CARD_FRAME} style={styles.cardFrame} contentFit="fill">
        {state === 'selected' && <View style={styles.selectedGlow} pointerEvents="none" />}

        <Text style={[styles.name, locked && styles.dim]} numberOfLines={1}>
          {skin.name}
        </Text>

        <View style={styles.art}>
          {locked ? (
            <>
              <Image source={LOCK} style={styles.lock} contentFit="contain" />
              <Text style={styles.req} numberOfLines={2}>
                Voltage {skin.unlock.voltage} Wave {skin.unlock.wave}
              </Text>
            </>
          ) : (
            <Image source={skin.icon} style={styles.icon} contentFit="contain" />
          )}
        </View>

        {/* Only an unlocked skin gets the "select" button — a locked card is
            just name + lock + requirement, per the Figma design. */}
        {!locked && (
          <View style={styles.buttonRow}>
            <ImageBackground source={CARD_BUTTON} style={styles.button} contentFit="fill">
              <Text style={[styles.buttonText, state === 'selected' && styles.buttonTextSelected]}>
                {state === 'selected' ? 'Selected' : 'Select'}
              </Text>
            </ImageBackground>
          </View>
        )}
      </ImageBackground>
    </GamePressable>
  );
}

/** Tower skins grid (Figma node 106:1100, "Skins"). Unlocks are wave gates — see data/skins.ts. */
export default function SkinsScreen() {
  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const highestWaveByVoltage = useMetaStore((s) => s.highestWaveByVoltage);
  const selectedSkin = useMetaStore((s) => s.selectedSkin);
  const selectSkin = useMetaStore((s) => s.selectSkin);

  const cards = useMemo(
    () =>
      SKINS.map((skin) => {
        const state: CardState = !isSkinUnlocked(skin, highestWaveByVoltage)
          ? 'locked'
          : skin.id === selectedSkin
            ? 'selected'
            : 'unlocked';
        return { skin, state };
      }),
    [highestWaveByVoltage, selectedSkin],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={() => {}} />

      <Text style={styles.title}>Skins</Text>

      <View style={styles.grid}>
        {cards.map(({ skin, state }) => (
          <SkinCard key={skin.id} skin={skin} state={state} onSelect={() => selectSkin(skin.id)} />
        ))}
      </View>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MenuMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 14,
  },
  title: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 26,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 6,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  card: {
    width: '31.8%',
  },
  cardPressed: { opacity: 0.75 },
  cardFrame: {
    width: '100%',
    aspectRatio: 397 / 257,
    overflow: 'hidden',
    paddingTop: '7%',
    paddingBottom: '5%',
    alignItems: 'center',
  },
  selectedGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: MenuColors.accentBright,
  },
  name: {
    maxWidth: '86%',
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 10,
    lineHeight: 12,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  dim: { opacity: 0.5 },
  art: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: '46%',
    height: '92%',
  },
  lock: {
    width: 22,
    height: 28,
    opacity: 0.9,
  },
  req: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 8,
    lineHeight: 10,
    color: MenuColors.accentBright,
    textTransform: 'uppercase',
    textAlign: 'center',
    opacity: 0.8,
  },
  buttonRow: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: '64%',
    aspectRatio: 630 / 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 8.5,
    color: '#0dff00',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  buttonTextSelected: { color: MenuColors.accentBright },
  bottomSpace: { height: 28 },
});
