/**
 * Coilworks — the permanent, Scrap-funded upgrade tree, ported 1:1 from the
 * original's `resources/coilworks/*.tres` (Voltspire 1.9.0). Every number
 * below is the shipped value; the curves themselves live in
 * `core/formulas.ts` and the base stats in `data/balance.ts`.
 *
 * Two cost/value models, exactly as in the source:
 *  - `anchors` (Damage, Health, Health Regen, Armor) — the stat is the base
 *    times a multiplier interpolated through `value_anchors`, and the price
 *    is that same multiplier raised to `costPowerExponent`. The curve slows
 *    itself down: ~4.71%/level up to level 100, ~0.51%/level after it.
 *  - `linear` — price is `baseCost * growth ^ level`, value is
 *    `base + level * effectPerLevel`.
 *
 * `maxLevel` is absent on purpose: the original caps only Attack Speed (99).
 * The anchor curve flattens on its own, so uncapped branches don't run away
 * the way an unbounded geometric series would.
 *
 * Branches deliberately not ported: `range` (this port's attack radius is
 * fixed — see `data/arena.ts`), `barrier_integrity` / `barrier_reform` (need
 * a Barrier mechanic and cost 5e8 anyway) and `repair_chance` (Repair Cells).
 */

import {
  REGEN_UPGRADE_BASE_VALUE,
  TOWER_BASE_ARMOR,
  TOWER_BASE_ATTACK_SPEED,
  TOWER_BASE_CRIT_CHANCE,
  TOWER_BASE_CRIT_MULTIPLIER,
  TOWER_BASE_DAMAGE,
  TOWER_BASE_DEFLECTION,
  TOWER_BASE_HP,
} from './balance';
import { anchorUpgradeCost, anchorValueMultiplier, geometricCost, type ValueAnchor } from '../core/formulas';
import type { StatDisplay } from '../core/numbers';

export type CoilworksCategory = 'attack' | 'defense' | 'utility';
export type CoilworksModel = 'anchors' | 'linear';

/**
 * How a raw value is written for the player — `numbers.formatStatValue` does
 * the writing. Two of these exist only because the source is inconsistent:
 * `percent` is already a percentage (Crit Chance is stored as 1.0 meaning
 * 1%), while `fractionPercent` is a 0..1 fraction shown as a percentage
 * (Deflection's 0.005 per level reads as +0.5%).
 */
export type CoilworksDisplay = StatDisplay;

export type CoilworksUpgradeId =
  | 'damage'
  | 'attackSpeed'
  | 'critChance'
  | 'critMultiplier'
  | 'health'
  | 'regen'
  | 'deflection'
  | 'armor'
  | 'chargeBonus'
  | 'chargePerWave'
  | 'scrapPerWave'
  | 'scrapPerKillBonus';

/**
 * One-time purchases that reveal a branch. Several branches can share one —
 * `defense` opens Health, Health Regen and Deflection together, which is why
 * a fresh save can only buy Damage and Attack Speed (mirrors the original's
 * `coilworks_unlocked_stats` dictionary and its Coilworks screen).
 */
export type CoilworksUnlockId =
  | 'defense'
  | 'critChance'
  | 'critMultiplier'
  | 'armor'
  | 'chargeBonus'
  | 'chargePerWave'
  | 'scrapPerWave'
  | 'scrapPerKillBonus';

export interface CoilworksUnlock {
  id: CoilworksUnlockId;
  cost: number;
  label: string;
}

export interface CoilworksDef {
  id: CoilworksUpgradeId;
  category: CoilworksCategory;
  label: string;
  model: CoilworksModel;
  /** Value at level 0 — the Spire's base stat. */
  base: number;
  baseCost: number;
  display: CoilworksDisplay;
  /** `linear` only. */
  growth?: number;
  effectPerLevel?: number;
  /** `anchors` only. */
  anchors?: ValueAnchor[];
  costPowerExponent?: number;
  /** Only Attack Speed has one in the original. */
  maxLevel?: number;
  unlock?: CoilworksUnlock;
}

