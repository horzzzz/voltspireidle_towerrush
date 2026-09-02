import { isUpgradeMaxed, UPGRADE_DEFS, upgradeCost, upgradeValue } from '../data/tower-stats';
import type { UpgradeId, WorldState } from './types';

export type BuyUpgradeResult = 'bought' | 'maxed' | 'too-expensive';

/**
 * Spends Charge to raise one upgrade a level. Buying Health also tops up
 * current HP by the max-HP delta, so it reads as "gained HP" rather than
 * quietly raising an invisible ceiling.
 */
export function buyUpgrade(world: WorldState, id: UpgradeId): BuyUpgradeResult {
  const def = UPGRADE_DEFS[id];
  const level = world.tower.levels[id];

  if (isUpgradeMaxed(def, level)) return 'maxed';

  const cost = upgradeCost(def, level);
  if (world.charge < cost) return 'too-expensive';

  world.charge -= cost;
  world.tower.levels[id] = level + 1;

  if (id === 'health') {
    const delta = upgradeValue(def, level + 1) - upgradeValue(def, level);
    world.tower.health += delta;
  }

  return 'bought';
}

export function getUpgradeCostOrNull(world: WorldState, id: UpgradeId): number | null {
  const def = UPGRADE_DEFS[id];
  const level = world.tower.levels[id];
  return isUpgradeMaxed(def, level) ? null : upgradeCost(def, level);
}
