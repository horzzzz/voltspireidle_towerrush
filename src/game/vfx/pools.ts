import type { Rng } from '../core/rng';
import { Brush, P, PR, R, RR } from './layout';
import type { Rgb } from './palette';

/**
 * A fixed-capacity particle pool: simulation state in one flat `Float32Array`,
 * packed each frame into a second one laid out the way the Skia `<Atlas>`
 * worklets read it (see layout.ts).
 *
 * Shared by the battle scene (vfx/system.ts) and the menus' reward bursts
 * (components/fx/reward-overlay.tsx) — same pool, same brushes, same single
 * draw call, so a gem flying into the HUD is built out of exactly the same
 * machinery as a spark coming off a kill.
 *
 * Allocation is round-robin: once every slot is busy a new particle takes the
 * oldest one's place. That is the whole overflow policy — the cost of a frame
 * cannot grow past `capacity`, and heavy action degrades by shedding the
 * stalest particles rather than by dropping frames.
 */
export class ParticlePool {
  readonly capacity: number;
  private readonly data: Float32Array;
  /**
   * Reallocated fresh every `update()`, deliberately — see `use-battle-engine`'s
   * own note on this. Reusing a fixed pair of output buffers and mutating them
   * in place (the obvious "zero allocation" move) silently breaks Reanimated's
   * cross-thread propagation on this project's setup: its JS↔UI shareable
   * cache keys off the *array's object identity*, not its contents, so handing
   * the same reference back with new numbers in it never reaches the UI
   * thread's copy — the Atlas/Picture nodes reading this buffer just freeze at
   * whatever they last saw. A fresh `Float32Array` per frame is what makes a
   * plain `sharedValue.value = buffer` assignment actually propagate every
   * time. Cheap enough at this size (tens of KB/frame) not to trouble Hermes'
   * GC — this exact trade was already made, and documented, for enemy
   * positions before any of this VFX work existed.
   */
  private out: Float32Array;
  private cursor = 0;
  private aliveCount = 0;
  private readonly rng: Rng;

  constructor(capacity: number, rng: Rng) {
    this.capacity = capacity;
    this.rng = rng;
    this.data = new Float32Array(capacity * P.STRIDE);
    this.out = new Float32Array(capacity * PR.STRIDE);
  }

  /** Live particles as of the last `update`. Drives the automatic detail scaling. */
  get alive(): number {
    return this.aliveCount;
  }

  /** The buffer packed by the last `update` — a fresh reference every call. */
  get buffer(): Float32Array {
    return this.out;
  }

  reset(): void {
    this.data.fill(0);
    this.out.fill(0);
    this.aliveCount = 0;
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size0: number,
    size1: number,
    rotVel: number,
    color: Rgb,
    alpha: number,
    brush: number,
    drag: number,
    gravity: number,
    homeX = 0,
    homeY = 0,
    homing = 0,
  ): void {
    const slot = this.cursor;
    this.cursor = (slot + 1) % this.capacity;
    const base = slot * P.STRIDE;
    const d = this.data;

    d[base + P.x] = x;
    d[base + P.y] = y;
    d[base + P.vx] = vx;
    d[base + P.vy] = vy;
    d[base + P.life] = life;
    d[base + P.invMaxLife] = 1 / life;
    d[base + P.size0] = size0;
    d[base + P.size1] = size1;
    // A streak brush must point where it is going — its bright head is drawn
    // at +x in the atlas cell (see brush-atlas.ts), so aligning rotation to
    // the velocity is what makes a spark look thrown rather than scattered.
    const isStreak = brush === Brush.Spark;
    d[base + P.rot] = isStreak ? Math.atan2(vy, vx) : this.rng.range(0, Math.PI * 2);
    d[base + P.rotVel] = isStreak ? 0 : rotVel;
    d[base + P.r] = color[0];
    d[base + P.g] = color[1];
    d[base + P.b] = color[2];
    d[base + P.alpha] = alpha;
    d[base + P.brush] = brush;
    d[base + P.drag] = drag;
    d[base + P.gravity] = gravity;
    d[base + P.homeX] = homeX;
    d[base + P.homeY] = homeY;
    d[base + P.homing] = homing;
  }

  /** Integrates every live particle and repacks the render buffer. */
  update(dt: number): void {
    const d = this.data;
    let alive = 0;

    for (let i = 0; i < this.capacity; i++) {
      const base = i * P.STRIDE;
      const life = d[base + P.life];
      if (life <= 0) continue;

      const left = life - dt;
      if (left <= 0) {
        d[base + P.life] = 0;
        continue;
      }
      d[base + P.life] = left;
      alive++;

      const drag = d[base + P.drag];
      if (drag > 0) {
        const damp = Math.max(0, 1 - drag * dt);
        d[base + P.vx] *= damp;
        d[base + P.vy] *= damp;
      }
      d[base + P.vy] += d[base + P.gravity] * dt;

      const homing = d[base + P.homing];
      if (homing > 0) {
        // Steer, don't teleport: the mote keeps its scatter for a moment and
        // then curves into the counter it is being paid to.
        const hx = d[base + P.homeX] - d[base + P.x];
        const hy = d[base + P.homeY] - d[base + P.y];
        const dist = Math.hypot(hx, hy) || 1;
        d[base + P.vx] += (hx / dist) * homing * dt;
        d[base + P.vy] += (hy / dist) * homing * dt;
      }

      d[base + P.x] += d[base + P.vx] * dt;
      d[base + P.y] += d[base + P.vy] * dt;
      d[base + P.rot] += d[base + P.rotVel] * dt;
    }

    this.aliveCount = alive;
    this.out = new Float32Array(this.capacity * PR.STRIDE);
    this.pack(this.out);
  }

