import { ATTACK_RANGE, TOWER_BODY_RADIUS } from '@/game/data/arena';

/**
 * Sits between the tower art and the dashed attack-range ring — clear of both.
 *
 * The ring itself is now drawn inside `render/vfx/vfx-picture.tsx`, straight
 * from the VFX globals buffer's `G.hp` field (packed once a frame by
 * `VfxSystem`, alongside every other screen-wide effect) rather than as its
 * own React component subscribed to `battle-store`: that subscription used
 * to re-render this node — and rebuild its `Skia.Path` — up to 10 times a
 * second any time the tower's HP changed even slightly (regen ticking, or
 * contact damage), which is most of a run. Only the radius constant survives
 * here, since `arena.ts` and the picture layer both need it.
 */
export const RING_RADIUS = (TOWER_BODY_RADIUS + ATTACK_RANGE) / 2;
