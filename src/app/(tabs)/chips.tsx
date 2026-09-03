import { Image } from 'expo-image';
import { useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { COMMON_CHIPS, MAX_STARS, RARE_CHIPS, starsForRarity, type ChipDef } from '@/game/data/chips';

const CARD_FRAME = require('@/assets/images/chips/card-frame.png');
const CHIP_CARD_FRAME = require('@/assets/images/chips/chip-card.png');
const BUY_BUTTON = require('@/assets/images/chips/buy-button.png');
const CHIP_LOCKED = require('@/assets/images/chips/chip-locked.png');
const MODAL_FRAME = require('@/assets/images/chips/modal-frame.png');
const MODAL_CLOSE = require('@/assets/images/chips/modal-close.png');
const LEVELUP_BOX = require('@/assets/images/chips/levelup-box.png');
const EQUIP_BUTTON = require('@/assets/images/chips/equip-button.png');
const GEM = require('@/assets/images/menu/icon-gem.png');

/**
 * Figma "Chips" (frame 106:1881, detail card 106:2015). Flex flow for
 * arrangement; card / button boxes get explicit pixel dimensions from one
 * measured width, because `aspectRatio` inside a wrapping flex row does not
 * resolve reliably here. Layout only — no economy wiring.
 */
const CHIP_RATIO = 130.866 / 84.716; // ≈ 1.545
const LOADOUT_RATIO = 168.377 / 109;
const BUY_RATIO = 199 / 47.381;

const GRID_PAD = 13;
const COL_GAP = 6;
const HEAD_PAD = 33;

function GemAmount({ amount, size, dim }: { amount: number; size: number; dim?: boolean }) {
  return (
    <View style={[styles.gemRow, dim && styles.dim]}>
      <Text style={[styles.gemText, { fontSize: size }]}>{amount}</Text>
      <Image source={GEM} style={{ width: size * 1.1, height: size }} contentFit="contain" />
    </View>
  );
}

function ChipCard({ chip, w, h, onPress }: { chip: ChipDef; w: number; h: number; onPress: () => void }) {
  // A locked chip is inert — no press, no detail card (Figma: only owned chips open).
  return (
    <Pressable
      style={({ pressed }) => [{ width: w, height: h }, pressed && chip.owned && styles.cardPressed]}
      disabled={!chip.owned}
      onPress={onPress}>
      <Image source={CHIP_CARD_FRAME} style={styles.fill} contentFit="fill" />
      <View style={[styles.fill, styles.chipBody]}>
        {chip.owned ? (
          <>
            <Image source={chip.icon} style={{ width: h * 0.32, height: h * 0.32 }} contentFit="contain" />
            <View style={styles.centerCol}>
              <Text style={styles.chipName} numberOfLines={1}>
                {chip.name}
              </Text>
              <Text style={styles.chipLevel}>Lvl {chip.level}</Text>
            </View>
          </>
        ) : (
          <Image source={CHIP_LOCKED} style={{ width: h * 0.4, height: h * 0.4 }} contentFit="contain" />
        )}
      </View>
    </Pressable>
  );
}

function RaritySection({
  title,
  chips,
  cardW,
  cardH,
  onSelect,
}: {
  title: string;
  chips: ChipDef[];
  cardW: number;
  cardH: number;
  onSelect: (c: ChipDef) => void;
}) {
  return (
    <>
      <View style={styles.strip}>
        <Text style={styles.stripText}>{title}</Text>
      </View>
      <View style={styles.grid}>
        {chips.map((chip) => (
          <ChipCard key={chip.id} chip={chip} w={cardW} h={cardH} onPress={() => onSelect(chip)} />
        ))}
      </View>
    </>
  );
}

function StarRow({ filled }: { filled: number }) {
  return (
    <Text style={styles.stars}>
      {Array.from({ length: MAX_STARS }, (_, i) => (i < filled ? '★' : '–')).join(' ')}
    </Text>
  );
}

/** Chip detail card — Figma node 106:2015 (attack_speed_txt). */
function ChipDetail({ chip, onClose }: { chip: ChipDef; onClose: () => void }) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={() => {}}>
          <Image source={MODAL_FRAME} style={[styles.fill, styles.panelBg]} contentFit="fill" />

          <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
            <Image source={MODAL_CLOSE} style={styles.closeIcon} contentFit="contain" />
          </Pressable>

          <View style={styles.panelBody}>
            <View style={styles.detailHead}>
              <Image source={chip.icon} style={styles.detailIcon} contentFit="contain" />
              <Text style={styles.detailTitle}>{chip.name}</Text>
            </View>
            <Text style={styles.detailRarity}>{chip.rarity}</Text>
            <StarRow filled={starsForRarity(chip.rarity)} />

            <Text style={styles.detailDesc}>
              {chip.description}
              {'\n'}Effect: {chip.effect}
              {'\n'}Duplicates owned: {chip.duplicates}
            </Text>

            <View style={styles.levelupBox}>
              <Image source={LEVELUP_BOX} style={styles.fill} contentFit="fill" />
              <View style={styles.levelupBody}>
                <Text style={styles.levelupTitle}>Level up</Text>
                <Text style={styles.levelupSub}>20 gems</Text>
              </View>
            </View>

            <View style={styles.equip}>
              <Image source={EQUIP_BUTTON} style={styles.fill} contentFit="fill" />
              <Text style={styles.equipText}>{chip.owned ? 'Equip' : 'Locked'}</Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Chips screen — inventory + loadout + detail card (Figma frame 106:1881). Layout only. */
export default function ChipsScreen() {
  const [w, setW] = useState(0);
  const [selected, setSelected] = useState<ChipDef | null>(null);
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
    <>
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
            <RaritySection title="Common" chips={COMMON_CHIPS} cardW={cardW} cardH={cardH} onSelect={setSelected} />
            <RaritySection title="Rare" chips={RARE_CHIPS} cardW={cardW} cardH={cardH} onSelect={setSelected} />

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

      {selected && <ChipDetail chip={selected} onClose={() => setSelected(null)} />}
    </>
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
  cardPressed: { opacity: 0.75 },
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

  // --- Detail card (modal) ---
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,5,12,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 341.831 / 397,
    overflow: 'hidden',
  },
  panelBg: {  },
  panelBody: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    paddingHorizontal: '16%',
    paddingVertical: '12%',
    alignItems: 'center',
  },
  close: {
    position: 'absolute',
    top: '5%',
    right: '5%',
    width: 34,
    height: 34,
    zIndex: 2,
  },
  closeIcon: { width: '100%', height: '100%' },
  detailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailIcon: { width: 32, height: 32 },
  detailTitle: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 20,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailRarity: {
    marginTop: 6,
    fontFamily: Fonts.grenzeRegular,
    fontSize: 13,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stars: {
    marginTop: 4,
    fontFamily: Fonts.grenzeRegular,
    fontSize: 13,
    color: MenuColors.accentBright,
    letterSpacing: 2,
  },
  detailDesc: {
    flex: 1,
    textAlignVertical: 'center',
    fontFamily: Fonts.grenzeRegular,
    fontSize: 13,
    lineHeight: 19,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  levelupBox: {
    width: '100%',
    aspectRatio: 294.198 / 80.061,
    marginBottom: '4%',
  },
  levelupBody: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  levelupTitle: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 14,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  levelupSub: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 12,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  equip: {
    width: '76%',
    aspectRatio: 236.626 / 56.34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 15,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
