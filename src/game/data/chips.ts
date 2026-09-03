/**
 * Chips — the gem-funded gacha loadout (Figma frame 106:1881, detail card
 * 106:2015; the original's `resources/chips/*`).
 *
 * How the system works, in one place:
 *  - A pull costs `CHIP_PULL_COST` gems and yields one chip. A first copy
 *    unlocks the chip at level 1; every later copy becomes a *duplicate*.
 *  - `CHIP_LEVEL_UP_GEMS` gems + one duplicate raise a chip a level, up to
 *    `CHIP_MAX_LEVEL`. The card's six stars are exactly those six levels.
 *  - Equipped chips sit in loadout sockets (one from the start, the second
 *    bought for `CHIP_SOCKET_COSTS[0]` gems) and only matter at run start:
 *    `economy/loadout.ts` folds them into the run's `RunLoadout.chips`.
 *
 * The per-level numbers come from the Figma detail card's own effect strings
 * (`1.150 - 1.625` and friends): level 1 on the left, `CHIP_MAX_LEVEL` on the
 * right, linear in between — the step `(valueMax - value1) / 5` is a round
 * number for all twelve, which is what pinned the level count at six.
 *
 * Four chips (`pullable: false`) need simulation features this port doesn't
 * have yet — an extra orb per volley, a slow aura, a periodic overcharge
 * window, a faster early-wave clock. They stay in the grid as "?" and never
 * drop, so gems can't be sunk into an effect that does nothing.
 *
 * Pure data + pure functions: no store, no React, and no `require()`d art
 * (that lives in `data/chip-icons.ts`) — `economy/loadout.ts` imports this
 * module, and the headless harnesses run it in plain Node.
 * `buildChipModifiers` is what the run bridge and those harnesses both call.
 */

import type { ChipModifiers } from '../core/types';
import { neutralChipModifiers } from '../core/types';
import type { Rng } from '../core/rng';

export type ChipRarity = 'common' | 'rare';

/** Which `ChipModifiers` field a chip's value feeds. */
export type ChipEffectId =
  | 'attackSpeedMult'
  | 'toughHpMult'
  | 'maxHealthMult'
  | 'scrapMult'
  | 'critChanceMult'
  | 'upgradeCostDiv'
  | 'chargeMult'
  | 'critScrapMult'
  | 'unimplemented';

export interface ChipDef {
  id: string;
  name: string;
  rarity: ChipRarity;
  /** Sentence shown in the detail card. */
  description: string;
  effect: ChipEffectId;
  /** Value at level 1. */
  value1: number;
  /** Value at CHIP_MAX_LEVEL. */
  valueMax: number;
  /** False for the four chips whose mechanic isn't implemented — they never drop. */
  pullable: boolean;
}

export const CHIP_MAX_LEVEL = 6;
export const CHIP_PULL_COST = 20;
export const CHIP_LEVEL_UP_GEMS = 20;
/** Gem price of each socket past the first — index 0 buys the second socket. */
export const CHIP_SOCKET_COSTS = [65];
export const CHIP_MAX_SOCKETS = CHIP_SOCKET_COSTS.length + 1;
/** Chance a pull rolls the rare pool. */
export const CHIP_RARE_WEIGHT = 0.2;
/** Pulls without a rare after which the next one is guaranteed rare. */
export const CHIP_PITY_PULLS = 10;

export const CHIPS: ChipDef[] = [
  {
    id: 'attack-speed',
    name: 'Attack Speed',
    rarity: 'common',
    description: "Multiplies the spire's rate of fire.",
    effect: 'attackSpeedMult',
    value1: 1.15,
    valueMax: 1.625,
    pullable: true,
  },
  {
    id: 'enemy-balance',
    name: 'Enemy Balance',
    rarity: 'common',
    description: 'Softens the toughest bodies of every wave.',
    effect: 'toughHpMult',
    value1: 0.9,
    valueMax: 0.7,
    pullable: true,
  },
  {
    id: 'extra-defense',
    name: 'Extra Defense',
    // Figma calls this "flat armor", but Armor is a near-dead stat in this
    // port (base 1.0, 1.00272 per level), so a 1.55x on it would be +0.55
    // damage reduction and read as nothing. Max health is the defense stat
    // that actually moves.
    rarity: 'common',
    description: "Multiplies the spire's maximum health.",
    effect: 'maxHealthMult',
    value1: 1.1,
    valueMax: 1.55,
    pullable: true,
  },
  {
    id: 'scrap',
    name: 'Scrap',
    rarity: 'common',
    description: 'Boosts scrap earned from every kill.',
    effect: 'scrapMult',
    value1: 1.15,
    valueMax: 1.625,
    pullable: true,
  },
  {
    id: 'slow-aura',
    name: 'Slow Aura',
    rarity: 'common',
    description: "Slows enemies inside the spire's range.",
    effect: 'unimplemented',
    value1: 0.95,
    valueMax: 0.75,
    pullable: false,
  },
  {
    id: 'critical-chance',
    name: 'Critical Chance',
    rarity: 'common',
    description: 'Chance for the spire to land a critical hit.',
    effect: 'critChanceMult',
    value1: 1.05,
    valueMax: 1.4,
    pullable: true,
  },
  {
    id: 'free-upgrades',
    name: 'Free Upgrades',
    // Figma's own wording is "starts each run with bonus upgrade levels", but
    // the number is a multiplier — as a divisor on Charge prices it lands in
    // the same place (level 6 is ~4 free Damage levels at 1.17/level) and
    // needs no new run state.
    rarity: 'rare',
    description: 'Battle upgrades cost less charge.',
    effect: 'upgradeCostDiv',
    value1: 1.2,
    valueMax: 1.9,
    pullable: true,
  },
  {
    id: 'extra-orb',
    name: 'Extra Orb',
    rarity: 'rare',
    description: 'Fires an additional orb per volley.',
    effect: 'unimplemented',
    value1: 1.25,
    valueMax: 2.0,
    pullable: false,
  },
  {
    id: 'charge',
    name: 'Charge',
    rarity: 'rare',
    description: 'Builds charge faster during a run.',
    effect: 'chargeMult',
    value1: 1.2,
    valueMax: 1.85,
    pullable: true,
  },
  {
    id: 'critical-scrap',
    name: 'Critical Scrap',
    rarity: 'rare',
    description: 'Critical kills also multiply scrap dropped.',
    effect: 'critScrapMult',
    value1: 1.3,
    valueMax: 2.1,
    pullable: true,
  },
  {
    id: 'intro-sprint',
    name: 'Intro Sprint',
    rarity: 'rare',
    description: 'Early waves arrive and clear faster.',
    effect: 'unimplemented',
    value1: 1.2,
    valueMax: 1.8,
    pullable: false,
  },
  {
    id: 'overcharge-core',
    name: 'Overcharge Core',
    rarity: 'rare',
    description: 'Periodically overcharges the spire for burst damage.',
    effect: 'unimplemented',
    value1: 1.35,
    valueMax: 2.25,
    pullable: false,
  },
];

