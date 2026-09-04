import type { VfxEvent } from '../core/types';
import { playSfx, type SfxOptions } from './engine';
import type { SfxId } from './sfx';

/**
 * The sim's `VfxEvent` stream, turned into sound.
 *
 * Deliberately plain TypeScript with no React, no Reanimated and no store —
 * the same rule `vfx/system.ts` follows, and for the same reason: it is driven
 * by `use-battle-engine`'s existing rAF loop, right next to the VFX update,
 * off the very same queue. Sound and picture therefore can never disagree
 * about what happened, and neither one needs a timer of its own.
 *
 * Not every event earns a sound. `hit` and `damage` are dropped outright: they
 * fire alongside the `bolt` that caused them, so voicing them would just be
 * the shot again, three times a shot.
 *
 * The rest is about restraint. A maxed tower fires several times a second and
 * the x3 button triples that, while a wave wipe can kill a dozen enemies
 * inside one frame — played back literally, that is a buzz and a mud puddle
 * rather than a battle. Two mechanisms keep it legible, and both are per-id:
 * a minimum spacing, and a ceiling on how many can start in a single frame.
 */

/** How often an id may retrigger, in ms, and how many may start in one frame. */
type Budget = { minIntervalMs: number; maxPerFrame: number };

const DEFAULT_BUDGET: Budget = { minIntervalMs: 150, maxPerFrame: 1 };

const BUDGETS: Partial<Record<SfxId, Budget>> = {
  // The tower's own fire rate is the fastest thing here by far. 70 ms is
  // slightly quicker than a listener resolves two taps as separate, so the
  // stream still reads as "firing fast" rather than as a tone.
  'tower-shot': { minIntervalMs: 70, maxPerFrame: 2 },
  'tower-crit': { minIntervalMs: 70, maxPerFrame: 2 },
  // Deaths cluster hard — a wave clears in bursts, not evenly.
  'enemy-death': { minIntervalMs: 40, maxPerFrame: 3 },
  // Several enemies can be in contact at once, all chewing on the tower every
  // tick; one voice per 120 ms is enough to read as "under attack".
  'tower-hit': { minIntervalMs: 120, maxPerFrame: 1 },
};

/**
 * How far the pitch of a retriggering sound is allowed to wander, as a
 * fraction of its rate. Without this the shot queue lands on the exact same
 * sample every time and fuses into one continuous note; ±6% is enough to keep
 * the individual shots distinct without sounding detuned.
 */
const DETUNE = 0.06;

/** Ids whose repeats are detuned. Anything rare enough to hear on its own is left alone. */
const DETUNED: Partial<Record<SfxId, true>> = {
  'tower-shot': true,
  'tower-crit': true,
  'enemy-death': true,
};

/**
 * Reused rather than built per play. `playSfx` reads it synchronously and
 * keeps no reference, so one mutable object is safe — and this runs inside the
 * battle's rAF loop, where a few short-lived objects every frame is exactly
 * the kind of steady drip this renderer went out of its way to remove (see
 * vfx/frame-buffer.ts).
 */
const detuneOptions: SfxOptions = { rate: 1 };

/**
 * Last start time per id, on the wall clock (`performance.now()`), not the
 * sim clock. Sound spacing is about what the ear can separate, which does not
 * speed up when the player hits x3 — at x3 the sim simply produces more
 * events than the budget will let through, which is the intended outcome.
 */
const lastPlayedAt = new Map<SfxId, number>();
/** Reused every frame so the hot path allocates nothing. */
const playedThisFrame = new Map<SfxId, number>();

function emit(id: SfxId, now: number): void {
  const budget = BUDGETS[id] ?? DEFAULT_BUDGET;

  const started = playedThisFrame.get(id) ?? 0;
  if (started >= budget.maxPerFrame) return;

  const last = lastPlayedAt.get(id);
  if (last !== undefined && now - last < budget.minIntervalMs) return;

  playedThisFrame.set(id, started + 1);
  lastPlayedAt.set(id, now);

  if (DETUNED[id]) {
    detuneOptions.rate = 1 + (Math.random() * 2 - 1) * DETUNE;
    playSfx(id, detuneOptions);
  } else {
    playSfx(id);
  }
}

/**
 * Voices one frame's worth of sim events.
 *
 * `events` is the world's pooled queue and `count` the number of live entries
 * in it — the records past `count` are stale and must not be read (see
 * `emitVfx` in core/types.ts). Call this *before* the engine rewinds the
 * count, and after `vfx.update`, which reads the same range.
 */
export function consumeBattleEvents(events: readonly VfxEvent[], count: number): void {
  if (count === 0) return;

  playedThisFrame.clear();
  const now = performance.now();

  for (let i = 0; i < count; i += 1) {
    const event = events[i];
    switch (event.type) {
      case 'bolt':
        emit(event.isCrit ? 'tower-crit' : 'tower-shot', now);
        break;
      case 'kill':
        emit(event.isBoss ? 'boss-death' : 'enemy-death', now);
        break;
      case 'towerHit':
        emit('tower-hit', now);
        break;
      case 'spawn':
        // Only bosses announce themselves. Ordinary enemies drip in
        // continuously for the whole spawn phase — voicing those would be a
        // second, permanent stream underneath the shots.
        if (event.isBoss) emit('boss-spawn', now);
        break;
      case 'waveStart':
        emit('wave-start', now);
        break;
      case 'upgrade':
        emit('run-upgrade', now);
        break;
      // 'hit' and 'damage' are intentionally silent — see the module comment.
    }
  }
}

/**
 * Drops the retrigger history. Called when a run restarts: the timestamps are
 * from a battle that is over, and the first shot of a new one should never be
 * swallowed by the spacing rule.
 */
export function resetBattleSfx(): void {
  lastPlayedAt.clear();
  playedThisFrame.clear();
}
