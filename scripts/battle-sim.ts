/**
 * Headless balance harness — no Skia, no React, no device. Runs the sim in
 * fixed steps and prints a wave-by-wave table so the curves can be eyeballed
 * before ever opening the app.
 *
 *   npm run sim                       -- Voltage 1, no Coilworks
 *   npm run sim -- --voltage=2        -- Voltage 2 multipliers, no Coilworks
 *   npm run sim -- --coilworks=20     -- every Coilworks branch at level 20
 *
 * Strategy modeled: spend Charge greedily on whichever affordable upgrade is
 * cheapest, every time enough Charge is banked. Not optimal play, just a
 * floor — if this dies too fast, an actual player (who can prioritize) does
 * fine; if this survives forever, the curve is too soft.
 */
import { UPGRADE_ORDER, getTowerAttackSpeed, getTowerDamage, getTowerMaxHealth } from '../src/game/data/tower-stats';
import { buyUpgrade } from '../src/game/core/upgrades';
import { createWorld, FIXED_DT, tickWorld } from '../src/game/core/world';
import { buildRunLoadout } from '../src/game/economy/loadout';
import { COILWORKS_ORDER, createInitialCoilworksLevels } from '../src/game/data/coilworks';
import type { CoilworksUpgradeId } from '../src/game/data/coilworks';

const MAX_WAVE = 50;
const SEED = 1;

function argValue(name: string): string | null {
  const arg = process.argv.find((a: string) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
}

function run(): void {
  const voltageTier = Number(argValue('voltage') ?? '1');
  const coilworksLevel = Number(argValue('coilworks') ?? '0');

  const coilworksLevels = createInitialCoilworksLevels();
  if (coilworksLevel > 0) {
    for (const id of COILWORKS_ORDER) coilworksLevels[id as CoilworksUpgradeId] = coilworksLevel;
  }
  const loadout = buildRunLoadout(coilworksLevels, voltageTier);

  const world = createWorld(SEED, loadout);
  let lastWave = 0;

  console.log(`Voltage ${voltageTier}, Coilworks level ${coilworksLevel}\n`);
  console.log('wave  time(s)  hp/max        dmg    atk/s  charge  scrap   kills  gems  scrap/hr');

  while (world.wave <= MAX_WAVE && world.phase !== 'ended') {
    tickWorld(world, FIXED_DT);

    // Greedy spend: try every upgrade in order, buy the first affordable one,
    // repeat until nothing more can be bought this tick.
    let bought = true;
    while (bought) {
      bought = false;
      for (const id of UPGRADE_ORDER) {
        if (buyUpgrade(world, id) === 'bought') {
          bought = true;
          break;
        }
      }
    }

    if (world.wave !== lastWave) {
      lastWave = world.wave;
      const maxHp = getTowerMaxHealth(world.tower.levels, world.loadout);
      const scrapPerHour = world.time > 0 ? (world.scrapEarned / world.time) * 3600 : 0;
      console.log(
        [
          String(world.wave).padStart(4),
          world.time.toFixed(1).padStart(7),
          `${world.tower.health.toFixed(0)}/${maxHp.toFixed(0)}`.padStart(11),
          getTowerDamage(world.tower.levels, world.loadout).toFixed(1).padStart(7),
          getTowerAttackSpeed(world.tower.levels, world.loadout).toFixed(2).padStart(7),
          world.charge.toFixed(1).padStart(7),
          world.scrapEarned.toFixed(1).padStart(7),
          String(world.killCount).padStart(7),
          String(world.gemsCollected).padStart(5),
          scrapPerHour.toFixed(0).padStart(9),
        ].join(' '),
      );
    }
  }

  if (world.result) {
    console.log(
      `\n${world.result.reason.toUpperCase()} at wave ${world.result.waveReached}, ` +
        `${world.result.timeSurvived.toFixed(1)}s survived, ${world.result.scrapEarned} scrap earned, ` +
        `${world.result.gemsCollected} gems collected.`,
    );
  } else {
    console.log(`\nReached wave ${world.wave} cap without dying.`);
  }
}

run();
