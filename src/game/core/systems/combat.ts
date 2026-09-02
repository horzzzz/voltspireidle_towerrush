import { ATTACK_RANGE, TOWER_X, TOWER_Y } from '../../data/arena';
import {
  CRIT_MULTIPLIER,
  getTowerArmor,
  getTowerAttackSpeed,
  getTowerChargeBonus,
  getTowerCritChance,
  getTowerDamage,
  getTowerDeflection,
} from '../../data/tower-stats';
import type { Enemy, WorldState } from '../types';

/** Even at the deflection cap (75%) and full armor, a contact hit still does at least this much. */
const MIN_CONTACT_DAMAGE_FRACTION = 0.05;

/** Enemies hit the tower once per second while in contact. */
const CONTACT_HIT_INTERVAL = 1;

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
function spawnBolt(world: WorldState, targetX: number, targetY: number): void {
  const dx = targetX - TOWER_X;
  const dy = targetY - TOWER_Y;
  const dist = Math.hypot(dx, dy);
  const reach = Math.min(dist, ATTACK_RANGE);
  const x2 = dist > 0 ? TOWER_X + (dx / dist) * reach : TOWER_X;
  const y2 = dist > 0 ? TOWER_Y + (dy / dist) * reach : TOWER_Y;

  world.bolts.push({
    id: world.nextEffectId++,
    x1: TOWER_X,
    y1: TOWER_Y,
    x2,
    y2,
    spawnedAt: world.time,
  });
}

function spawnDamagePopup(
  world: WorldState,
  x: number,
  y: number,
  amount: number,
  isBoss: boolean,
  isCrit: boolean,
): void {
  world.damagePopups.push({
    id: world.nextEffectId++,
    x,
    y,
    amount,
    isBoss,
    isCrit,
    spawnedAt: world.time,
  });
}

function killEnemy(world: WorldState, enemy: Enemy): void {
  const chargeBonus = getTowerChargeBonus(world.loadout);
  world.charge += enemy.chargeReward * (1 + chargeBonus);
  world.killCount += 1;
  if (enemy.dropsGem) world.gemsCollected += 1;
  enemy.hp = 0;
}

function applyDamage(world: WorldState, enemy: Enemy, amount: number, isCrit: boolean): void {
  enemy.hp -= amount;
  spawnDamagePopup(world, enemy.x, enemy.y, amount, enemy.isBoss, isCrit);
  if (enemy.hp <= 0) killEnemy(world, enemy);
}

/** Tower auto-attacks the nearest in-range enemy once its cooldown expires. */
export function updateTowerAttack(world: WorldState, dt: number): void {
  world.tower.attackCooldown -= dt;
  if (world.tower.attackCooldown > 0) return;

  const target = findNearestTarget(world);
  if (!target) return;

  const baseDamage = getTowerDamage(world.tower.levels, world.loadout);
  const isCrit = world.rng.next() < getTowerCritChance(world.loadout, world.tower.levels);
  const damage = isCrit ? baseDamage * CRIT_MULTIPLIER : baseDamage;
  applyDamage(world, target, damage, isCrit);
  spawnBolt(world, target.x, target.y);

  const attackSpeed = getTowerAttackSpeed(world.tower.levels, world.loadout);
  world.tower.attackCooldown = 1 / attackSpeed;
}

/** Enemies standing at the tower chip away its HP — reduced by flat Armor, then by Deflection%. */
export function updateContactDamage(world: WorldState, dt: number): void {
  const armor = getTowerArmor(world.loadout, world.tower.levels);
  const deflection = getTowerDeflection(world.tower.levels, world.loadout);
  for (const enemy of world.enemies) {
    if (!enemy.inContact || enemy.hp <= 0) continue;
    enemy.attackCooldown -= dt;
    if (enemy.attackCooldown > 0) continue;

    const afterArmor = Math.max(
      enemy.contactDamage * MIN_CONTACT_DAMAGE_FRACTION,
      enemy.contactDamage - armor,
    );
    world.tower.health -= afterArmor * (1 - deflection);
    enemy.attackCooldown = CONTACT_HIT_INTERVAL;
  }
}

/**
 * Drops dead enemies — run once per tick.
 *
 * Bolts and damage popups are deliberately NOT time-pruned here anymore.
 * The sim runs at 60Hz but the HUD only sees a throttled ~10Hz snapshot
 * (see battle-store's publish) — pruning by age on the sim's own clock
 * raced that snapshot: a bolt with a short TTL could expire and get
 * filtered out before a delayed publish (a dropped frame, GC pause) ever
 * captured it, so a real hit — sometimes the killing blow — silently never
 * showed a beam. Effects now accumulate in `world.bolts`/`damagePopups`
 * until use-battle-engine drains them right after each publish, so every
 * effect is guaranteed to appear in exactly one snapshot, never raced away.
 */
export function pruneCombatState(world: WorldState): void {
  if (world.enemies.some((e) => e.hp <= 0)) {
    world.enemies = world.enemies.filter((e) => e.hp > 0);
  }
}
