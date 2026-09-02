/**
 * Headless balance harness — no Skia, no React, no device. Runs the sim in
 * fixed steps and prints a wave-by-wave table so the curves can be eyeballed
 * before ever opening the app. `npm run sim`.
 *
 * Strategy modeled: spend Charge greedily on whichever affordable upgrade is
 * cheapest, every time enough Charge is banked. Not optimal play, just a
 * floor — if this dies too fast, an actual player (who can prioritize) does
 * fine; if this survives forever, the curve is too soft.
 */
import { UPGRADE_ORDER, getTowerAttackSpeed, getTowerDamage, getTowerMaxHealth } from '../src/game/data/tower-stats';
import { buyUpgrade } from '../src/game/core/upgrades';
import { createWorld, FIXED_DT, tickWorld } from '../src/game/core/world';

const MAX_WAVE = 50;
const SEED = 1;

function run(): void {
  const world = createWorld(SEED);
  let lastWave = 0;

  console.log('wave  time(s)  hp/max        dmg    atk/s  charge  scrap   kills');

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
      const maxHp = getTowerMaxHealth(world.tower.levels);
      console.log(
        [
          String(world.wave).padStart(4),
          world.time.toFixed(1).padStart(7),
          `${world.tower.health.toFixed(0)}/${maxHp.toFixed(0)}`.padStart(11),
          getTowerDamage(world.tower.levels).toFixed(1).padStart(7),
          getTowerAttackSpeed(world.tower.levels).toFixed(2).padStart(7),
          world.charge.toFixed(1).padStart(7),
          world.scrapEarned.toFixed(1).padStart(7),
          String(world.killCount).padStart(7),
        ].join(' '),
      );
    }
  }

  if (world.result) {
    console.log(
      `\n${world.result.reason.toUpperCase()} at wave ${world.result.waveReached}, ` +
        `${world.result.timeSurvived.toFixed(1)}s survived, ${world.result.scrapEarned} scrap earned.`,
    );
  } else {
    console.log(`\nReached wave ${world.wave} cap without dying.`);
  }
}

run();
