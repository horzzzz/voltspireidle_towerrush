import { formatInt, formatNumber } from '../core/numbers';
import { Rng } from '../core/rng';
import type { VfxEvent } from '../core/types';
import { CHARGE_HUD_ANCHOR, SCRAP_HUD_ANCHOR, TOWER_X, TOWER_Y } from '../data/arena';
import { ADDITIVE_CAP, B, BEAM_CAP, BR, Brush, G, N, NORMAL_CAP, NR, NUMBER_CAP, RING_CAP } from './layout';
import { ParticlePool, RingPool } from './pools';
import { BOSS_ACCENT, ENEMY_ACCENT, VfxColors, type Rgb } from './palette';

/**
 * Hard ceiling on particles spawned in a single frame. A wave wiping out
 * thirty enemies at once must never be able to turn into a frame spike — it
 * just looks slightly less lavish than the same thirty kills spread out.
 */
const MAX_SPAWNS_PER_FRAME = 120;

/** Peak camera-shake offset in design px, at full trauma. */
const MAX_SHAKE = 7;

/** Damage numbers within this many design px of each other merge into one. */
const NUMBER_MERGE_RADIUS = 22;

type Ctx = {
  /** Live enemies — the main input to the automatic detail scaling. */
  enemyCount: number;
  /** Tower HP 0..1, drives the low-health vignette. */
  hpFraction: number;
};

/** Number kinds, matching the `N.kind` slot. */
const KIND_NORMAL = 0;
const KIND_CRIT = 1;
const KIND_BOSS = 2;
const KIND_TOWER = 3;

const NUMBER_COLORS: Rgb[] = [[1, 1, 1], VfxColors.crit, VfxColors.boss, VfxColors.hurt];

/** Hits read best as a hot white core cooling to the tower's own blue. */
function sparkColor(rng: Rng, isCrit: boolean): Rgb {
  if (isCrit) return VfxColors.crit;
  return rng.next() < 0.4 ? VfxColors.boltCore : VfxColors.bolt;
}

/**
 * The whole battle VFX layer: fixed particle / number / beam / ring pools,
 * advanced once per rendered frame and packed into flat `Float32Array`s that
 * Skia reads on the UI thread.
 *
 * Deliberately plain TypeScript with no React, no Skia and no Reanimated
 * imports — the same rule the sim itself follows. It owns no timers and no
 * loop; `use-battle-engine`'s existing rAF drives it, right next to the enemy
 * position packing.
 *
 * Every output buffer is double-buffered (see ParticlePool): packing
 * alternates between two pre-allocated arrays and hands out whichever was just
 * written. That gives the render layer the fresh *reference* its Reanimated
 * mappers need to re-run without allocating tens of kilobytes a frame.
 */
export class VfxSystem {
  private readonly rng: Rng;

  private readonly additive: ParticlePool;
  private readonly normal: ParticlePool;
  private readonly ringPool = new RingPool(RING_CAP);

  private readonly numbers = new Float32Array(NUMBER_CAP * N.STRIDE);
  private readonly beams = new Float32Array(BEAM_CAP * B.STRIDE);
  private numberCursor = 0;
  private beamCursor = 0;

  /**
   * Fresh every `update()` — see `ParticlePool`'s note in vfx/pools.ts on why
   * reusing a fixed pair and mutating in place silently breaks Reanimated's
   * cross-thread propagation here.
   */
  private numbersOut = new Float32Array(NUMBER_CAP * NR.STRIDE);
  private beamsOut = new Float32Array(BEAM_CAP * BR.STRIDE);
  private globalsOut = new Float32Array(G.STRIDE);

  /** One label per number slot. A fresh array is published only when a label actually changes. */
  private readonly labels: string[] = new Array(NUMBER_CAP).fill('');
  private labelsOut: string[] = new Array(NUMBER_CAP).fill('');
  private labelsDirty = false;

