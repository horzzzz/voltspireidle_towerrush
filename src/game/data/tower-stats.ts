import type { RunLoadout, UpgradeId } from '../core/types';

export type UpgradeMode = 'multiplicative' | 'additive';
export type UpgradeIconKey = 'damage' | 'speed' | 'health' | 'regen' | 'shield' | 'scrap' | 'crit' | 'armor';

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
  critChance: {
    id: 'critChance',
    label: 'Critical chance',
    icon: 'crit',
    mode: 'additive',
    base: 0,
    step: 1,
    baseCost: 15,
    costGrowth: 1.09,
    maxLevel: 20, // +20% crit chance for the run, on top of Coilworks' own
    unit: '%',
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
  armor: {
    id: 'armor',
    label: 'Armor',
    icon: 'armor',
    mode: 'additive',
    base: 0,
    step: 0.5,
    baseCost: 15,
    costGrowth: 1.09,
    maxLevel: 40, // +20 flat armor for the run, on top of Coilworks' own
    unit: '',
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

export const UPGRADE_ORDER: UpgradeId[] = [
  'damage',
  'attackSpeed',
  'critChance',
  'health',
  'regen',
  'deflection',
  'armor',
  'scrapBonus',
];

/**
 * `baseOverride` replaces `def.base` when given — this is how a run's
 * Coilworks-derived loadout (economy/loadout.ts) feeds in as the level-0
 * value for damage/attackSpeed/health/regen, while callers with no loadout
 * (the headless sim harness, upgrade-row previews before a run starts) fall
 * back to the def's own default.
 */
export function upgradeValue(def: UpgradeDef, level: number, baseOverride?: number): number {
  const base = baseOverride ?? def.base;
  return def.mode === 'multiplicative' ? base * Math.pow(def.step, level) : base + def.step * level;
}

/** Charge cost of the *next* purchase, going from `level` to `level + 1`. */
export function upgradeCost(def: UpgradeDef, level: number): number {
  return def.baseCost * Math.pow(def.costGrowth, level);
}

export function isUpgradeMaxed(def: UpgradeDef, level: number): boolean {
  return level >= def.maxLevel;
}

export function createInitialUpgradeLevels(): Record<UpgradeId, number> {
  return {
    damage: 0,
    attackSpeed: 0,
    critChance: 0,
    health: 0,
    regen: 0,
    deflection: 0,
    armor: 0,
    scrapBonus: 0,
  };
}

/**
 * The loadout field (if any) that overrides `def.base` for a given in-run
 * upgrade — only the four stats Coilworks also raises permanently
 * (damage/attackSpeed/health/regen) have one; deflection and scrapBonus
 * start fresh every run. Used by UpgradeRow (battle HUD) to preview the
 * real current→next values instead of the def's hardcoded defaults.
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
    default:
      return undefined;
  }
}

// --- Derived live tower stats, always computed from levels (never cached) ---
// `loadout` is optional so the headless sim (createWorld with no loadout arg)
// and any UI preview before a run starts can still call these with the def's
// own defaults — see `upgradeValue`'s `baseOverride`.

export function getTowerDamage(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return upgradeValue(UPGRADE_DEFS.damage, levels.damage, loadout?.damageBase);
}

export function getTowerAttackSpeed(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return upgradeValue(UPGRADE_DEFS.attackSpeed, levels.attackSpeed, loadout?.attackSpeedBase);
}

export function getTowerMaxHealth(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return upgradeValue(UPGRADE_DEFS.health, levels.health, loadout?.healthBase);
}

export function getTowerRegen(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  return upgradeValue(UPGRADE_DEFS.regen, levels.regen, loadout?.regenBase);
}

/** Fraction 0..0.75 (clamped) — multiply incoming contact damage by (1 - this). */
export function getTowerDeflection(levels: Record<UpgradeId, number>, loadout?: RunLoadout): number {
  const runFraction = upgradeValue(UPGRADE_DEFS.deflection, levels.deflection) / 100;
  const total = runFraction + (loadout?.deflectionBase ?? 0);
  return Math.min(0.75, total);
}

/** Multiplier ≥1 — scrap reward per wave is multiplied by this. */
export function getTowerScrapBonus(levels: Record<UpgradeId, number>): number {
  return 1 + upgradeValue(UPGRADE_DEFS.scrapBonus, levels.scrapBonus) / 100;
}

/** Fraction 0..1 (clamped) — chance each hit is a critical: Coilworks-permanent + in-run upgrade. */
export function getTowerCritChance(loadout?: RunLoadout, levels?: Record<UpgradeId, number>): number {
  const runFraction = levels ? upgradeValue(UPGRADE_DEFS.critChance, levels.critChance) / 100 : 0;
  return Math.min(1, runFraction + (loadout?.critChance ?? 0));
}

export const CRIT_MULTIPLIER = 2;

/** Flat damage subtracted from each contact hit, before Deflection: Coilworks-permanent + in-run upgrade. */
export function getTowerArmor(loadout?: RunLoadout, levels?: Record<UpgradeId, number>): number {
  const runFlat = levels ? upgradeValue(UPGRADE_DEFS.armor, levels.armor) : 0;
  return runFlat + (loadout?.armor ?? 0);
}

/** Fraction bonus applied to every Charge drop (Coilworks-only). */
export function getTowerChargeBonus(loadout?: RunLoadout): number {
  return loadout?.chargeBonus ?? 0;
}