  private pack(out: Float32Array): void {
    const d = this.data;
    for (let i = 0; i < this.capacity; i++) {
      const base = i * P.STRIDE;
      const outBase = i * PR.STRIDE;
      const life = d[base + P.life];
      if (life <= 0) continue; // fresh array is already zeroed
      // 0 at birth, 1 at death.
      const t = 1 - life * d[base + P.invMaxLife];
      // Quick attack so nothing pops in at full brightness, long ease-out tail.
      const fade = t < 0.12 ? t / 0.12 : (1 - (t - 0.12) / 0.88) ** 1.5;

      out[outBase + PR.x] = d[base + P.x];
      out[outBase + PR.y] = d[base + P.y];
      out[outBase + PR.size] = d[base + P.size0] + (d[base + P.size1] - d[base + P.size0]) * t;
      out[outBase + PR.rot] = d[base + P.rot];
      out[outBase + PR.r] = d[base + P.r];
      out[outBase + PR.g] = d[base + P.g];
      out[outBase + PR.b] = d[base + P.b];
      out[outBase + PR.a] = d[base + P.alpha] * fade;
      out[outBase + PR.brush] = d[base + P.brush];
    }
  }
}

/**
 * Expanding (or imploding) stroked rings — shockwaves, warp-ins, level-up
 * pulses. Same fixed-capacity, round-robin, double-buffered contract as
 * `ParticlePool`; drawn by the `<Picture>` layer rather than the atlas,
 * because a ring is one stroked circle and there are never many at once.
 */
export class RingPool {
  readonly capacity: number;
  private readonly data: Float32Array;
  /** Fresh every `update()` — see `ParticlePool`'s own note on why. */
  private out: Float32Array;
  private cursor = 0;
  private aliveCount = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * R.STRIDE);
    this.out = new Float32Array(capacity * RR.STRIDE);
  }

  get alive(): number {
    return this.aliveCount;
  }

  get buffer(): Float32Array {
    return this.out;
  }

  reset(): void {
    this.data.fill(0);
    this.out.fill(0);
    this.aliveCount = 0;
  }

  spawn(
    x: number,
    y: number,
    from: number,
    to: number,
    life: number,
    color: Rgb,
    width0: number,
    width1: number,
    alpha: number,
  ): void {
    const slot = this.cursor;
    this.cursor = (slot + 1) % this.capacity;
    const base = slot * R.STRIDE;
    const d = this.data;
    d[base + R.x] = x;
    d[base + R.y] = y;
    d[base + R.r0] = from;
    d[base + R.r1] = to;
    d[base + R.life] = life;
    d[base + R.invMaxLife] = 1 / life;
    d[base + R.red] = color[0];
    d[base + R.green] = color[1];
    d[base + R.blue] = color[2];
    d[base + R.w0] = width0;
    d[base + R.w1] = width1;
    d[base + R.alpha] = alpha;
  }

  update(dt: number): void {
    const d = this.data;
    let alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      const base = i * R.STRIDE;
      const life = d[base + R.life];
      if (life <= 0) continue;
      const left = life - dt;
      d[base + R.life] = left <= 0 ? 0 : left;
      if (left > 0) alive++;
    }
    this.aliveCount = alive;
    this.out = new Float32Array(this.capacity * RR.STRIDE);
    this.pack(this.out);
  }

  private pack(out: Float32Array): void {
    const d = this.data;
    for (let i = 0; i < this.capacity; i++) {
      const base = i * R.STRIDE;
      const outBase = i * RR.STRIDE;
      const life = d[base + R.life];
      if (life <= 0) continue; // fresh array is already zeroed
      const t = 1 - life * d[base + R.invMaxLife];
      // Ease-out expansion: fast at the front, coasting at the end.
      const eased = 1 - (1 - t) ** 2.2;
      out[outBase + RR.x] = d[base + R.x];
      out[outBase + RR.y] = d[base + R.y];
      out[outBase + RR.radius] = d[base + R.r0] + (d[base + R.r1] - d[base + R.r0]) * eased;
      out[outBase + RR.width] = Math.max(0.4, d[base + R.w0] + (d[base + R.w1] - d[base + R.w0]) * t);
      out[outBase + RR.r] = d[base + R.red];
      out[outBase + RR.g] = d[base + R.green];
      out[outBase + RR.b] = d[base + R.blue];
      out[outBase + RR.a] = d[base + R.alpha] * (1 - t) ** 1.6;
    }
  }
}