/** Shared by every anchor-curve branch in the original. */
const VALUE_ANCHORS: ValueAnchor[] = [
  [0, 1],
  [100, 100],
  [1000, 10000],
  [3000, 1e6],
  [6000, 1e7],
];
const COST_POWER_EXPONENT = 1.2;

const UNLOCK_DEFENSE: CoilworksUnlock = { id: 'defense', cost: 60, label: 'Unlock defense upgrades' };

export const COILWORKS_DEFS: Record<CoilworksUpgradeId, CoilworksDef> = {
  damage: {
    id: 'damage',
    category: 'attack',
    label: 'Damage',
    model: 'anchors',
    base: TOWER_BASE_DAMAGE,
    baseCost: 25,
    display: 'number',
    anchors: VALUE_ANCHORS,
    costPowerExponent: COST_POWER_EXPONENT,
  },
  attackSpeed: {
    id: 'attackSpeed',
    category: 'attack',
    label: 'Attack speed',
    model: 'linear',
    base: TOWER_BASE_ATTACK_SPEED,
    baseCost: 20,
    display: 'rate',
    growth: 1.04,
    effectPerLevel: 0.03,
    maxLevel: 99,
  },
  critChance: {
    id: 'critChance',
    category: 'attack',
    label: 'Critical chance',
    model: 'linear',
    base: TOWER_BASE_CRIT_CHANCE,
    baseCost: 30,
    display: 'percent',
    growth: 1.02,
    effectPerLevel: 1,
    unlock: { id: 'critChance', cost: 30, label: 'Unlock critical chance upgrades' },
  },
  critMultiplier: {
    id: 'critMultiplier',
    category: 'attack',
    label: 'Crit multiplier',
    model: 'linear',
    base: TOWER_BASE_CRIT_MULTIPLIER,
    baseCost: 30,
    display: 'multiplier',
    growth: 1.02,
    effectPerLevel: 0.1,
    unlock: { id: 'critMultiplier', cost: 40, label: 'Unlock crit multiplier upgrades' },
  },
  health: {
    id: 'health',
    category: 'defense',
    label: 'Health',
    model: 'anchors',
    base: TOWER_BASE_HP,
    baseCost: 25,
    display: 'number',
    anchors: VALUE_ANCHORS,
    costPowerExponent: COST_POWER_EXPONENT,
    unlock: UNLOCK_DEFENSE,
  },
  regen: {
    id: 'regen',
    category: 'defense',
    label: 'Health regen',
    model: 'anchors',
    base: REGEN_UPGRADE_BASE_VALUE,
    baseCost: 25,
    display: 'rate',
    anchors: VALUE_ANCHORS,
    costPowerExponent: COST_POWER_EXPONENT,
    unlock: UNLOCK_DEFENSE,
  },
  deflection: {
    id: 'deflection',
    category: 'defense',
    label: 'Deflection',
    model: 'linear',
    base: TOWER_BASE_DEFLECTION,
    baseCost: 60,
    display: 'fractionPercent',
    growth: 1.02,
    effectPerLevel: 0.005,
    unlock: UNLOCK_DEFENSE,
  },
  armor: {
    id: 'armor',
    category: 'defense',
    label: 'Armor',
    model: 'anchors',
    base: TOWER_BASE_ARMOR,
    baseCost: 25,
    display: 'number',
    anchors: VALUE_ANCHORS,
    costPowerExponent: COST_POWER_EXPONENT,
    unlock: { id: 'armor', cost: 150, label: 'Unlock armor upgrades' },
  },
  chargeBonus: {
    id: 'chargeBonus',
    category: 'utility',
    label: 'Charge bonus',
    model: 'linear',
    base: 0,
    baseCost: 40,
    display: 'fractionPercent',
    growth: 1.02,
    effectPerLevel: 0.01,
    unlock: { id: 'chargeBonus', cost: 40, label: 'Unlock charge bonuses' },
  },
  chargePerWave: {
    id: 'chargePerWave',
    category: 'utility',
    label: 'Charge/wave',
    model: 'linear',
    base: 0,
    baseCost: 40,
    display: 'number',
    // 0.113% per level — these flat-income branches are bought thousands of
    // levels deep, as a long Scrap sink rather than a choice.
    growth: 1.00113,
    effectPerLevel: 4,
    unlock: { id: 'chargePerWave', cost: 40, label: 'Unlock charge/wave' },
  },
  scrapPerWave: {
    id: 'scrapPerWave',
    category: 'utility',
    label: 'Scrap/wave',
    model: 'linear',
    // `coilworks_scrap_per_wave_base` pays 1 even at level 0, once unlocked.
    base: 1,
    baseCost: 100,
    display: 'number',
    growth: 1.00113,
    effectPerLevel: 1,
    unlock: { id: 'scrapPerWave', cost: 100, label: 'Unlock scrap/wave' },
  },
  scrapPerKillBonus: {
    id: 'scrapPerKillBonus',
    category: 'utility',
    label: 'Scrap/kill bonus',
    model: 'linear',
    base: 0,
    baseCost: 100,
    display: 'fractionPercent',
    growth: 1.02,
    effectPerLevel: 0.01,
    unlock: { id: 'scrapPerKillBonus', cost: 100, label: 'Unlock scrap/kill bonus upgrades' },
  },
};