  private time = 0;
  private trauma = 0;
  private hurt = 0;
  private flash = 0;
  private ambientTimer = 0;
  private readonly shakeSeed: number;
  private recoilX = 0;
  private recoilY = 0;
  private bannerLife = 0;
  private bannerMaxLife = 1;
  private bannerText = '';
  private bannerColor: Rgb = VfxColors.waveScan;

  /** 1 = full detail, falls toward 0.3 as the field (or a pool) fills up. */
  private detail = 1;
  private budget = MAX_SPAWNS_PER_FRAME;

  constructor(seed = 1) {
    this.rng = new Rng(seed);
    this.shakeSeed = this.rng.range(0, 100);
    this.additive = new ParticlePool(ADDITIVE_CAP, this.rng);
    this.normal = new ParticlePool(NORMAL_CAP, this.rng);
  }

  /**
   * Advances every pool by `dt` simulated seconds and turns `events` into new
   * effects. Call once per rendered frame, before reading the buffers.
   */
  update(dt: number, events: VfxEvent[], ctx: Ctx): void {
    this.time += dt;
    this.budget = MAX_SPAWNS_PER_FRAME;

    // Automatic level of detail. Whichever is under more pressure — the field
    // or the pools themselves — decides how lavish a burst is allowed to be.
    const load = Math.max(
      ctx.enemyCount / 90,
      this.additive.alive / ADDITIVE_CAP,
      this.normal.alive / NORMAL_CAP,
    );
    this.detail = load <= 0.6 ? 1 : Math.max(0.3, 1 - (load - 0.6) * 1.6);

    for (let i = 0; i < events.length; i++) this.ingest(events[i]);

    this.ambient(dt);
    this.additive.update(dt);
    this.normal.update(dt);
    this.ringPool.update(dt);
    this.integrateNumbers(dt);
    this.integrateBeams(dt);
    this.integrateGlobals(dt, ctx);

    this.packNumbers();
    this.packBeams();
    if (this.labelsDirty) {
      this.labelsOut = this.labels.slice();
      this.labelsDirty = false;
    }
  }

  /** Fully resets every pool — used when a run restarts in place. */
  reset(): void {
    this.additive.reset();
    this.normal.reset();
    this.ringPool.reset();
    this.numbers.fill(0);
    this.beams.fill(0);
    this.labels.fill('');
    this.labelsDirty = true;
    this.trauma = 0;
    this.hurt = 0;
    this.flash = 0;
    this.recoilX = 0;
    this.recoilY = 0;
    this.bannerLife = 0;
    this.bannerText = '';
  }

  get additiveBuffer(): Float32Array {
    return this.additive.buffer;
  }
  get normalBuffer(): Float32Array {
    return this.normal.buffer;
  }
  get ringsBuffer(): Float32Array {
    return this.ringPool.buffer;
  }
  get numbersBuffer(): Float32Array {
    return this.numbersOut;
  }
  get beamsBuffer(): Float32Array {
    return this.beamsOut;
  }
  get globalsBuffer(): Float32Array {
    return this.globalsOut;
  }
  get numberLabels(): string[] {
    return this.labelsOut;
  }
  /** Current wave/boss banner caption; empty while nothing is showing. */
  get banner(): string {
    return this.bannerText;
  }

  // ---------------------------------------------------------------- events

  private ingest(event: VfxEvent): void {
    switch (event.type) {
      case 'bolt':
        this.onBolt(event.x1, event.y1, event.x2, event.y2, event.isCrit);
        break;
      case 'hit':
        this.onHit(event.x, event.y, event.dirX, event.dirY, event.radius, event.isCrit);
        break;
      case 'damage':
        this.onDamage(
          event.x,
          event.y,
          event.amount,
          event.isCrit ? KIND_CRIT : event.isBoss ? KIND_BOSS : KIND_NORMAL,
        );
        break;
      case 'kill':
        this.onKill(event);
        break;
      case 'spawn':
        // No visual on arrival — most spawns happen off-screen (past the
        // arena edge, see raySpawnPoint), so a burst there was wasted work
        // for no payoff. The enemy's own warp-in scale (enemy-buffers.ts)
        // still sells the "materializing" look once it's actually in view.
        break;
      case 'towerHit':
        this.onTowerHit(event.x, event.y, event.dirX, event.dirY, event.amount);
        break;
      case 'waveStart':
        this.onWaveStart(event.isBoss, event.wave);
        break;
      case 'upgrade':
        this.onUpgrade();
        break;
    }
  }

