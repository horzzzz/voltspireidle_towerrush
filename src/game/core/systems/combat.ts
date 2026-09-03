import { ATTACK_RANGE, TOWER_X, TOWER_Y } from '../../data/arena';
import { ENEMY_ATTACK_INTERVAL } from '../../data/balance';
import {
  getTowerArmor,
  getTowerAttackSpeed,
  getTowerChargeBonus,
  getTowerCritChance,
  getTowerCritMultiplier,
  getTowerDamage,
  getTowerDeflection,
  getTowerScrapBonus,
} from '../../data/tower-stats';
import { towerIncomingDamage } from '../formulas';
import { emitVfx } from '../types';
import type { Enemy, WorldState } from '../types';

/** How long an enemy stays lit up after taking a hit — see `Enemy.hitFlash`. */
const HIT_FLASH_SECONDS = 0.12;

function findNearestTarget(world: WorldState): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = Infinity;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dist = Math.hypot(enemy.x - TOWER_X, enemy.y - TOWER_Y);
    if (dist <= ATTACK_RANGE + enemy.radius && dist < bestDist) {
      best = enemy;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Enemies are targetable a bit past ATTACK_RANGE — up to their own radius
 * beyond it, so a large body (a boss especially, at 2.2x scale) counts as
 * "in range" once it merely touches the ring rather than waiting for its
 * center to cross it. Drawing the bolt straight to that center would then
 * visibly poke past the dashed circle, so clamp the endpoint to the ring
 * itself: the bolt always terminates on or inside ATTACK_RANGE.
 */
function emitBolt(world: WorldState, targetX: number, targetY: number, isCrit: boolean): void {
  const dx = targetX - TOWER_X;
  const dy = targetY - TOWER_Y;
  const dist = Math.hypot(dx, dy);
  const reach = Math.min(dist, ATTACK_RANGE);
  const x2 = dist > 0 ? TOWER_X + (dx / dist) * reach : TOWER_X;
  const y2 = dist > 0 ? TOWER_Y + (dy / dist) * reach : TOWER_Y;

  emitVfx(world, { type: 'bolt', x1: TOWER_X, y1: TOWER_Y, x2, y2, isCrit });
}

/**
 * Per-kill income. Charge takes the Coilworks Charge Bonus; Scrap takes both
 * the Voltage multiplier and the Coilworks Scrap/Kill Bonus — the flat
 * per-wave payouts in `world.payWaveCycle` deliberately take neither, matching
 * the original.
 *
 * Chips layer on top, at the same site the original applies its own
 * `chip_stat_multiplier("charge_bonus"/"all_scrap_bonus")`: Charge and Scrap
 * chips always, Critical Scrap only when the blow that finished this enemy
 * off was a crit.
 */
function killEnemy(world: WorldState, enemy: Enemy, killedByCrit: boolean): void {
  const { loadout } = world;
  const { chips } = loadout;
  world.charge += enemy.chargeReward * (1 + getTowerChargeBonus(loadout)) * chips.chargeMult;
  world.scrapEarned +=
    enemy.scrapReward *
    loadout.scrapMult *
    (1 + getTowerScrapBonus(loadout)) *
    chips.scrapMult *
    (killedByCrit ? chips.critScrapMult : 1);
  world.killCount += 1;
  if (enemy.isBoss) world.bossKills += 1;
  if (enemy.dropsGem) world.gemsCollected += 1;
  enemy.hp = 0;

  emitVfx(world, {
    type: 'kill',
    x: enemy.x,
    y: enemy.y,
    radius: enemy.radius,
    kind: enemy.kind,
    isBoss: enemy.isBoss,
    bossVariant: enemy.bossVariant,
    dropsGem: enemy.dropsGem,
  });
}

function applyDamage(world: WorldState, enemy: Enemy, amount: number, isCrit: boolean): void {
  enemy.hp -= amount;
  enemy.hitFlash = 1;

  // Direction the shot arrived along — sparks spray outward from the tower,
  // which is what sells the hit as coming *from* somewhere.
  const dx = enemy.x - TOWER_X;
  const dy = enemy.y - TOWER_Y;
  const dist = Math.hypot(dx, dy);
  const dirX = dist > 0 ? dx / dist : 0;
  const dirY = dist > 0 ? dy / dist : 1;

  emitVfx(world, {
    type: 'hit',
    x: enemy.x,
    y: enemy.y,
    dirX,
    dirY,
    radius: enemy.radius,
    isCrit,
    isBoss: enemy.isBoss,
  });
  emitVfx(world, { type: 'damage', x: enemy.x, y: enemy.y, amount, isCrit, isBoss: enemy.isBoss });

  if (enemy.hp <= 0) killEnemy(world, enemy, isCrit);
}

/** Tower auto-attacks the nearest in-range enemy once its cooldown expires. */
export function updateTowerAttack(world: WorldState, dt: number): void {
  world.tower.attackCooldown -= dt;
  if (world.tower.attackCooldown > 0) return;

  const target = findNearestTarget(world);
  if (!target) return;

  const baseDamage = getTowerDamage(world.tower.levels, world.loadout);
  const isCrit = world.rng.next() < getTowerCritChance(world.tower.levels, world.loadout);
  const damage = isCrit ? baseDamage * getTowerCritMultiplier(world.tower.levels, world.loadout) : baseDamage;
  emitBolt(world, target.x, target.y, isCrit);
  applyDamage(world, target, damage, isCrit);

  const attackSpeed = getTowerAttackSpeed(world.tower.levels, world.loadout);
  world.tower.attackCooldown = 1 / attackSpeed;
}

/** Enemies standing at the tower chip away its HP — see `towerIncomingDamage`. */
export function updateContactDamage(world: WorldState, dt: number): void {
  const armor = getTowerArmor(world.tower.levels, world.loadout);
  const deflection = getTowerDeflection(world.tower.levels, world.loadout);
  for (const enemy of world.enemies) {
    if (!enemy.inContact || enemy.hp <= 0) continue;
    enemy.attackCooldown -= dt;
    if (enemy.attackCooldown > 0) continue;

    const dealt = towerIncomingDamage(enemy.contactDamage, armor, deflection);
    world.tower.health -= dealt;
    enemy.attackCooldown = ENEMY_ATTACK_INTERVAL;

    // Points from the attacker back at the tower — the slash/spark plays on
    // the tower's shell, not inside the enemy body.
    const dx = TOWER_X - enemy.x;
    const dy = TOWER_Y - enemy.y;
    const dist = Math.hypot(dx, dy);
    emitVfx(world, {
      type: 'towerHit',
      x: enemy.x,
      y: enemy.y,
      dirX: dist > 0 ? dx / dist : 0,
      dirY: dist > 0 ? dy / dist : -1,
      amount: dealt,
    });
  }
}

/**
 * Purely cosmetic per-enemy countdowns: the white hit flash and the age that
 * drives the spawn warp-in. Kept out of `updateMovement` so that system stays
 * about movement, and out of the render layer so a paused/backgrounded frame
 * can't desync them from the sim clock they belong to.
 */
export function advanceEnemyTimers(world: WorldState, dt: number): void {
  const flashStep = dt / HIT_FLASH_SECONDS;
  for (const enemy of world.enemies) {
    enemy.age += dt;
    if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - flashStep);
  }
}

/**
 * Drops dead enemies — run once per tick.
 *
 * Effects are no longer time-pruned here, and no longer live on the world at
 * all beyond a single frame: everything visual is emitted as a `VfxEvent`
 * (see core/types.ts) into `world.vfx`, which the render layer drains every
 * frame — not at the throttled ~10Hz HUD publish rate the old bolt/popup
 * arrays were tied to. That is what lets an effect be *animated* rather than
 * flashed for exactly one snapshot.
 */
export function pruneCombatState(world: WorldState): void {
  if (world.enemies.some((e) => e.hp <= 0)) {
    world.enemies = world.enemies.filter((e) => e.hp > 0);
  }
}
