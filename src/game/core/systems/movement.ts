import { TOWER_BODY_RADIUS, TOWER_X, TOWER_Y } from '../../data/arena';
import type { WorldState } from '../types';

/**
 * Straight-line walk to the tower center. Once within contact range the
 * enemy stops (clamped, not overlapping the tower body) and `inContact`
 * flips on — combat.ts reads that flag for melee hits.
 *
 * Also refreshes `dirX/dirY` — the unit vector toward the tower — every
 * tick, whether moving or standing in contact. enemy-atlas.tsx uses it to
 * rotate the sprite to face the tower instead of always drawing it in its
 * source (facing-down) orientation.
 */
export function updateMovement(world: WorldState, dt: number): void {
  for (const enemy of world.enemies) {
    const dx = TOWER_X - enemy.x;
    const dy = TOWER_Y - enemy.y;
    const dist = Math.hypot(dx, dy);
    const stopDist = TOWER_BODY_RADIUS + enemy.radius;

    if (dist > 0) {
      enemy.dirX = dx / dist;
      enemy.dirY = dy / dist;
    }

    if (dist > stopDist) {
      const step = Math.min(enemy.speed * dt, dist - stopDist);
      enemy.x += (dx / dist) * step;
      enemy.y += (dy / dist) * step;
      enemy.inContact = false;
    } else {
      enemy.inContact = true;
    }
  }
}