  private onBolt(x1: number, y1: number, x2: number, y2: number, isCrit: boolean): void {
    const slot = this.beamCursor;
    this.beamCursor = (this.beamCursor + 1) % BEAM_CAP;
    const base = slot * B.STRIDE;
    const life = isCrit ? 0.22 : 0.16;
    this.beams[base + B.x1] = x1;
    this.beams[base + B.y1] = y1;
    this.beams[base + B.x2] = x2;
    this.beams[base + B.y2] = y2;
    this.beams[base + B.life] = life;
    this.beams[base + B.invMaxLife] = 1 / life;
    this.beams[base + B.seed] = this.rng.range(1, 999);
    this.beams[base + B.crit] = isCrit ? 1 : 0;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    // The tower kicks back *against* the shot — small, but it turns a static
    // sprite into something that is visibly firing.
    this.recoilX -= (dx / len) * (isCrit ? 5 : 3.2);
    this.recoilY -= (dy / len) * (isCrit ? 5 : 3.2);

    // Muzzle flash at the barrel, impact flare where the bolt lands.
    const color = isCrit ? VfxColors.crit : VfxColors.bolt;
    this.spawn(true, x1 + (dx / len) * 14, y1 + (dy / len) * 14, 0, 0, 0.14, 30, 8, 0, color, 0.9, Brush.Glow, 0, 0);
    this.spawn(true, x2, y2, 0, 0, 0.16, isCrit ? 46 : 32, 6, 0, color, 1, Brush.Glow, 0, 0);
  }

  private onHit(x: number, y: number, dirX: number, dirY: number, radius: number, isCrit: boolean): void {
    const count = this.count(isCrit ? 11 : 7);
    for (let i = 0; i < count; i++) {
      // Spray back along the impact in a cone rather than a full circle — that
      // read of "something arrived from over there" is the whole point.
      const spread = this.rng.range(-1.05, 1.05);
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const ax = dirX * cos - dirY * sin;
      const ay = dirX * sin + dirY * cos;
      const speed = this.rng.range(55, isCrit ? 230 : 165);
      this.spawn(
        true,
        x + ax * radius * 0.35,
        y + ay * radius * 0.35,
        ax * speed,
        ay * speed,
        this.rng.range(0.16, 0.34),
        this.rng.range(5, 9),
        0.5,
        0,
        sparkColor(this.rng, isCrit),
        1,
        Brush.Spark,
        3.2,
        90,
      );
    }
    this.spawn(
      true,
      x,
      y,
      0,
      0,
      0.13,
      radius * (isCrit ? 2.1 : 1.4),
      radius * 0.4,
      0,
      isCrit ? VfxColors.crit : VfxColors.boltCore,
      0.85,
      Brush.Glow,
      0,
      0,
    );
    if (isCrit) this.trauma = Math.min(1, this.trauma + 0.12);
  }

