/**
 * Chip catalogue for the Chips screen (Figma node 106:1748 / detail card
 * 106:2015). Layout data only — no economy wiring yet. `owned` drives the
 * grid's locked ("?") vs unlocked (icon + level) card state; the rest feeds
 * the detail modal.
 */

export type ChipRarity = 'common' | 'rare';

export interface ChipDef {
  id: string;
  name: string;
  icon: number;
  rarity: ChipRarity;
  /** Sentence shown in the detail card. */
  description: string;
  /** Effect range string, mirrors the Figma detail card ("1.150 - 1.625"). */
  effect: string;
  /** Placeholder ownership until the economy is wired. */
  owned: boolean;
  level: number;
  duplicates: number;
}

export const CHIPS: ChipDef[] = [
  {
    id: 'attack-speed',
    name: 'Attack Speed',
    icon: require('@/assets/images/chips/icon-attack-speed.png'),
    rarity: 'common',
    description: "Multiplies the spire's rate of fire.",
    effect: '1.150 - 1.625',
    owned: true,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'enemy-balance',
    name: 'Enemy Balance',
    icon: require('@/assets/images/chips/icon-enemy-balance.png'),
    rarity: 'common',
    description: 'Softens the toughest enemy in every wave.',
    effect: '0.900 - 0.700',
    owned: true,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'extra-defense',
    name: 'Extra Defense',
    icon: require('@/assets/images/chips/icon-extra-defense.png'),
    rarity: 'common',
    description: 'Adds flat armor to the spire.',
    effect: '1.100 - 1.550',
    owned: true,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'scrap',
    name: 'Scrap',
    icon: require('@/assets/images/chips/icon-scrap.png'),
    rarity: 'common',
    description: 'Boosts scrap earned from every kill.',
    effect: '1.150 - 1.625',
    owned: true,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'slow-aura',
    name: 'Slow Aura',
    icon: require('@/assets/images/chips/icon-slow-aura.png'),
    rarity: 'common',
    description: "Slows enemies inside the spire's range.",
    effect: '0.950 - 0.750',
    owned: false,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'critical-chance',
    name: 'Critical Chance',
    icon: require('@/assets/images/chips/icon-critical-chance.png'),
    rarity: 'common',
    description: 'Chance for the spire to land a critical hit.',
    effect: '1.050 - 1.400',
    owned: false,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'free-upgrades',
    name: 'Free Upgrades',
    icon: require('@/assets/images/chips/icon-free-upgrades.png'),
    rarity: 'rare',
    description: 'Starts each run with bonus upgrade levels.',
    effect: '1.200 - 1.900',
    owned: true,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'extra-orb',
    name: 'Extra Orb',
    icon: require('@/assets/images/chips/icon-extra-orb.png'),
    rarity: 'rare',
    description: 'Fires an additional orb per volley.',
    effect: '1.250 - 2.000',
    owned: false,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'charge',
    name: 'Charge',
    icon: require('@/assets/images/chips/icon-charge.png'),
    rarity: 'rare',
    description: 'Builds charge faster during a run.',
    effect: '1.200 - 1.850',
    owned: false,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'critical-scrap',
    name: 'Critical Scrap',
    icon: require('@/assets/images/chips/icon-critical-scrap.png'),
    rarity: 'rare',
    description: 'Critical hits also multiply scrap dropped.',
    effect: '1.300 - 2.100',
    owned: false,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'intro-sprint',
    name: 'Intro Sprint',
    icon: require('@/assets/images/chips/icon-intro-sprint.png'),
    rarity: 'rare',
    description: 'Early waves arrive and clear faster.',
    effect: '1.200 - 1.800',
    owned: false,
    level: 1,
    duplicates: 0,
  },
  {
    id: 'overcharge-core',
    name: 'Overcharge Core',
    icon: require('@/assets/images/chips/icon-overcharge-core.png'),
    rarity: 'rare',
    description: 'Periodically overcharges the spire for burst damage.',
    effect: '1.350 - 2.250',
    owned: false,
    level: 1,
    duplicates: 0,
  },
];

export const COMMON_CHIPS = CHIPS.filter((c) => c.rarity === 'common');
export const RARE_CHIPS = CHIPS.filter((c) => c.rarity === 'rare');

/** Filled stars shown for a rarity in the detail card (out of MAX_STARS). */
export const MAX_STARS = 6;
export function starsForRarity(rarity: ChipRarity): number {
  return rarity === 'rare' ? 2 : 1;
}
