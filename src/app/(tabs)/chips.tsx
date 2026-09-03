import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TopBar } from '@/components/menu/top-bar';
import { Fonts, MenuColors, MenuMaxWidth } from '@/constants/theme';
import { formatNumber } from '@/game/core/numbers';
import { CHIP_ICONS } from '@/game/data/chip-icons';
import {
  CHIP_BY_ID,
  CHIP_LEVEL_UP_GEMS,
  CHIP_MAX_LEVEL,
  CHIP_MAX_SOCKETS,
  CHIP_PULL_COST,
  COMMON_CHIPS,
  MAX_STARS,
  RARE_CHIPS,
  formatChipEffect,
  nextSocketCost,
  type ChipDef,
} from '@/game/data/chips';
import { burstFrom } from '@/game/state/fx-store';
import { useMetaStore } from '@/game/state/meta-store';

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
 * resolve reliably here.
 *
 * Economy lives in `game/state/meta-store` (`chips`) and `game/data/chips.ts`;
 * this screen only reads and calls it. Note that equipping affects the *next*
 * run — `app/battle.tsx` freezes the loadout when a run starts.
 */
const CHIP_RATIO = 130.866 / 84.716; // ≈ 1.545
const LOADOUT_RATIO = 168.377 / 109;
const BUY_RATIO = 199 / 47.381;

const GRID_PAD = 13;
const COL_GAP = 6;
const HEAD_PAD = 33;

/** How long a just-pulled / just-levelled card stays lit. */
const FLASH_MS = 1200;

function GemAmount({ amount, size, dim }: { amount: number; size: number; dim?: boolean }) {
  return (
    <View style={[styles.gemRow, dim && styles.dim]}>
      <Text style={[styles.gemText, { fontSize: size }]}>{amount}</Text>
      <Image source={GEM} style={{ width: size * 1.1, height: size }} contentFit="contain" />
    </View>
  );
}