  private onKill(event: Extract<VfxEvent, { type: 'kill' }>): void {
    const { x, y, radius, isBoss } = event;
    const accent = isBoss
      ? (BOSS_ACCENT[event.bossVariant] ?? BOSS_ACCENT[0])
      : (ENEMY_ACCENT[event.kind] ?? VfxColors.debris);
    const power = isBoss ? 3 : 1;

    // Body debris — normal blend, so a big kill doesn't blow out the scene.
    const debrisCount = this.count(11 * power);
    for (let i = 0; i < debrisCount; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(30, 120 * power);
      this.spawn(
        false,
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        this.rng.range(0.35, 0.75),
        this.rng.range(radius * 0.22, radius * 0.5),
        radius * 0.1,
        this.rng.range(-7, 7),
        this.rng.next() < 0.45 ? accent : VfxColors.debris,
        0.95,
        Brush.Smoke,
        1.9,
        160,
      );
    }

    // Bright shards on top.
    const sparkCount = this.count(7 * power);
    for (let i = 0; i < sparkCount; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(80, 260 * power);
      this.spawn(
        true,
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        this.rng.range(0.2, 0.45),
        this.rng.range(6, 11),
        0.5,
        0,
        accent,
        1,
        Brush.Spark,
        2.6,
        120,
      );
    }

    this.spawn(true, x, y, 0, 0, 0.22, radius * 2.4 * (isBoss ? 1.6 : 1), radius * 0.5, 0, accent, 0.9, Brush.Glow, 0, 0);
    this.ringPool.spawn(x, y, radius * 0.5, radius * (isBoss ? 5 : 2.8), isBoss ? 0.5 : 0.3, accent, 4, 0.6, 0.85);

    if (isBoss) {
      this.ringPool.spawn(x, y, radius * 0.8, radius * 8, 0.85, VfxColors.boltCore, 2.5, 0.4, 0.5);
      this.trauma = Math.min(1, this.trauma + 0.7);
      this.flash = Math.max(this.flash, 0.45);
    }

    // Charge and Scrap fly to the counters they are paid into, so income is
    // something the player sees happen rather than a number that ticked.
    this.reward(x, y, VfxColors.bolt, CHARGE_HUD_ANCHOR, isBoss ? 4 : 1);
    this.reward(x, y, VfxColors.scrap, SCRAP_HUD_ANCHOR, isBoss ? 3 : 1);

    if (event.dropsGem) {
      const gemCount = this.count(9);
      for (let i = 0; i < gemCount; i++) {
        const angle = this.rng.range(0, Math.PI * 2);
        const speed = this.rng.range(40, 150);
        this.spawn(
          true,
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          this.rng.range(0.4, 0.8),
          this.rng.range(8, 14),
          2,
          this.rng.range(-4, 4),
          VfxColors.gem,
          1,
          Brush.Star,
          2.2,
          -40,
        );
      }
      this.ringPool.spawn(x, y, 4, radius * 3.4, 0.5, VfxColors.gem, 3, 0.4, 0.9);
    }
  }

  private onTowerHit(x: number, y: number, dirX: number, dirY: number, amount: number): void {
    if (amount <= 0) return;
    // Sparks fly off the tower's shell, at the point the attacker is pressing on.
    const px = x + dirX * 26;
    const py = y + dirY * 26;
    const count = this.count(6);
    for (let i = 0; i < count; i++) {
      const spread = this.rng.range(-1.3, 1.3);
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const ax = -dirX * cos + dirY * sin;
      const ay = -dirX * sin - dirY * cos;
      const speed = this.rng.range(50, 150);
      this.spawn(
        true,
        px,
        py,
        ax * speed,
        ay * speed,
        this.rng.range(0.16, 0.32),
        this.rng.range(4, 8),
        0.5,
        0,
        VfxColors.hurt,
        1,
        Brush.Spark,
        3,
        130,
      );
    }
    this.spawn(true, px, py, 0, 0, 0.15, 26, 6, 0, VfxColors.hurt, 0.85, Brush.Glow, 0, 0);
    this.onDamage(px, py, amount, KIND_TOWER);
    this.hurt = Math.min(1, this.hurt + 0.4);
    this.trauma = Math.min(1, this.trauma + 0.22);
  }

