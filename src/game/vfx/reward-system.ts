import { Rng } from '../core/rng';
import { Brush, UG, UI_ADDITIVE_CAP, UI_NORMAL_CAP, UI_RING_CAP } from './layout';
import { ParticlePool, RingPool } from './pools';
import { VfxColors, type Rgb } from './palette';

/** What a burst is paying out — picks its palette and its personality. */
export type RewardFxKind = 'gems' | 'scrap' | 'charge' | 'fail' | 'levelUp' | 'jackpot';

export interface RewardFxRequest {
  kind: RewardFxKind;
  /** Screen point (dp) the burst comes from — usually the card that was tapped. */
  from: { x: number; y: number };
  /** Counter the motes fly into. Omit and they simply scatter and fade. */
  to?: { x: number; y: number } | null;
  /** 1 = an ordinary claim. Above that the burst scales up. */
  power?: number;
}

const KIND_COLORS: Record<RewardFxKind, Rgb> = {
  gems: VfxColors.gem,
  scrap: VfxColors.scrap,
  charge: VfxColors.bolt,
  fail: [0.55, 0.55, 0.58],
  levelUp: VfxColors.upgrade,
  jackpot: VfxColors.crit,
};

/**
 * The menus' reward effects: the burst when a daily/milestone/mission/shop
 * reward is claimed, and the wheel's win, loss and free-spin reactions.
 *
 * Same pools, same procedural brushes and the same single-draw-call atlas as
 * the battle scene (vfx/pools.ts) — only the coordinate space differs: this
 * one works in screen dp, because it draws over React Native layout rather
 * than inside the arena's fixed 430×932 design space.
 *
 * Idle is genuinely idle: `alive` goes to zero and the overlay stops its rAF
 * entirely, so sitting on a menu costs nothing.
 */
export class RewardFxSystem {
  private readonly rng = new Rng(0x5eed);
  private readonly additive: ParticlePool;
  private readonly normal: ParticlePool;
  private readonly rings = new RingPool(UI_RING_CAP);

  private readonly globalsOut = [new Float32Array(UG.STRIDE), new Float32Array(UG.STRIDE)];
  private flip = 0;

  private raysLife = 0;
  private raysMaxLife = 1;
  private raysX = 0;
  private raysY = 0;
  private raysRadius = 0;
  private raysRotation = 0;
  private raysColor: Rgb = VfxColors.crit;
  private flashLife = 0;
  private flashColor: Rgb = VfxColors.crit;

  constructor() {
    this.additive = new ParticlePool(UI_ADDITIVE_CAP, this.rng);
    this.normal = new ParticlePool(UI_NORMAL_CAP, this.rng);
  }

  /** True while anything is still on screen — the overlay's rAF stops at false. */
  get busy(): boolean {
    return this.additive.alive > 0 || this.normal.alive > 0 || this.rings.alive > 0 || this.raysLife > 0 || this.flashLife > 0;
  }

  get additiveBuffer(): Float32Array {
    return this.additive.buffer;
  }
  get normalBuffer(): Float32Array {
    return this.normal.buffer;
  }
  get ringsBuffer(): Float32Array {
    return this.rings.buffer;
  }
  get globalsBuffer(): Float32Array {
    return this.globalsOut[this.flip];
  }

  reset(): void {
    this.additive.reset();
    this.normal.reset();
    this.rings.reset();
    this.raysLife = 0;
    this.flashLife = 0;
  }

  burst(request: RewardFxRequest): void {
    const power = request.power ?? 1;
    const { x, y } = request.from;
    const color = KIND_COLORS[request.kind];

    if (request.kind === 'fail') {
      this.onFail(x, y);
      return;
    }

    const isJackpot = request.kind === 'jackpot';
    this.rings.spawn(x, y, 6, 90 * power, 0.5, color, 5, 0.8, 0.9);
    if (isJackpot || power > 1.5) {
      this.rings.spawn(x, y, 6, 190 * power, 0.85, VfxColors.boltCore, 3, 0.4, 0.55);
      this.rays(x, y, color, 240 * power, 1.4);
      this.flashLife = 0.35;
      this.flashColor = color;
    }

    // The motes: a scatter that curves into the counter, or just a scatter.
    const target = request.to ?? null;
    const count = Math.round((isJackpot ? 34 : 18) * power);
    for (let i = 0; i < count; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(90, 320 * power);
      this.additive.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        target ? this.rng.range(0.7, 1.05) : this.rng.range(0.5, 0.9),
        this.rng.range(9, 17),
        target ? 3 : 1,
        this.rng.range(-4, 4),
        this.rng.next() < 0.25 ? VfxColors.boltCore : color,
        1,
        this.rng.next() < 0.6 ? Brush.Star : Brush.Glow,
        target ? 1.6 : 2.4,
        target ? 0 : 260,
        target?.x ?? 0,
        target?.y ?? 0,
        target ? 2600 : 0,
      );
    }
  }

  /** A dud: no light, just a grey puff sagging downward. */
  private onFail(x: number, y: number): void {
    this.rings.spawn(x, y, 8, 70, 0.55, KIND_COLORS.fail, 3, 0.5, 0.4);
    for (let i = 0; i < 14; i++) {
      const angle = this.rng.range(Math.PI * 0.15, Math.PI * 0.85);
      const speed = this.rng.range(30, 110);
      this.normal.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.5,
        this.rng.range(0.5, 0.95),
        this.rng.range(14, 26),
        6,
        this.rng.range(-2, 2),
        KIND_COLORS.fail,
        0.7,
        Brush.Smoke,
        1.6,
        180,
      );
    }
  }

  /** A fan of rotating light wedges — the wheel's "you actually won" moment. */
  rays(x: number, y: number, color: Rgb, radius: number, life: number): void {
    this.raysX = x;
    this.raysY = y;
    this.raysRadius = radius;
    this.raysColor = color;
    this.raysLife = life;
    this.raysMaxLife = life;
  }

  update(dt: number): void {
    this.flip ^= 1;
    this.additive.update(dt);
    this.normal.update(dt);
    this.rings.update(dt);

    const out = this.globalsOut[this.flip];
    this.raysRotation += dt * 0.55;
    this.raysLife = Math.max(0, this.raysLife - dt);
    if (this.raysLife <= 0) {
      out[UG.raysAlpha] = 0;
    } else {
      const t = 1 - this.raysLife / this.raysMaxLife;
      out[UG.raysX] = this.raysX;
      out[UG.raysY] = this.raysY;
      out[UG.raysRadius] = this.raysRadius * (0.55 + 0.45 * Math.min(1, t / 0.25));
      out[UG.raysRotation] = this.raysRotation;
      out[UG.raysAlpha] = 0.32 * Math.min(1, t / 0.12) * (1 - t) ** 1.2;
      out[UG.raysR] = this.raysColor[0];
      out[UG.raysG] = this.raysColor[1];
      out[UG.raysB] = this.raysColor[2];
    }

    this.flashLife = Math.max(0, this.flashLife - dt);
    out[UG.flash] = this.flashLife * 0.9;
    out[UG.flashR] = this.flashColor[0];
    out[UG.flashG] = this.flashColor[1];
    out[UG.flashB] = this.flashColor[2];
  }
}