function ChipCard({
  chip,
  level,
  equipped,
  flashing,
  w,
  h,
  onPress,
}: {
  chip: ChipDef;
  /** 0 = not owned yet, shown as "?" in the design. */
  level: number;
  equipped: boolean;
  flashing: boolean;
  w: number;
  h: number;
  onPress: () => void;
}) {
  const owned = level > 0;
  // A locked chip is inert — no press, no detail card (Figma: only owned chips open).
  return (
    <Pressable
      style={({ pressed }) => [{ width: w, height: h }, pressed && owned && styles.cardPressed]}
      disabled={!owned}
      onPress={onPress}>
      <Image source={CHIP_CARD_FRAME} style={styles.fill} contentFit="fill" />
      {equipped && <View style={[styles.fill, styles.cardEquipped]} pointerEvents="none" />}
      {flashing && <View style={[styles.fill, styles.cardFlash]} pointerEvents="none" />}
      <View style={[styles.fill, styles.chipBody]}>
        {owned ? (
          <>
            <Image source={CHIP_ICONS[chip.id]} style={{ width: h * 0.32, height: h * 0.32 }} contentFit="contain" />
            <View style={styles.centerCol}>
              <Text style={styles.chipName} numberOfLines={1}>
                {chip.name}
              </Text>
              <Text style={styles.chipLevel}>Lvl {level}</Text>
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
  levels,
  equipped,
  flashId,
  cardW,
  cardH,
  onSelect,
}: {
  title: string;
  chips: ChipDef[];
  levels: Record<string, number>;
  equipped: string[];
  flashId: string | null;
  cardW: number;
  cardH: number;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <View style={styles.strip}>
        <Text style={styles.stripText}>{title}</Text>
      </View>
      <View style={styles.grid}>
        {chips.map((chip) => (
          <ChipCard
            key={chip.id}
            chip={chip}
            level={levels[chip.id] ?? 0}
            equipped={equipped.includes(chip.id)}
            flashing={flashId === chip.id}
            w={cardW}
            h={cardH}
            onPress={() => onSelect(chip.id)}
          />
        ))}
      </View>
    </>
  );
}

/** Six pips, one per chip level (`CHIP_MAX_LEVEL`). */
function StarRow({ filled }: { filled: number }) {
  return (
    <Text style={styles.stars}>
      {Array.from({ length: MAX_STARS }, (_, i) => (i < filled ? '★' : '–')).join(' ')}
    </Text>
  );
}

/** Chip detail card — Figma node 106:2015 (attack_speed_txt). */
function ChipDetail({ chipId, onClose }: { chipId: string; onClose: () => void }) {
  const chip = CHIP_BY_ID[chipId];
  const gems = useMetaStore((s) => s.gems);
  const chips = useMetaStore((s) => s.chips);
  const levelUpChip = useMetaStore((s) => s.levelUpChip);
  const equipChip = useMetaStore((s) => s.equipChip);
  const unequipChip = useMetaStore((s) => s.unequipChip);
  const boxRef = useRef<View>(null);

  const level = chips.levels[chipId] ?? 0;
  const duplicates = chips.copies[chipId] ?? 0;
  const isEquipped = chips.equipped.includes(chipId);
  const maxed = level >= CHIP_MAX_LEVEL;
  const canLevelUp = level > 0 && !maxed && duplicates >= 1 && gems >= CHIP_LEVEL_UP_GEMS;
  const hasFreeSocket = chips.equipped.length < chips.sockets;
  const canEquip = level > 0 && (isEquipped || hasFreeSocket);

  const equipLabel = isEquipped ? 'Unequip' : hasFreeSocket ? 'Equip' : 'Loadout full';

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
              <Image source={CHIP_ICONS[chip.id]} style={styles.detailIcon} contentFit="contain" />
              <Text style={styles.detailTitle}>{chip.name}</Text>
            </View>
            <Text style={styles.detailRarity}>{chip.rarity}</Text>
            <StarRow filled={level} />

            <Text style={styles.detailDesc}>
              {chip.description}
              {'\n'}Effect: {formatChipEffect(chip, Math.max(1, level))}
              {'\n'}Duplicates owned: {duplicates}
            </Text>

            <Pressable
              ref={boxRef}
              style={[styles.levelupBox, !canLevelUp && styles.dim]}
              disabled={!canLevelUp}
              onPress={() => {
                if (!levelUpChip(chipId)) return;
                burstFrom(boxRef.current, 'levelUp');
              }}>
              <Image source={LEVELUP_BOX} style={styles.fill} contentFit="fill" />
              <View style={styles.levelupBody}>
                <Text style={styles.levelupTitle}>{maxed ? 'Max level' : 'Level up'}</Text>
                {/* The duplicate drops out of the price line once one is in
                    hand — what's left is what the tap actually still costs. */}
                {!maxed && (
                  <Text style={styles.levelupSub}>
                    {duplicates >= 1
                      ? `${CHIP_LEVEL_UP_GEMS} gems`
                      : `1 duplicate + ${CHIP_LEVEL_UP_GEMS} gems`}
                  </Text>
                )}
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.equip, !canEquip && styles.dim, pressed && canEquip && styles.cardPressed]}
              disabled={!canEquip}
              onPress={() => (isEquipped ? unequipChip(chipId) : equipChip(chipId))}>
              <Image source={EQUIP_BUTTON} style={styles.fill} contentFit="fill" />
              <Text style={styles.equipText}>{equipLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Chips screen — inventory + loadout + detail card (Figma frame 106:1881). */
export default function ChipsScreen() {
  const [w, setW] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buyRef = useRef<View>(null);

  const scrap = useMetaStore((s) => s.scrap);
  const gems = useMetaStore((s) => s.gems);
  const chips = useMetaStore((s) => s.chips);
  const pullChip = useMetaStore((s) => s.pullChip);
  const unequipChip = useMetaStore((s) => s.unequipChip);
  const unlockChipSocket = useMetaStore((s) => s.unlockChipSocket);

  // A plain timeout rather than a Reanimated value: the highlight is a one-off
  // 1.2s tint on a card that is already re-rendering from store state, and
  // keeping it out of shared values avoids the write-order trap noted in the
  // react-compiler-shared-value-order memory.
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const flash = (id: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashId(id);
    flashTimer.current = setTimeout(() => setFlashId(null), FLASH_MS);
  };

  const onLayout = (e: LayoutChangeEvent) =>
    setW(Math.min(e.nativeEvent.layout.width, MenuMaxWidth));

  const gridInner = w - GRID_PAD * 2;
  const cardW = (gridInner - COL_GAP * 2) / 3;
  const cardH = cardW / CHIP_RATIO;

  const loadoutW = (w - HEAD_PAD * 2 - 26) / 2;
  const loadoutH = loadoutW / LOADOUT_RATIO;

  // One centered button now that "Buy x10" is gone — same art, kept close to
  // the design's own button proportions.
  const buyW = Math.min((w - 20) * 0.62, 260);
  const buyH = buyW / BUY_RATIO;

  const socketCost = nextSocketCost(chips.sockets);
  const canPull = gems >= CHIP_PULL_COST;

  const handlePull = () => {
    const result = pullChip();
    if (!result) return;
    burstFrom(buyRef.current, result.isNew ? 'jackpot' : 'levelUp', result.isNew ? 1.8 : 1.2);
    flash(result.id);
  };

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onLayout={onLayout}
        showsVerticalScrollIndicator={false}>
        <TopBar scrap={formatNumber(scrap)} gems={formatNumber(gems)} onEnergyPress={() => {}} />

        <View style={styles.head}>
          <Text style={styles.title}>Chips</Text>
          <Text style={styles.loadoutLabel}>Loadout</Text>
          <Text style={styles.active}>
            Active {chips.equipped.length}/{chips.sockets}
          </Text>

          {w > 0 && (
            <View style={styles.loadoutRow}>
              {Array.from({ length: CHIP_MAX_SOCKETS }, (_, slot) => {
                // Unlocked sockets first, then (at most) the one buyable
                // socket card from the design; anything past that is nothing.
                if (slot < chips.sockets) {
                  const id = chips.equipped[slot];
                  const chip = id ? CHIP_BY_ID[id] : undefined;
                  return (
                    <Pressable
                      key={slot}
                      style={({ pressed }) => [
                        { width: loadoutW, height: loadoutH },
                        pressed && chip != null && styles.cardPressed,
                      ]}
                      disabled={chip == null}
                      onPress={() => id && unequipChip(id)}>
                      <Image source={CARD_FRAME} style={styles.fill} contentFit="fill" />
                      <View style={[styles.fill, styles.centerBody]}>
                        {chip ? (
                          <>
                            <Image
                              source={CHIP_ICONS[chip.id]}
                              style={{ width: loadoutH * 0.36, height: loadoutH * 0.36 }}
                              contentFit="contain"
                            />
                            <Text style={styles.slotName} numberOfLines={1}>
                              {chip.name}
                            </Text>
                            <Text style={styles.slotLevel}>Lvl {chips.levels[chip.id] ?? 1}</Text>
                          </>
                        ) : (
                          <Text style={styles.slotEmpty}>Empty</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                }
                if (slot > chips.sockets || socketCost == null) return null;
                const affordable = gems >= socketCost;
                return (
                  <Pressable
                    key={slot}
                    style={({ pressed }) => [
                      { width: loadoutW, height: loadoutH },
                      !affordable && styles.dim,
                      pressed && affordable && styles.cardPressed,
                    ]}
                    disabled={!affordable}
                    onPress={() => unlockChipSocket()}>
                    <Image source={CARD_FRAME} style={styles.fill} contentFit="fill" />
                    <View style={[styles.fill, styles.centerBody]}>
                      <Text style={styles.slotText}>Unlock</Text>
                      <Text style={styles.slotText}>New socket</Text>
                      <GemAmount amount={socketCost} size={13} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={styles.inventory}>Inventory (by rarity)</Text>
        </View>

        {w > 0 && (
          <>
            <RaritySection
              title="Common"
              chips={COMMON_CHIPS}
              levels={chips.levels}
              equipped={chips.equipped}
              flashId={flashId}
              cardW={cardW}
              cardH={cardH}
              onSelect={setSelectedId}
            />
            <RaritySection
              title="Rare"
              chips={RARE_CHIPS}
              levels={chips.levels}
              equipped={chips.equipped}
              flashId={flashId}
              cardW={cardW}
              cardH={cardH}
              onSelect={setSelectedId}
            />

            <View style={styles.buyRow}>
              <Pressable
                ref={buyRef}
                style={({ pressed }) => [
                  { width: buyW, height: buyH },
                  pressed && canPull && styles.cardPressed,
                ]}
                disabled={!canPull}
                onPress={handlePull}>
                <Image source={BUY_BUTTON} style={styles.fill} contentFit="fill" />
                <View style={[styles.fill, styles.buyBody]}>
                  <Text style={[styles.buyLabel, !canPull && styles.dim]}>Buy x1</Text>
                  <GemAmount amount={CHIP_PULL_COST} size={11} dim={!canPull} />
                </View>
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {selectedId && <ChipDetail chipId={selectedId} onClose={() => setSelectedId(null)} />}
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
  slotName: {
    maxWidth: '90%',
    fontFamily: Fonts.grenzeMedium,
    fontSize: 13,
    color: MenuColors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  slotLevel: {
    fontFamily: Fonts.grenzeRegular,
    fontSize: 11,
    color: MenuColors.text,
    textTransform: 'uppercase',
    opacity: 0.85,
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
  /** Equipped marker — a thin accent outline, no new art needed. */
  cardEquipped: {
    borderWidth: 1,
    borderColor: MenuColors.accent,
  },
  /** Just pulled / just levelled: a short accent wash over the card. */
  cardFlash: {
    backgroundColor: 'rgba(0,187,255,0.28)',
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
    justifyContent: 'center',
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
