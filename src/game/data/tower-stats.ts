import type { UpgradeId } from '../core/types';

export type UpgradeMode = 'multiplicative' | 'additive';
export type UpgradeIconKey = 'damage' | 'speed' | 'health' | 'regen' | 'shield' | 'scrap';

export interface UpgradeDef {
  id: UpgradeId;
  label: string;
  icon: UpgradeIconKey;
  mode: UpgradeMode;
  /** Value at level 0. */
  base: number;
  /** Growth factor per level (multiplicative) or flat increment (additive). */
  step: number;
  /** Charge cost to go from level 0 to level 1. */
  baseCost: number;
  costGrowth: number;
  /** Hard cap — the "главная жалоба на оригинал" was uncapped upgrades. */
  maxLevel: number;
  unit: '' | '/s' | '%';
}

/**
 * Starting values and cost curve are anchored to the original's confirmed
 * Coilworks numbers (see voltspire-original-teardown memory) — these are
 * in-run Charge upgrades, not permanent ones, so growth is looser and caps
 * exist purely to keep a single run finite.
 */
export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  damage: {
    id: 'damage',
    label: 'Damage',
    icon: 'damage',
    mode: 'multiplicative',
    base: 14,
    step: 1.15,
    baseCost: 5,
    costGrowth: 1.07,
    maxLevel: 60,
    unit: '',
  },
  attackSpeed: {
    id: 'attackSpeed',
    label: 'Attack speed',
    icon: 'speed',
    mode: 'multiplicative',
    base: 1.0,
    step: 1.04,
    baseCost: 7.5,
    costGrowth: 1.08,
    maxLevel: 40,
    unit: '/s',
  },
  health: {
    id: 'health',
    label: 'Health',
    icon: 'health',
    mode: 'multiplicative',
    base: 6,
    step: 1.15,
    baseCost: 5,
    costGrowth: 1.07,
    maxLevel: 60,
    unit: '',
  },
  regen: {
    id: 'regen',
    label: 'Health regen',
    icon: 'regen',
    mode: 'multiplicative',
    base: 0.2,
    step: 1.15,
    baseCost: 15,
    costGrowth: 1.09,
    maxLevel: 40,
    unit: '/s',
  },
  deflection: {
    id: 'deflection',
    label: 'Deflection',
    icon: 'shield',
    mode: 'additive',
    base: 0,
    step: 0.5,
    baseCost: 10,
    costGrowth: 1.1,
    maxLevel: 100, // 100 * 0.5% = 50% cap
    unit: '%',
  },
  scrapBonus: {
    id: 'scrapBonus',
    label: 'Scrap bonus',
    icon: 'scrap',
    mode: 'additive',
    base: 0,
    step: 5,
    baseCost: 20,
    costGrowth: 1.12,
    maxLevel: 40, // 40 * 5% = 200% cap
    unit: '%',
  },
};

export const UPGRADE_ORDER: UpgradeId[] = ['damage', 'attackSpeed', 'health', 'regen', 'deflection', 'scrapBonus'];

export function upgradeValue(def: UpgradeDef, level: number): number {
  return def.mode === 'multiplicative' ? def.base * Math.pow(def.step, level) : def.base + def.step * level;
}

/** Charge cost of the *next* purchase, going from `level` to `level + 1`. */
export function upgradeCost(def: UpgradeDef, level: number): number {
  return def.baseCost * Math.pow(def.costGrowth, level);
}

export function isUpgradeMaxed(def: UpgradeDef, level: number): boolean {
  return level >= def.maxLevel;
}

export function createInitialUpgradeLevels(): Record<UpgradeId, number> {
  return { damage: 0, attackSpeed: 0, health: 0, regen: 0, deflection: 0, scrapBonus: 0 };
}

// --- Derived live tower stats, always computed from levels (never cached) ---

export function getTowerDamage(levels: Record<UpgradeId, number>): number {
  return upgradeValue(UPGRADE_DEFS.damage, levels.damage);
}

export function getTowerAttackSpeed(levels: Record<UpgradeId, number>): number {
  return upgradeValue(UPGRADE_DEFS.attackSpeed, levels.attackSpeed);
}

export function getTowerMaxHealth(levels: Record<UpgradeId, number>): number {
  return upgradeValue(UPGRADE_DEFS.health, levels.health);
}

export function getTowerRegen(levels: Record<UpgradeId, number>): number {
  return upgradeValue(UPGRADE_DEFS.regen, levels.regen);
}

/** Fraction 0..0.5 — multiply incoming contact damage by (1 - this). */
export function getTowerDeflection(levels: Record<UpgradeId, number>): number {
  return upgradeValue(UPGRADE_DEFS.deflection, levels.deflection) / 100;
}

/** Multiplier ≥1 — scrap reward per wave is multiplied by this. */
export function getTowerScrapBonus(levels: Record<UpgradeId, number>): number {
  return 1 + upgradeValue(UPGRADE_DEFS.scrapBonus, levels.scrapBonus) / 100;
}
