/**
 * Coilworks — permanent upgrades bought with Scrap (the meta currency), as
 * opposed to the in-run Charge upgrades in `tower-stats.ts`. Level 0 values
 * anchor to the original's confirmed starting Spire stats (see
 * voltspire-original-teardown memory): Damage 14, Attack speed 1.00/s,
 * Health 6, Health regen 0.2/s. These feed `buildRunLoadout` (economy/loadout.ts),
 * which is the only place a run reads them — the Figma screen just renders
 * this table plus store state.
 */
export type CoilworksCategory = 'attack' | 'defense' | 'utility';
export type CoilworksMode = 'multiplicative' | 'additive';

export type CoilworksUpgradeId =
  | 'damage'
  | 'attackSpeed'
  | 'critChance'
  | 'health'
  | 'regen'
  | 'deflection'
  | 'armor'
  | 'scrapPerWave'
  | 'chargeBonus';

export interface CoilworksDef {
  id: CoilworksUpgradeId;
  category: CoilworksCategory;
  label: string;
  mode: CoilworksMode;
  /** Value at level 0. */
  base: number;
  /** Growth factor per level (multiplicative) or flat increment (additive). */
  step: number;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  unit: '' | '/s' | '%';
  /**
   * One-time Scrap cost to reveal this branch. Undefined = unlocked from the
   * start. Branches that need it start hidden behind an UNLOCK panel.
   */
  unlockCost?: number;
}

export const COILWORKS_DEFS: Record<CoilworksUpgradeId, CoilworksDef> = {
  damage: {
    id: 'damage',
    category: 'attack',
    label: 'Damage',
    mode: 'multiplicative',
    base: 14,
    step: 1.047,
    baseCost: 25,
    costGrowth: 1.057,
    maxLevel: 200,
    unit: '',
  },
  attackSpeed: {
    id: 'attackSpeed',
    category: 'attack',
    label: 'Attack speed',
    mode: 'multiplicative',
    base: 1.0,
    step: 1.03,
    baseCost: 20,
    costGrowth: 1.04,
    maxLevel: 60,
    unit: '/s',
  },
  critChance: {
    id: 'critChance',
    category: 'attack',
    label: 'Critical chance',
    mode: 'additive',
    base: 0,
    step: 1,
    baseCost: 30,
    costGrowth: 1.06,
    maxLevel: 40, // 40 * 1% = 40% cap
    unit: '%',
    unlockCost: 30,
  },
  health: {
    id: 'health',
    category: 'defense',
    label: 'Health',
    mode: 'multiplicative',
    base: 6,
    step: 1.047,
    baseCost: 25,
    costGrowth: 1.057,
    maxLevel: 200,
    unit: '',
  },
  regen: {
    id: 'regen',
    category: 'defense',
    label: 'Health regen',
    mode: 'multiplicative',
    base: 0.2,
    step: 1.05,
    baseCost: 25,
    costGrowth: 1.057,
    maxLevel: 100,
    unit: '/s',
  },
  deflection: {
    id: 'deflection',
    category: 'defense',
    label: 'Deflection',
    mode: 'additive',
    base: 0,
    step: 0.5,
    baseCost: 60,
    costGrowth: 1.07,
    maxLevel: 60, // 60 * 0.5% = 30% cap
    unit: '%',
  },
  armor: {
    id: 'armor',
    category: 'defense',
    label: 'Armor',
    mode: 'additive',
    base: 0,
    step: 1,
    baseCost: 150,
    costGrowth: 1.08,
    maxLevel: 50,
    unit: '',
    unlockCost: 150,
  },
  scrapPerWave: {
    id: 'scrapPerWave',
    category: 'utility',
    label: 'Scrap/wave',
    mode: 'additive',
    base: 0,
    step: 1,
    baseCost: 100,
    costGrowth: 1.1,
    maxLevel: 25,
    unit: '',
  },
  chargeBonus: {
    id: 'chargeBonus',
    category: 'utility',
    label: 'Charge bonus',
    mode: 'additive',
    base: 0,
    step: 5,
    baseCost: 50,
    costGrowth: 1.09,
    maxLevel: 20, // 20 * 5% = 100% cap
    unit: '%',
    unlockCost: 50,
  },
};

export const COILWORKS_ORDER: CoilworksUpgradeId[] = [
  'damage',
  'attackSpeed',
  'critChance',
  'health',
  'regen',
  'deflection',
  'armor',
  'scrapPerWave',
  'chargeBonus',
];

export function coilworksValue(def: CoilworksDef, level: number): number {
  return def.mode === 'multiplicative' ? def.base * Math.pow(def.step, level) : def.base + def.step * level;
}

export function coilworksCost(def: CoilworksDef, level: number): number {
  return def.baseCost * Math.pow(def.costGrowth, level);
}

export function isCoilworksMaxed(def: CoilworksDef, level: number): boolean {
  return level >= def.maxLevel;
}

export function createInitialCoilworksLevels(): Record<CoilworksUpgradeId, number> {
  return {
    damage: 0,
    attackSpeed: 0,
    critChance: 0,
    health: 0,
    regen: 0,
    deflection: 0,
    armor: 0,
    scrapPerWave: 0,
    chargeBonus: 0,
  };
}

export function createInitialCoilworksUnlocked(): Record<CoilworksUpgradeId, boolean> {
  return {
    damage: true,
    attackSpeed: true,
    critChance: false,
    health: true,
    regen: true,
    deflection: true,
    armor: false,
    scrapPerWave: true,
    chargeBonus: false,
  };
}
