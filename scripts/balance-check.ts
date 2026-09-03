/**
 * Parity harness — asserts this port's curves still reproduce the original's
 * (Voltspire: Idle Tower Defense 1.9.0). Every expected number below was
 * either read off the running game or computed from the formulas extracted
 * from its shipped `index.pck`, so a failure here means the port drifted, not
 * that the balance was "tuned".
 *
 *   npm run balance
 *
 * The one intentional deviation, `ENEMY_HP_SCALE`, is divided back out before
 * the HP assertions — calibrating it must never break parity.
 */
import { ENEMY_HP_SCALE } from '../src/game/data/balance';
import {
  chargeRewardForWave,
  enemyContactDamageForWave,
  enemyCountForWave,
  enemyHpForWave,
  towerIncomingDamage,
  voltageDmgMultiplier,
  voltageHpMultiplier,
  voltageScrapMultiplier,
} from '../src/game/core/formulas';
import { COILWORKS_DEFS, COILWORKS_UNLOCKS, coilworksCost, coilworksValue } from '../src/game/data/coilworks';
import { UPGRADE_DEFS, upgradeCost, upgradeValue } from '../src/game/data/tower-stats';
import { ENEMY_PROFILES } from '../src/game/data/enemies';

let failures = 0;
let checks = 0;

/** Relative tolerance — the on-screen figures are rounded to 2-3 significant digits. */
function near(label: string, actual: number, expected: number, tolerance = 0.005): void {
  checks++;
  const diff = Math.abs(actual - expected);
  const scale = Math.max(Math.abs(expected), 1e-9);
  if (diff / scale > tolerance) {
    failures++;
    console.log(`  FAIL  ${label}: got ${actual}, expected ${expected}`);
  }
}

function section(name: string): void {
  console.log(`\n${name}`);
}

// --- Coilworks, read off the original's Coilworks screen on a fresh save ---
section('Coilworks (permanent, Scrap)');
{
  const damage = COILWORKS_DEFS.damage;
  near('damage value L0', coilworksValue(damage, 0), 14);
  near('damage value L1', coilworksValue(damage, 1), 14.66);
  near('damage cost L0', coilworksCost(damage, 0), 25);
  near('damage cost L1', coilworksCost(damage, 1), 26.42);
  // Level 100 is the first anchor: exactly x100 on the stat.
  near('damage value L100', coilworksValue(damage, 100), 1400);

  const attackSpeed = COILWORKS_DEFS.attackSpeed;
  near('attack speed value L0', coilworksValue(attackSpeed, 0), 1.0);
  near('attack speed value L1', coilworksValue(attackSpeed, 1), 1.03);
  near('attack speed cost L0', coilworksCost(attackSpeed, 0), 20);
  near('attack speed cost L1', coilworksCost(attackSpeed, 1), 20.8);

  near('health value L1', coilworksValue(COILWORKS_DEFS.health, 1), 6.28);
  near('health cost L0', coilworksCost(COILWORKS_DEFS.health, 0), 25);
  near('regen value L1', coilworksValue(COILWORKS_DEFS.regen, 1), 0.2094, 0.01);
  near('regen cost L0', coilworksCost(COILWORKS_DEFS.regen, 0), 25);

  near('unlock crit chance', COILWORKS_UNLOCKS.critChance.cost, 30);
  near('unlock defense', COILWORKS_UNLOCKS.defense.cost, 60);
  near('unlock scrap/wave', COILWORKS_UNLOCKS.scrapPerWave.cost, 100);
  near('unlock armor', COILWORKS_UNLOCKS.armor.cost, 150);
}

// --- Battle upgrades, read off the original's wave-1 upgrade sheet ---------
section('Battle upgrades (in-run, Charge)');
{
  const damage = UPGRADE_DEFS.damage;
  near('damage value L0', upgradeValue(damage, 0), 14);
  near('damage value L1', upgradeValue(damage, 1), 16.1);
  near('damage cost L0', upgradeCost(damage, 0), 5);
  near('damage cost L1', upgradeCost(damage, 1), 5.85);

  near('attack speed value L1', upgradeValue(UPGRADE_DEFS.attackSpeed, 1), 1.04);
  near('attack speed cost L0', upgradeCost(UPGRADE_DEFS.attackSpeed, 0), 7.5);

  near('health value L1', upgradeValue(UPGRADE_DEFS.health, 1), 6.9);
  near('health cost L0', upgradeCost(UPGRADE_DEFS.health, 0), 5);

  near('regen value L1', upgradeValue(UPGRADE_DEFS.regen, 1), 0.23);
  near('regen cost L0', upgradeCost(UPGRADE_DEFS.regen, 0), 15);

  // The brake that ends a run: price outruns effect (1.17 vs 1.15).
  near('damage cost L60', upgradeCost(damage, 60), 61676.8, 0.001);
  near('damage value L60', upgradeValue(damage, 60), 61376, 0.001);
}

// --- Enemy curves ---------------------------------------------------------
section('Enemies');
{
  const hp = (w: number) => enemyHpForWave(w) / ENEMY_HP_SCALE;
  near('hp wave 1', hp(1), 2.82, 0.02);
  near('hp wave 10', hp(10), 27.2, 0.01);
  near('hp wave 30', hp(30), 150.5, 0.01);
  near('hp wave 50', hp(50), 438.8, 0.01);
  near('hp wave 100', hp(100), 3109, 0.01);

  near('count wave 10', enemyCountForWave(10), 18);
  near('count wave 30', enemyCountForWave(30), 34);
  near('count wave 50', enemyCountForWave(50), 50);
  near('count wave 100', enemyCountForWave(100), 90);

  near('contact damage wave 1', enemyContactDamageForWave(1), 1);
  near('contact damage wave 50', enemyContactDamageForWave(50), 17.38, 0.01);

  near('charge/kill wave 10', chargeRewardForWave(10), 0.764, 0.01);
  near('charge/kill wave 50', chargeRewardForWave(50), 5.794, 0.01);

  near('tank hp multiplier', ENEMY_PROFILES.hulk.hpMul, 5);
  near('tank speed multiplier', ENEMY_PROFILES.hulk.speedMul, 0.5);
  near('fast speed multiplier', ENEMY_PROFILES.runner.speedMul, 2);
  near('fast hp multiplier', ENEMY_PROFILES.runner.hpMul, 1);
}

// --- Voltage ladders ------------------------------------------------------
section('Voltage');
{
  near('V2 hp', voltageHpMultiplier(2), 22);
  near('V3 hp', voltageHpMultiplier(3), 55);
  near('V2 scrap', voltageScrapMultiplier(2), 2.2);
  near('V2 damage', voltageDmgMultiplier(2), 2.4);
}

// --- Damage reduction -----------------------------------------------------
section('Incoming damage');
{
  near('armor only', towerIncomingDamage(10, 1, 0), 9);
  near('armor + 30% deflection', towerIncomingDamage(10, 1, 0.3), 6.3);
  // The 5% floor is the real cap on reduction, not a clamp on Deflection.
  near('over-stacked reduction floors at 5%', towerIncomingDamage(10, 1, 0.99), 0.5);
  near('armor above raw floors at 5%', towerIncomingDamage(10, 99, 0), 0.5);
}

console.log(
  `\n${failures === 0 ? 'OK' : 'DRIFT'} — ${checks - failures}/${checks} parity checks passed` +
    (ENEMY_HP_SCALE === 1 ? '' : `  (ENEMY_HP_SCALE = ${ENEMY_HP_SCALE}, divided out of the HP checks)`),
);
process.exit(failures === 0 ? 0 : 1);
