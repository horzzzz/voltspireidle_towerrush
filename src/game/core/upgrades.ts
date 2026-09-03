import { chipAwareStatValue, isUpgradeMaxed, UPGRADE_DEFS, upgradeCostFor } from '../data/tower-stats';
import { emitVfx } from './types';
import type { UpgradeId, WorldState } from './types';

export type BuyUpgradeResult = 'bought' | 'maxed' | 'too-expensive' | 'locked';

/**
 * Spends Charge to raise one upgrade a level. Buying Health also tops up
 * current HP by the max-HP delta, so it reads as "gained HP" rather than
 * quietly raising an invisible ceiling.
 *
 * Enforced here, not just hidden in the UI (UpgradeBar filters by the same
 * flag) — a stat gated behind an un-bought Coilworks unlock (Crit chance,
 * Armor) must not be purchasable in battle even if something calls this
 * directly, e.g. the headless sim harness's greedy buyer.
 */
export function buyUpgrade(world: WorldState, id: UpgradeId): BuyUpgradeResult {
  if (!world.loadout.runUpgradesUnlocked[id]) return 'locked';

  const def = UPGRADE_DEFS[id];
  const level = world.tower.levels[id];

  if (isUpgradeMaxed(def, level)) return 'maxed';

  const cost = upgradeCostFor(def, level, world.loadout);
  if (world.charge < cost) return 'too-expensive';

  world.charge -= cost;
  world.tower.levels[id] = level + 1;
  world.upgradesBought += 1;

  if (id === 'health') {
    // Chip-aware on both sides (Extra Defense multiplies max HP), or the
    // top-up would drift away from the max the HUD ring is drawn against.
    const delta =
      chipAwareStatValue('health', level + 1, world.loadout) - chipAwareStatValue('health', level, world.loadout);
    world.tower.health += delta;
  }

  emitVfx(world, { type: 'upgrade' });
  return 'bought';
}

export function getUpgradeCostOrNull(world: WorldState, id: UpgradeId): number | null {
  const def = UPGRADE_DEFS[id];
  const level = world.tower.levels[id];
  return isUpgradeMaxed(def, level) ? null : upgradeCostFor(def, level, world.loadout);
}