  private onWaveStart(isBoss: boolean, wave: number): void {
    this.ringPool.spawn(
      TOWER_X,
      TOWER_Y,
      20,
      560,
      isBoss ? 1 : 0.85,
      isBoss ? VfxColors.boss : VfxColors.waveScan,
      5,
      1,
      0.5,
    );
    this.bannerText = isBoss ? `BOSS · WAVE ${wave}` : `WAVE ${wave}`;
    this.bannerColor = isBoss ? VfxColors.boss : VfxColors.waveScan;
    this.bannerLife = isBoss ? 2.2 : 1.5;
    this.bannerMaxLife = this.bannerLife;
    if (isBoss) {
      this.ringPool.spawn(TOWER_X, TOWER_Y, 20, 380, 0.7, VfxColors.boss, 3, 0.8, 0.45);
      this.hurt = Math.min(1, this.hurt + 0.65);
      this.trauma = Math.min(1, this.trauma + 0.3);
    }
  }

  private onUpgrade(): void {
    this.ringPool.spawn(TOWER_X, TOWER_Y, 24, 120, 0.45, VfxColors.upgrade, 4, 0.8, 0.85);
    const count = this.count(12);
    for (let i = 0; i < count; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      this.spawn(
        true,
        TOWER_X + Math.cos(angle) * 22,
        TOWER_Y + Math.sin(angle) * 22,
        Math.cos(angle) * 40,
        this.rng.range(-150, -70),
        this.rng.range(0.4, 0.8),
        this.rng.range(6, 11),
        1,
        this.rng.range(-5, 5),
        VfxColors.upgrade,
        1,
        Brush.Star,
        1.2,
        60,
      );
    }
  }

  /**
   * Floating damage number. Hits landing on the same body within
   * NUMBER_MERGE_RADIUS fold into the live number instead of stacking a second
   * one on top of it — that is both what keeps a 100-enemy field readable and
   * what stops the pool churning at high attack speed.
   */
  private onDamage(x: number, y: number, amount: number, kind: number): void {
    for (let i = 0; i < NUMBER_CAP; i++) {
      const base = i * N.STRIDE;
      if (this.numbers[base + N.life] <= 0) continue;
      if (this.numbers[base + N.kind] !== kind) continue;
      if (Math.abs(this.numbers[base + N.x] - x) > NUMBER_MERGE_RADIUS) continue;
      if (Math.abs(this.numbers[base + N.y] - y) > NUMBER_MERGE_RADIUS) continue;

      this.numbers[base + N.amount] += amount;
      // Refresh the tail of its life so a merged number never blinks out
      // mid-combo, but don't restart the rise — it would visibly jerk.
      this.numbers[base + N.life] = Math.max(this.numbers[base + N.life], 0.55);
      this.setLabel(i, this.numbers[base + N.amount], kind);
      return;
    }

    const slot = this.numberCursor;
    this.numberCursor = (this.numberCursor + 1) % NUMBER_CAP;
    const base = slot * N.STRIDE;
    const life = kind === KIND_CRIT ? 1 : 0.8;
    this.numbers[base + N.x] = x + this.rng.range(-7, 7);
    this.numbers[base + N.y] = y - 6;
    this.numbers[base + N.vx] = this.rng.range(-14, 14);
    this.numbers[base + N.vy] = kind === KIND_CRIT ? -74 : -58;
    this.numbers[base + N.life] = life;
    this.numbers[base + N.invMaxLife] = 1 / life;
    this.numbers[base + N.amount] = amount;
    this.numbers[base + N.kind] = kind;
    this.setLabel(slot, amount, kind);
  }

  // ------------------------------------------------------------ integration

  private integrateNumbers(dt: number): void {
    for (let i = 0; i < NUMBER_CAP; i++) {
      const base = i * N.STRIDE;
      const life = this.numbers[base + N.life];
      if (life <= 0) continue;
      const left = life - dt;
      if (left <= 0) {
        this.numbers[base + N.life] = 0;
        this.setLabelText(i, '');
        continue;
      }
      this.numbers[base + N.life] = left;
      // Rises fast, then eases out — the arc reads as "thrown off the body".
      this.numbers[base + N.vy] *= Math.max(0, 1 - 1.7 * dt);
      this.numbers[base + N.x] += this.numbers[base + N.vx] * dt;
      this.numbers[base + N.y] += this.numbers[base + N.vy] * dt;
    }
  }

