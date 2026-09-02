/**
 * Deterministic PRNG (mulberry32) seeded per run, so a run's wave composition
 * is reproducible for debugging even though it looks random in play.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // mulberry32 misbehaves on a zero seed; nudge it off zero.
    this.state = (seed >>> 0) || 1;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number {
    return Math.floor(this.range(min, maxExclusive));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length)];
  }

  /** Weighted-random key from a `{key: weight}` map. Weights need not sum to 1. */
  weighted<K extends string>(weights: Record<K, number>): K {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.next() * total;
    for (const [key, w] of entries) {
      if (roll < w) return key;
      roll -= w;
    }
    return entries[entries.length - 1][0];
  }
}
