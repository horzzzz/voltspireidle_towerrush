import {
  COILWORKS_DEFS,
  coilworksValue,
  createInitialCoilworksUnlocked,
  type CoilworksUpgradeId,
} from '../data/coilworks';
import { getVoltage } from '../data/voltages';
import type { RunLoadout, UpgradeId } from '../core/types';

/**
 * The one bridge from meta (persisted Coilworks levels/unlocks + selected
 * Voltage) into a run. `createWorld` takes the result and never reads the
 * meta store itself — keeps the sim testable headless (scripts/battle-sim.ts)
 * without a zustand store in the loop.
 */
export function buildRunLoadout(
  coilworksLevels: Record<CoilworksUpgradeId, number>,
  voltageTier: number,
  coilworksUnlocked: Record<CoilworksUpgradeId, boolean> = createInitialCoilworksUnlocked(),
): RunLoadout {
  const level = (id: CoilworksUpgradeId) => coilworksValue(COILWORKS_DEFS[id], coilworksLevels[id] ?? 0);
  const voltage = getVoltage(voltageTier);

  const runUpgradesUnlocked = {
    damage: true,
    attackSpeed: true,
    critChance: coilworksUnlocked.critChance,
    health: true,
    regen: true,
    deflection: true,
    armor: coilworksUnlocked.armor,
    scrapBonus: true,
  } satisfies Record<UpgradeId, boolean>;

  return {
    damageBase: level('damage'),
    attackSpeedBase: level('attackSpeed'),
    healthBase: level('health'),
    regenBase: level('regen'),
    critChance: level('critChance') / 100,
    armor: level('armor'),
    deflectionBase: level('deflection') / 100,
    scrapPerWave: level('scrapPerWave'),
    chargeBonus: level('chargeBonus') / 100,
    voltageTier,
    scrapMult: voltage.scrapMult,
    enemyHpMult: voltage.enemyHpMult,
    enemyDmgMult: voltage.enemyDmgMult,
    runUpgradesUnlocked,
  };
}
