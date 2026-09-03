/**
 * In-run upgrades bought with Charge, ported 1:1 from the original's
 * `resources/battle_upgrades/*.tres` (Voltspire 1.9.0). They burn with the
 * run; the permanent counterparts live in `data/coilworks.ts`.
 *
 * The original ships 49 of these `.tres` files but its `GameState` only
 * tracks 20 upgrade levels — the rest are forward-looking data for mechanics
 * that aren't wired up in 1.9.0 (orbs, mines, bounce, multishot, lifesteal,
 * interest, …). Of those 20, the ten below are the ones this port's engine
 * can express today; the others need a Barrier, Repair Cells, enemy armor,
 * super-crits or an upgradeable Range (this port's radius is fixed — see
 * `data/arena.ts`).
 *
 * Two things carry over from the source and matter a lot:
 *  - Prices grow much faster here than in Coilworks (Damage 1.17/level vs
 *    1.057). That gap is the brake that ends a run: damage rises 15% per
 *    purchase while its price rises 17%.
 *  - Attack Speed, Crit Chance, Crit Multiplier and Deflection are additive;
 *    only Damage/Health/Regen/Armor multiply.
 */

import {
  TOWER_BASE_ARMOR,
  TOWER_BASE_ATTACK_SPEED,
  TOWER_BASE_CRIT_CHANCE,
  TOWER_BASE_CRIT_MULTIPLIER,
  TOWER_BASE_DAMAGE,
  TOWER_BASE_DEFLECTION,
  TOWER_BASE_HP,
  REGEN_UPGRADE_BASE_VALUE,
} from './balance';
import { geometricCost } from '../core/formulas';
import type { CoilworksDisplay } from './coilworks';
import type { RunLoadout, UpgradeId } from '../core/types';

export type UpgradeMode = 'multiplicative' | 'additive';
export type UpgradeCategory = 'attack' | 'defense' | 'utility';
export type UpgradeIconKey =
  | 'damage'
  | 'speed'
  | 'health'
  | 'regen'
  | 'shield'
  | 'scrap'
  | 'crit'
  | 'armor'
  | 'charge';

export interface UpgradeDef {
  id: UpgradeId;
  label: string;
  category: UpgradeCategory;
  icon: UpgradeIconKey;
  mode: UpgradeMode;
  /** Value at level 0, when no Coilworks loadout overrides it. */
  base: number;
  /** `effect_per_level`: a factor when multiplicative, an increment when additive. */
  step: number;
  baseCost: number;
  /** `growth` — Charge price multiplier per level. */
  costGrowth: number;
  /** Only Attack Speed has one in the original. */
  maxLevel?: number;
  display: CoilworksDisplay;
}