  private integrateBeams(dt: number): void {
    for (let i = 0; i < BEAM_CAP; i++) {
      const base = i * B.STRIDE;
      const life = this.beams[base + B.life];
      if (life <= 0) continue;
      this.beams[base + B.life] = life - dt <= 0 ? 0 : life - dt;
    }
  }

  private integrateGlobals(dt: number, ctx: Ctx): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    this.hurt = Math.max(0, this.hurt - dt * 2.1);
    this.flash = Math.max(0, this.flash - dt * 5.5);

    const shake = this.trauma * this.trauma * MAX_SHAKE;
    this.globalsOut = new Float32Array(G.STRIDE);
    const out = this.globalsOut;
    out[G.shakeX] = shake * Math.sin(this.time * 43 + this.shakeSeed);
    out[G.shakeY] = shake * Math.sin(this.time * 37.3 + this.shakeSeed * 1.7);

    // Below a quarter HP the frame breathes red on its own, so the player
    // feels the run slipping without having to read the ring.
    const lowHp =
      ctx.hpFraction < 0.25 && ctx.hpFraction > 0
        ? (1 - ctx.hpFraction / 0.25) * (0.3 + 0.12 * Math.sin(this.time * 4.5))
        : 0;
    out[G.vignette] = Math.min(1, this.hurt + lowHp);
    out[G.vignetteR] = VfxColors.hurt[0];
    out[G.vignetteG] = VfxColors.hurt[1];
    out[G.vignetteB] = VfxColors.hurt[2];
    out[G.flash] = this.flash;
    out[G.hurt] = this.hurt;

    // Recoil springs back rather than decaying, so rapid fire reads as a
    // rhythm instead of the tower drifting off its footing.
    this.recoilX -= this.recoilX * Math.min(1, 16 * dt);
    this.recoilY -= this.recoilY * Math.min(1, 16 * dt);
    out[G.recoilX] = this.recoilX;
    out[G.recoilY] = this.recoilY;

