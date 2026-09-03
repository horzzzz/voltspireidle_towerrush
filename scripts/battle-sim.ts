/**
 * Headless balance harness — no Skia, no React, no device. Runs the sim in
 * fixed steps and prints a wave-by-wave table so the curves can be eyeballed
 * before ever opening the app.
 *
 *   npm run sim                       -- Voltage 1, no Coilworks
 *   npm run sim -- --voltage=2        -- Voltage 2 multipliers, no Coilworks
 *   npm run sim -- --coilworks=20     -- every Coilworks branch at level 20
 *   npm run sim -- --waves=200        -- run further than the default 50
 *   npm run sim -- --chips=scrap:6,charge:3
 *                                     -- equip chips at the given levels
 *                                        (level defaults to 1; the socket cap
 *                                        of the real game is not enforced
 *                                        here, so effects can be isolated)
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
import { CHIP_BY_ID, CHIP_MAX_LEVEL } from '../src/game/data/chips';
import {
  COILWORKS_ORDER,
  COILWORKS_UNLOCKS,
  createInitialCoilworksLevels,
  createInitialCoilworksUnlocked,
} from '../src/game/data/coilworks';
import type { CoilworksUnlockId, CoilworksUpgradeId } from '../src/game/data/coilworks';

const SEED = 1;

function argValue(name: string): string | null {
  const arg = process.argv.find((a: string) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
}

/** `--chips=scrap:6,charge` -> ids in socket order plus their levels. */
function parseChips(): { equipped: string[]; levels: Record<string, number> } {
  const raw = argValue('chips');
  const equipped: string[] = [];
  const levels: Record<string, number> = {};
  if (!raw) return { equipped, levels };

  for (const entry of raw.split(',')) {
    const [id, levelText] = entry.split(':');
    if (!CHIP_BY_ID[id]) {
      console.log(`unknown chip id "${id}" — known: ${Object.keys(CHIP_BY_ID).join(', ')}`);
      process.exit(1);
    }
    equipped.push(id);
    levels[id] = Math.min(CHIP_MAX_LEVEL, Math.max(1, Number(levelText ?? '1')));
  }
  return { equipped, levels };
}

function run(): void {
  const voltageTier = Number(argValue('voltage') ?? '1');
  const coilworksLevel = Number(argValue('coilworks') ?? '0');
  const maxWave = Number(argValue('waves') ?? '80');
  const chips = parseChips();

  const coilworksLevels = createInitialCoilworksLevels();
  const unlocked = createInitialCoilworksUnlocked();
  if (coilworksLevel > 0) {
    // A Coilworks level only means anything once its branch is unlocked, so a
    // "level N everywhere" run buys every unlock too.
    for (const id of COILWORKS_ORDER) coilworksLevels[id as CoilworksUpgradeId] = coilworksLevel;
    for (const id of Object.keys(COILWORKS_UNLOCKS) as CoilworksUnlockId[]) unlocked[id] = true;
  }
  const loadout = buildRunLoadout(coilworksLevels, voltageTier, unlocked, chips.equipped, chips.levels);

  const world = createWorld(SEED, loadout);
  let lastWave = 0;

  const chipsLabel =
    chips.equipped.length > 0 ? chips.equipped.map((id) => `${id} lvl ${chips.levels[id]}`).join(', ') : 'none';
  console.log(`Voltage ${voltageTier}, Coilworks level ${coilworksLevel}, chips: ${chipsLabel}\n`);
  console.log('wave  time(s)  hp/max        dmg    atk/s  charge  scrap   kills alive  scrap/hr');

  while (world.wave <= maxWave && world.phase !== 'ended') {
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
          String(world.enemies.length).padStart(5),
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