export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  damage: {
    id: 'damage',
    label: 'Damage',
    category: 'attack',
    icon: 'damage',
    mode: 'multiplicative',
    base: TOWER_BASE_DAMAGE,
    step: 1.15,
    baseCost: 5,
    costGrowth: 1.17,
    display: 'number',
  },
  attackSpeed: {
    id: 'attackSpeed',
    label: 'Attack speed',
    category: 'attack',
    icon: 'speed',
    mode: 'additive',
    base: TOWER_BASE_ATTACK_SPEED,
    step: 0.04,
    baseCost: 7.5,
    costGrowth: 1.12,
    maxLevel: 99,
    display: 'rate',
  },
  critChance: {
    id: 'critChance',
    label: 'Critical chance',
    category: 'attack',
    icon: 'crit',
    mode: 'additive',
    base: TOWER_BASE_CRIT_CHANCE,
    step: 0.05,
    baseCost: 40,
    costGrowth: 1.2,
    display: 'percent',
  },
  critMultiplier: {
    id: 'critMultiplier',
    label: 'Crit multiplier',
    category: 'attack',
    icon: 'crit',
    mode: 'additive',
    base: TOWER_BASE_CRIT_MULTIPLIER,
    step: 0.01,
    baseCost: 60,
    costGrowth: 1.12,
    display: 'multiplier',
  },
  health: {
    id: 'health',
    label: 'Health',
    category: 'defense',
    icon: 'health',
    mode: 'multiplicative',
    base: TOWER_BASE_HP,
    step: 1.15,
    baseCost: 5,
    costGrowth: 1.17,
    display: 'number',
  },
  regen: {
    id: 'regen',
    label: 'Health regen',
    category: 'defense',
    icon: 'regen',
    mode: 'multiplicative',
    base: REGEN_UPGRADE_BASE_VALUE,
    step: 1.15,
    baseCost: 15,
    costGrowth: 1.09,
    display: 'rate',
  },
  armor: {
    id: 'armor',
    label: 'Armor',
    category: 'defense',
    icon: 'armor',
    mode: 'multiplicative',
    base: TOWER_BASE_ARMOR,
    step: 1.00272,
    baseCost: 30,
    costGrowth: 1.08,
    display: 'number',
  },
  deflection: {
    id: 'deflection',
    label: 'Deflection',
    category: 'defense',
    icon: 'shield',
    mode: 'additive',
    base: TOWER_BASE_DEFLECTION,
    step: 0.005,
    baseCost: 100,
    costGrowth: 1.14,
    display: 'fractionPercent',
  },
  chargePerWave: {
    id: 'chargePerWave',
    label: 'Charge/wave',
    category: 'utility',
    icon: 'charge',
    mode: 'additive',
    base: 0,
    step: 4,
    baseCost: 100,
    costGrowth: 1.12,
    display: 'number',
  },
  scrapPerWave: {
    id: 'scrapPerWave',
    label: 'Scrap/wave',
    category: 'utility',
    icon: 'scrap',
    mode: 'additive',
    base: 0,
    step: 1,
    baseCost: 100,
    costGrowth: 1.12,
    display: 'number',
  },
};

export const UPGRADE_ORDER: UpgradeId[] = [
  'damage',
  'attackSpeed',
  'critChance',
  'critMultiplier',
  'health',
  'regen',
  'armor',
  'deflection',
  'chargePerWave',
  'scrapPerWave',
];

/**
 * `baseOverride` replaces `def.base` when given — this is how a run's
 * Coilworks-derived loadout (economy/loadout.ts) feeds in as the level-0
 * value, while callers with no loadout (the headless sim harness, upgrade-row
 * previews before a run starts) fall back to the def's own default.
 */
export function upgradeValue(def: UpgradeDef, level: number, baseOverride?: number): number {
  const base = baseOverride ?? def.base;
  return def.mode === 'multiplicative' ? base * Math.pow(def.step, level) : base + def.step * level;
}

/** Charge cost of the *next* purchase, going from `level` to `level + 1`. */
export function upgradeCost(def: UpgradeDef, level: number): number {
  return geometricCost(def.baseCost, def.costGrowth, level);
}

/**
 * The price the player actually pays, once the run's Chips are taken into
 * account (Free Upgrades divides it). Everything that shows or charges a
 * Charge price goes through here — `buyUpgrade` and the UpgradeBar both — so
 * the number on the row is always the number that gets deducted.
 */
export function upgradeCostFor(def: UpgradeDef, level: number, loadout?: RunLoadout): number {
  return upgradeCost(def, level) * (loadout?.chips.upgradeCostMult ?? 1);
}

export function isUpgradeMaxed(def: UpgradeDef, level: number): boolean {
  return def.maxLevel != null && level >= def.maxLevel;
}

export function createInitialUpgradeLevels(): Record<UpgradeId, number> {
  return {
    damage: 0,
    attackSpeed: 0,
    critChance: 0,
    critMultiplier: 0,
    health: 0,
    regen: 0,
    armor: 0,
    deflection: 0,
    chargePerWave: 0,
    scrapPerWave: 0,
  };
}

/**
 * The loadout field (if any) that overrides `def.base` for a given in-run
 * upgrade. Every stat the Spire actually carries has a Coilworks counterpart,
 * so the in-run branch stacks on top of the permanent one; the two flat
 * income branches (charge/scrap per wave) start from 0 each run because their
 * Coilworks halves are paid separately at the end of each wave.
 */