export const CHIP_BY_ID: Record<string, ChipDef> = Object.fromEntries(CHIPS.map((c) => [c.id, c]));

export const COMMON_CHIPS = CHIPS.filter((c) => c.rarity === 'common');
export const RARE_CHIPS = CHIPS.filter((c) => c.rarity === 'rare');

/** Level pips in the detail card — one per chip level. */
export const MAX_STARS = CHIP_MAX_LEVEL;

/** Effect value at `level` (1..CHIP_MAX_LEVEL), linear between the two anchors. */
export function chipValue(def: ChipDef, level: number): number {
  const clamped = Math.min(CHIP_MAX_LEVEL, Math.max(1, level));
  const step = (def.valueMax - def.value1) / (CHIP_MAX_LEVEL - 1);
  return def.value1 + step * (clamped - 1);
}

/** How the detail card writes a chip value — three decimals, as in the design. */
export function formatChipValue(value: number): string {
  return value.toFixed(3);
}

/** `1.150` at max level, `1.150 → 1.245` below it. */
export function formatChipEffect(def: ChipDef, level: number): string {
  const current = formatChipValue(chipValue(def, level));
  if (level >= CHIP_MAX_LEVEL) return current;
  return `${current} → ${formatChipValue(chipValue(def, level + 1))}`;
}

export function chipLevelUpCost(): number {
  return CHIP_LEVEL_UP_GEMS;
}

/** Gem price of the next socket, or null when every socket is unlocked. */
export function nextSocketCost(sockets: number): number | null {
  return CHIP_SOCKET_COSTS[sockets - 1] ?? null;
}

const PULLABLE_BY_RARITY: Record<ChipRarity, ChipDef[]> = {
  common: COMMON_CHIPS.filter((c) => c.pullable),
  rare: RARE_CHIPS.filter((c) => c.pullable),
};

/**
 * One gacha roll: rarity by weight (or forced rare once the pity counter is
 * full), then uniform inside that rarity's pullable pool.
 *
 * Duplicates are deliberate, not a leak: a repeat of an owned chip is what a
 * level-up spends (`CHIP_LEVEL_UP_GEMS` gems + one duplicate), so the roll
 * does not steer away from chips the player already has.
 */
export function rollChipId(rng: Rng, pityCounter: number): string {
  const forceRare = pityCounter >= CHIP_PITY_PULLS;
  const wantRare = forceRare || rng.next() < CHIP_RARE_WEIGHT;
  const pool = PULLABLE_BY_RARITY[wantRare ? 'rare' : 'common'];
  // Pools are non-empty today; falling back to the other rarity keeps a
  // future `pullable: false` edit from being able to crash a pull.
  const safePool = pool.length > 0 ? pool : PULLABLE_BY_RARITY[wantRare ? 'common' : 'rare'];
  return rng.pick(safePool).id;
}

/**
 * The one place chip levels turn into run multipliers. Unknown ids and
 * `unimplemented` effects are skipped, so an equipped chip whose mechanic
 * isn't wired up (or a stale save entry) can never change the sim.
 */
export function buildChipModifiers(
  equipped: readonly string[],
  levels: Readonly<Record<string, number>>,
): ChipModifiers {
  const mods = neutralChipModifiers();

  for (const id of equipped) {
    const def = CHIP_BY_ID[id];
    if (!def) continue;
    const value = chipValue(def, levels[id] ?? 1);

    switch (def.effect) {
      case 'attackSpeedMult':
        mods.attackSpeedMult *= value;
        break;
      case 'maxHealthMult':
        mods.maxHealthMult *= value;
        break;
      case 'critChanceMult':
        mods.critChanceMult *= value;
        break;
      case 'scrapMult':
        mods.scrapMult *= value;
        break;
      case 'chargeMult':
        mods.chargeMult *= value;
        break;
      case 'critScrapMult':
        mods.critScrapMult *= value;
        break;
      case 'toughHpMult':
        mods.toughHpMult *= value;
        break;
      case 'upgradeCostDiv':
        mods.upgradeCostMult /= value;
        break;
      case 'unimplemented':
        break;
    }
  }
  return mods;
}
