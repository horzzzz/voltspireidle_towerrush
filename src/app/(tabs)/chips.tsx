import { Image } from 'expo-image';
import { useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';

const CARD_FRAME = require('@/assets/images/chips/card-frame.png');
const BUY_BUTTON = require('@/assets/images/chips/buy-button.png');
const GEM = require('@/assets/images/menu/icon-gem.png');

/**
 * Figma "Chips" (node 106:1748). Flex flow for arrangement; card boxes get
 * explicit pixel dimensions derived from one measured width, because
 * `aspectRatio` inside a wrapping flex row does not resolve reliably here.
 */
const CHIP_RATIO = 130.866 / 84.716; // ≈ 1.545
const LOADOUT_RATIO = 168.377 / 109; // ≈ 1.545
const BUY_RATIO = 199 / 47.381; // ≈ 4.2

const GRID_PAD = 13; // design: cards start 13px from the frame edge
const COL_GAP = 6; // design: ~6px between columns
const HEAD_PAD = 33; // design: title / loadout block inset

type Chip = { name: string; icon: number };

// Row-major grid order, matching the Figma layout (3 columns).
const COMMON: Chip[] = [
  { name: 'Attack Speed', icon: require('@/assets/images/chips/icon-attack-speed.png') },
  { name: 'Enemy Balance', icon: require('@/assets/images/chips/icon-enemy-balance.png') },
  { name: 'Extra Defense', icon: require('@/assets/images/chips/icon-extra-defense.png') },
  { name: 'Scrap', icon: require('@/assets/images/chips/icon-scrap.png') },
  { name: 'Slow Aura', icon: require('@/assets/images/chips/icon-slow-aura.png') },
  { name: 'Critical Chance', icon: require('@/assets/images/chips/icon-critical-chance.png') },
];

const RARE: Chip[] = [
  { name: 'Free Upgrades', icon: require('@/assets/images/chips/icon-free-upgrades.png') },
  { name: 'Extra Orb', icon: require('@/assets/images/chips/icon-extra-orb.png') },
  { name: 'Charge', icon: require('@/assets/images/chips/icon-charge.png') },
  { name: 'Critical Scrap', icon: require('@/assets/images/chips/icon-critical-scrap.png') },
  { name: 'Intro Sprint', icon: require('@/assets/images/chips/icon-intro-sprint.png') },
  { name: 'Overcharge Core', icon: require('@/assets/images/chips/icon-overcharge-core.png') },
];

function GemAmount({ amount, size, dim }: { amount: number; size: number; dim?: boolean }) {
  return (
    <View style={[styles.gemRow, dim && styles.dim]}>
      <Text style={[styles.gemText, { fontSize: size }]}>{amount}</Text>
      <Image source={GEM} style={{ width: size * 1.1, height: size }} contentFit="contain" />
    </View>
  );
}

function ChipCard({ chip, w, h }: { chip: Chip; w: number; h: number }) {
  return (
    <View style={{ width: w, height: h }}>
      <Image source={CARD_FRAME} style={styles.fill} contentFit="fill" />
      <View style={[styles.fill, styles.chipBody]}>
        <Image source={chip.icon} style={{ width: h * 0.32, height: h * 0.32 }} contentFit="contain" />
        <View style={styles.centerCol}>
          <Text style={styles.chipName} numberOfLines={1}>
            {chip.name}
          </Text>
          <Text style={styles.chipLevel}>Lvl 1</Text>
        </View>
      </View>
    </View>
  );
}

function RaritySection({
  title,
  chips,
  cardW,
  cardH,
}: {
  title: string;
  chips: Chip[];
  cardW: number;
  cardH: number;
}) {
  return (
    <>
      <View style={styles.strip}>
        <Text style={styles.stripText}>{title}</Text>
      </View>
      <View style={styles.grid}>
        {chips.map((chip) => (
          <ChipCard key={chip.name} chip={chip} w={cardW} h={cardH} />
        ))}
      </View>
    </>
  );
}

/** Chips screen — inventory + loadout (Figma node 106:1748). Layout only, no wiring yet. */
export default function ChipsScreen() {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setW(Math.min(e.nativeEvent.layout.width, MenuMaxWidth));

  const gridInner = w - GRID_PAD * 2;
  const cardW = (gridInner - COL_GAP * 2) / 3;
  const cardH = cardW / CHIP_RATIO;

  const loadoutW = (w - HEAD_PAD * 2 - 26) / 2;
  const loadoutH = loadoutW / LOADOUT_RATIO;

  const buyW = (w - 20 - 12) / 2;
  const buyH = buyW / BUY_RATIO;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      onLayout={onLayout}
      showsVerticalScrollIndicator={false}>
      <TopBar scrap="0" gems="0" onEnergyPress={() => {}} />

      <View style={styles.head}>
        <Text style={styles.title}>Chips</Text>
        <Text style={styles.loadoutLabel}>Loadout</Text>
        <Text style={styles.active}>Active 0/1</Text>

        {w > 0 && (
          <View style={styles.loadoutRow}>
            <View style={{ width: loadoutW, height: loadoutH }}>
              <Image source={CARD_FRAME} style={styles.fill} contentFit="fill" />
              <View style={[styles.fill, styles.centerBody]}>
                <Text style={styles.slotEmpty}>Empty</Text>
              </View>
            </View>
            <View style={{ width: loadoutW, height: loadoutH }}>
              <Image source={CARD_FRAME} style={styles.fill} contentFit="fill" />
              <View style={[styles.fill, styles.centerBody]}>
                <Text style={styles.slotText}>Unlock</Text>
                <Text style={styles.slotText}>New socket</Text>
                <GemAmount amount={65} size={13} />
              </View>
            </View>
          </View>
        )}

        <Text style={styles.inventory}>Inventory (by rarity)</Text>
      </View>

      {w > 0 && (
        <>
          <RaritySection title="Common" chips={COMMON} cardW={cardW} cardH={cardH} />
          <RaritySection title="Rare" chips={RARE} cardW={cardW} cardH={cardH} />

          <View style={styles.buyRow}>
            {[
              { label: 'Buy x1', cost: 20 },
              { label: 'Buy x10', cost: 200 },
            ].map((b) => (
              <View key={b.label} style={{ width: buyW, height: buyH }}>
                <Image source={BUY_BUTTON} style={styles.fill} contentFit="fill" />
                <View style={[styles.fill, styles.buyBody]}>
                  <Text style={styles.buyLabel}>{b.label}</Text>
                  <GemAmount amount={b.cost} size={11} dim />
                </View>
              </View>
            ))}
          </View>
        </>
      )}

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
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  head: { paddingHorizontal: HEAD_PAD },
  title: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 24,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 8,
  },
  loadoutLabel: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 18,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 12,
  },
  active: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 15,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 8,
  },
  loadoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  centerBody: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  slotEmpty: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 20,
    color: MenuColors.text,
    textTransform: 'uppercase',
    opacity: 0.5,
  },
  slotText: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 14,
    lineHeight: 17,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  inventory: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 17,
    color: MenuColors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 18,
  },
  strip: {
    width: '100%',
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 14,
    backgroundColor: 'rgba(21,23,34,0.71)',
    borderBottomWidth: 1,
    borderBottomColor: MenuColors.accent,
  },
  stripText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 14,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 9,
    paddingHorizontal: GRID_PAD,
    paddingTop: 15,
  },
  chipBody: {
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: '8%',
  },
  centerCol: { alignItems: 'center' },
  chipName: {
    maxWidth: '96%',
    fontFamily: Fonts.grenzeRegular,
    fontSize: 9,
    lineHeight: 11,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  chipLevel: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 9,
    lineHeight: 11,
    color: MenuColors.text,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  gemRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gemText: { fontFamily: Fonts.grenzeSemiBold, color: MenuColors.text },
  dim: { opacity: 0.5 },
  buyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 10,
  },
  buyBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buyLabel: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 13,
    color: MenuColors.text,
    textTransform: 'uppercase',
    opacity: 0.5,
  },
  bottomSpace: { height: 28 },
});