export const COILWORKS_ORDER: CoilworksUpgradeId[] = [
  'damage',
  'attackSpeed',
  'critChance',
  'critMultiplier',
  'health',
  'regen',
  'deflection',
  'armor',
  'chargeBonus',
  'chargePerWave',
  'scrapPerWave',
  'scrapPerKillBonus',
];

export function coilworksValue(def: CoilworksDef, level: number): number {
  if (def.model === 'anchors') {
    return def.base * anchorValueMultiplier(level, def.anchors!);
  }
  return def.base + level * (def.effectPerLevel ?? 0);
}

export function coilworksCost(def: CoilworksDef, level: number): number {
  if (def.model === 'anchors') {
    return anchorUpgradeCost(def.baseCost, level, def.anchors!, def.costPowerExponent!);
  }
  return geometricCost(def.baseCost, def.growth ?? 1, level);
}

export function isCoilworksMaxed(def: CoilworksDef, level: number): boolean {
  return def.maxLevel != null && level >= def.maxLevel;
}

export function createInitialCoilworksLevels(): Record<CoilworksUpgradeId, number> {
  return {
    damage: 0,
    attackSpeed: 0,
    critChance: 0,
    critMultiplier: 0,
    health: 0,
    regen: 0,
    deflection: 0,
    armor: 0,
    chargeBonus: 0,
    chargePerWave: 0,
    scrapPerWave: 0,
    scrapPerKillBonus: 0,
  };
}

export function createInitialCoilworksUnlocked(): Record<CoilworksUnlockId, boolean> {
  return {
    defense: false,
    critChance: false,
    critMultiplier: false,
    armor: false,
    chargeBonus: false,
    chargePerWave: false,
    scrapPerWave: false,
    scrapPerKillBonus: false,
  };
}

/** Every distinct unlock, keyed by id — the meta store buys them by id. */
export const COILWORKS_UNLOCKS: Record<CoilworksUnlockId, CoilworksUnlock> = COILWORKS_ORDER.reduce(
  (acc, id) => {
    const unlock = COILWORKS_DEFS[id].unlock;
    if (unlock) acc[unlock.id] = unlock;
    return acc;
  },
  {} as Record<CoilworksUnlockId, CoilworksUnlock>,
);

/** A branch with no `unlock` is always available (Damage, Attack Speed). */
export function isCoilworksAvailable(
  def: CoilworksDef,
  unlocked: Record<CoilworksUnlockId, boolean>,
): boolean {
  return def.unlock == null || unlocked[def.unlock.id];
}

/** Every distinct unlock, in the order its branches appear — for the screen's UNLOCK panels. */
export function coilworksUnlocksInCategory(category: CoilworksCategory): CoilworksUnlock[] {
  const seen = new Set<CoilworksUnlockId>();
  const out: CoilworksUnlock[] = [];
  for (const id of COILWORKS_ORDER) {
    const def = COILWORKS_DEFS[id];
    if (def.category !== category || def.unlock == null || seen.has(def.unlock.id)) continue;
    seen.add(def.unlock.id);
    out.push(def.unlock);
  }
  return out;
}