export function loadoutBaseFor(id: UpgradeId, loadout?: RunLoadout): number | undefined {
  if (!loadout) return undefined;
  switch (id) {
    case 'damage':
      return loadout.damageBase;
    case 'attackSpeed':
      return loadout.attackSpeedBase;
    case 'health':
      return loadout.healthBase;
    case 'regen':
      return loadout.regenBase;
    case 'armor':
      return loadout.armorBase;
    case 'deflection':
      return loadout.deflectionBase;
    case 'critChance':
      return loadout.critChanceBase;
    case 'critMultiplier':
      return loadout.critMultiplierBase;
    default:
      return undefined;
  }
}

/**
 * The Chip multiplier that applies to one stat, 1 for the stats no chip
 * touches — see `data/chips.ts`. Multiplicative and applied *after* the level
 * curve, so an additive branch (Attack Speed) still gets its flat per-level
 * steps first and the chip scales the total.
 */
export function chipStatMultiplier(id: UpgradeId, loadout?: RunLoadout): number {
  if (!loadout) return 1;
  switch (id) {
    case 'attackSpeed':
      return loadout.chips.attackSpeedMult;
    case 'health':
      return loadout.chips.maxHealthMult;
    case 'critChance':
      return loadout.chips.critChanceMult;
    default:
      return 1;
  }
}

/**
 * One stat at one level: the def's curve, the Coilworks base from the
 * loadout, then the Chip multiplier. The UpgradeRow's "current → next"
 * preview uses this too, so what the row promises is what the sim computes.
 */
export function chipAwareStatValue(id: UpgradeId, level: number, loadout?: RunLoadout): number {
  return upgradeValue(UPGRADE_DEFS[id], level, loadoutBaseFor(id, loadout)) * chipStatMultiplier(id, loadout);
}

// --- Derived live tower stats, always computed from levels (never cached) ---
// `loadout` is optional so the headless sim (createWorld with no loadout arg)
// and any UI preview before a run starts can still call these with the def's
// own defaults — see `upgradeValue`'s `baseOverride`.

function statValue(id: UpgradeId, levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return chipAwareStatValue(id, levels[id], loadout);
}

export function getTowerDamage(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return statValue('damage', levels, loadout);
}

export function getTowerAttackSpeed(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return statValue('attackSpeed', levels, loadout);
}

export function getTowerMaxHealth(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return statValue('health', levels, loadout);
}

export function getTowerRegen(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return statValue('regen', levels, loadout);
}

/** Flat damage subtracted from each contact hit, before Deflection. */
export function getTowerArmor(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return statValue('armor', levels, loadout);
}

/** Fraction 0..1 — never clamped; the 5% floor in `towerIncomingDamage` is the real cap. */
export function getTowerDeflection(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return statValue('deflection', levels, loadout);
}

/** Fraction 0..1 chance for a hit to crit — stored as a percentage, like the original. */
export function getTowerCritChance(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return Math.min(1, statValue('critChance', levels, loadout) / 100);
}

/** Damage multiplier applied to a critical hit (base 1.2). */
export function getTowerCritMultiplier(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return statValue('critMultiplier', levels, loadout);
}

/** Flat Charge paid at the end of every wave: in-run branch plus the Coilworks one. */
export function getChargePerWave(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return statValue('chargePerWave', levels) + (loadout?.chargePerWave ?? 0);
}

/** Flat Scrap paid at the end of every wave: in-run branch plus the Coilworks one. */
export function getScrapPerWave(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return statValue('scrapPerWave', levels) + (loadout?.scrapPerWave ?? 0);
}

/** Fraction bonus applied to every Charge drop (Coilworks-only). */
export function getTowerChargeBonus(loadout?: RunLoadout): number {
  return loadout?.chargeBonus ?? 0;
}

/** Fraction bonus applied to every Scrap drop (Coilworks-only). */
export function getTowerScrapBonus(loadout?: RunLoadout): number {
  return loadout?.scrapPerKillBonus ?? 0;
}