    this.bannerLife = Math.max(0, this.bannerLife - dt);
    if (this.bannerLife <= 0) {
      out[G.bannerAlpha] = 0;
      out[G.bannerScale] = 0;
      this.bannerText = '';
    } else {
      const t = 1 - this.bannerLife / this.bannerMaxLife;
      // Slams in, holds, then dissolves over the last quarter of its life.
      const fadeIn = Math.min(1, t / 0.1);
      const fadeOut = t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1;
      out[G.bannerAlpha] = 0.95 * fadeIn * fadeOut;
      out[G.bannerScale] = 1 + 0.45 * (1 - Math.min(1, t / 0.18));
      out[G.bannerR] = this.bannerColor[0];
      out[G.bannerG] = this.bannerColor[1];
      out[G.bannerB] = this.bannerColor[2];
    }
  }

  /** Slow motes drifting around the tower, so an idle field is never dead still. */
  private ambient(dt: number): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 0.4;
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(40, 150);
    this.spawn(
      true,
      TOWER_X + Math.cos(angle) * dist,
      TOWER_Y + Math.sin(angle) * dist,
      this.rng.range(-9, 9),
      this.rng.range(-22, -6),
      this.rng.range(1.6, 3),
      this.rng.range(2, 4),
      0.5,
      0,
      VfxColors.bolt,
      0.32,
      Brush.Glow,
      0,
      0,
    );
  }

  // ---------------------------------------------------------------- packing

  private packNumbers(): void {
    this.numbersOut = new Float32Array(NUMBER_CAP * NR.STRIDE);
    const out = this.numbersOut;
    for (let i = 0; i < NUMBER_CAP; i++) {
      const base = i * N.STRIDE;
      const outBase = i * NR.STRIDE;
      const life = this.numbers[base + N.life];
      if (life <= 0) {
        out[outBase + NR.a] = 0;
        out[outBase + NR.scale] = 0;
        continue;
      }
      const t = 1 - life * this.numbers[base + N.invMaxLife];
      const kind = this.numbers[base + N.kind];
      const color = NUMBER_COLORS[kind] ?? NUMBER_COLORS[0];
      const peak = kind === KIND_CRIT ? 1.75 : 1.25;
      // Overshoot on birth, settle, then shrink slightly as it fades.
      const scale = t < 0.16 ? peak - (peak - 1) * (t / 0.16) : 1 - 0.18 * ((t - 0.16) / 0.84);

      out[outBase + NR.x] = this.numbers[base + N.x];
      out[outBase + NR.y] = this.numbers[base + N.y];
      out[outBase + NR.scale] = scale * (kind === KIND_CRIT ? 1.35 : 1);
      out[outBase + NR.a] = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
      out[outBase + NR.r] = color[0];
      out[outBase + NR.g] = color[1];
      out[outBase + NR.b] = color[2];
    }
  }

  private packBeams(): void {
    this.beamsOut = new Float32Array(BEAM_CAP * BR.STRIDE);
    const out = this.beamsOut;
    for (let i = 0; i < BEAM_CAP; i++) {
      const base = i * B.STRIDE;
      const outBase = i * BR.STRIDE;
      const life = this.beams[base + B.life];
      if (life <= 0) {
        out[outBase + BR.a] = 0;
        continue;
      }
      const t = 1 - life * this.beams[base + B.invMaxLife];
      out[outBase + BR.x1] = this.beams[base + B.x1];
      out[outBase + BR.y1] = this.beams[base + B.y1];
      out[outBase + BR.x2] = this.beams[base + B.x2];
      out[outBase + BR.y2] = this.beams[base + B.y2];
      out[outBase + BR.t] = t;
      out[outBase + BR.seed] = this.beams[base + B.seed];
      out[outBase + BR.crit] = this.beams[base + B.crit];
      out[outBase + BR.a] = (1 - t) ** 1.4;
    }
  }

  // ----------------------------------------------------------------- spawns

  private count(base: number): number {
    return Math.max(1, Math.round(base * this.detail));
  }

  /**
   * A few motes that scatter off a kill and then curve into a HUD counter.
   * `count` is pre-LOD; a crowded field naturally thins these out too.
   */
  private reward(x: number, y: number, color: Rgb, anchor: { x: number; y: number }, count: number): void {
    const n = this.count(count);
    for (let i = 0; i < n; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(50, 120);
      this.spawn(
        true,
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        this.rng.range(0.55, 0.8),
        this.rng.range(5, 8),
        1.5,
        0,
        color,
        0.95,
        Brush.Glow,
        1.4,
        0,
        anchor.x,
        anchor.y,
        1900,
      );
    }
  }

  /** Budget-checked wrapper around the pools' own `spawn`. */
  private spawn(
    additive: boolean,
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
    if (this.budget <= 0) return;
    this.budget--;
    const pool = additive ? this.additive : this.normal;
    pool.spawn(x, y, vx, vy, life, size0, size1, rotVel, color, alpha, brush, drag, gravity, homeX, homeY, homing);
  }

  private setLabel(slot: number, amount: number, kind: number): void {
    // Contact damage against the tower is small (armor/deflection eat most of
    // it on early waves) and often lands under 1 — `formatInt` would just
    // show "0" for every hit and read as broken. The tower's own number gets
    // one decimal place instead; every other kind keeps the terser integer.
    if (kind === KIND_TOWER) {
      this.setLabelText(slot, amount.toFixed(1));
      return;
    }
    this.setLabelText(slot, amount < 1000 ? formatInt(amount) : formatNumber(amount, 1));
  }

  private setLabelText(slot: number, text: string): void {
    if (this.labels[slot] === text) return;
    this.labels[slot] = text;
    this.labelsDirty = true;
  }
}
