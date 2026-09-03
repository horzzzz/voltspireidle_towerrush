/**
 * Chip artwork, keyed by chip id.
 *
 * Deliberately separate from `data/chips.ts`: `require()`-ing a PNG only works
 * under Metro, and `data/chips.ts` is imported by `economy/loadout.ts`, which
 * the headless harnesses (`scripts/battle-sim.ts`, `scripts/balance-check.ts`)
 * run in plain Node. Balance data stays runnable there; art lives here and is
 * imported only by the screen.
 */
export const CHIP_ICONS: Record<string, number> = {
  'attack-speed': require('@/assets/images/chips/icon-attack-speed.png'),
  'enemy-balance': require('@/assets/images/chips/icon-enemy-balance.png'),
  'extra-defense': require('@/assets/images/chips/icon-extra-defense.png'),
  scrap: require('@/assets/images/chips/icon-scrap.png'),
  'slow-aura': require('@/assets/images/chips/icon-slow-aura.png'),
  'critical-chance': require('@/assets/images/chips/icon-critical-chance.png'),
  'free-upgrades': require('@/assets/images/chips/icon-free-upgrades.png'),
  'extra-orb': require('@/assets/images/chips/icon-extra-orb.png'),
  charge: require('@/assets/images/chips/icon-charge.png'),
  'critical-scrap': require('@/assets/images/chips/icon-critical-scrap.png'),
  'intro-sprint': require('@/assets/images/chips/icon-intro-sprint.png'),
  'overcharge-core': require('@/assets/images/chips/icon-overcharge-core.png'),
};
