import {
  COILWORKS_DEFS,
  coilworksValue,
  createInitialCoilworksUnlocked,
  isCoilworksAvailable,
  type CoilworksUnlockId,
  type CoilworksUpgradeId,
} from '../data/coilworks';
import { getVoltage } from '../data/voltages';
import type { RunLoadout, UpgradeId } from '../core/types';

/**
 * The one bridge from meta (persisted Coilworks levels/unlocks + selected
 * Voltage) into a run. `createWorld` takes the result and never reads the
 * meta store itself — keeps the sim testable headless (scripts/battle-sim.ts)
 * without a zustand store in the loop.
 *
 * A locked branch contributes its level-0 value, not zero: a player who never
 * bought "Unlock defense upgrades" still has the Spire's base 6 HP.
 */
export function buildRunLoadout(
  coilworksLevels: Record<CoilworksUpgradeId, number>,
  voltageTier: number,
  coilworksUnlocked: Record<CoilworksUnlockId, boolean> = createInitialCoilworksUnlocked(),
): RunLoadout {
  const value = (id: CoilworksUpgradeId) => {
    const def = COILWORKS_DEFS[id];
    const level = isCoilworksAvailable(def, coilworksUnlocked) ? (coilworksLevels[id] ?? 0) : 0;
    return coilworksValue(def, level);
  };
  const unlocked = (id: CoilworksUpgradeId) => isCoilworksAvailable(COILWORKS_DEFS[id], coilworksUnlocked);
  const voltage = getVoltage(voltageTier);

  /**
   * An in-run branch is buyable only once its Coilworks counterpart is
   * unlocked — the same rule the original's battle screen shows as "unlock
   * utility upgrades in the Coilworks". Damage, Attack Speed, Health and
   * Regen are the four that are always available (Health/Regen have a locked
   * *permanent* branch but are always upgradeable inside a run).
   */
  const runUpgradesUnlocked = {
    damage: true,
    attackSpeed: true,
    health: true,
    regen: true,
    critChance: unlocked('critChance'),
    critMultiplier: unlocked('critMultiplier'),
    armor: unlocked('armor'),
    deflection: unlocked('deflection'),
    chargePerWave: unlocked('chargePerWave'),
    scrapPerWave: unlocked('scrapPerWave'),
  } satisfies Record<UpgradeId, boolean>;

  return {
    damageBase: value('damage'),
    attackSpeedBase: value('attackSpeed'),
    healthBase: value('health'),
    regenBase: value('regen'),
    armorBase: value('armor'),
    deflectionBase: value('deflection'),
    critChanceBase: value('critChance'),
    critMultiplierBase: value('critMultiplier'),

    // Flat wave payouts pay nothing until their branch is bought — including
    // Scrap/wave, whose formula starts at 1 but only once unlocked.
    chargePerWave: unlocked('chargePerWave') ? value('chargePerWave') : 0,
    scrapPerWave: unlocked('scrapPerWave') ? value('scrapPerWave') : 0,
    chargeBonus: value('chargeBonus'),
    scrapPerKillBonus: value('scrapPerKillBonus'),

    voltageTier,
    scrapMult: voltage.scrapMult,
    enemyHpMult: voltage.enemyHpMult,
    enemyDmgMult: voltage.enemyDmgMult,
    runUpgradesUnlocked,
  };
}
