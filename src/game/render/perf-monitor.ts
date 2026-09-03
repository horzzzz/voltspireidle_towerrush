import { useEffect, useMemo } from 'react';
import { runOnUI, useFrameCallback } from 'react-native-reanimated';

/**
 * `__DEV__`-only battle profiling. Three things live here, and all three exist
 * to answer one question: are the periodic micro-freezes GC pauses, and if so
 * on which of the two Hermes heaps (the JS runtime or the UI/worklet one)?
 *
 * 1. `FrameProfiler` — long-frame detection on the JS thread, with the sim /
 *    vfx / pack / publish split for the specific frame that ran long. The old
 *    `[vfx-perf]` logger averaged over two seconds, which is exactly the shape
 *    that hides a 120ms spike among 120 good frames.
 * 2. `useUiFrameMonitor` — the same detection on the UI thread via
 *    Reanimated's `useFrameCallback`. A stall visible there but not on the JS
 *    side is Skia/render work, not simulation work.
 * 3. `readGcStats` — Hermes' own GC counters, sampled on both runtimes. If a
 *    long frame lands on the same tick as a jump in `numGCs`/`gcTime`, the
 *    diagnosis stops being a guess.
 *
 * Nothing in here allocates per frame — a profiler that produces garbage
 * cannot measure a garbage problem.
 */

/**
 * Bisection switches. Flip one, rebuild, and see which layer the freezes
 * follow. They are plain module constants rather than UI state on purpose:
 * toggling a layer at runtime would remount Skia nodes and muddy the very
 * measurement they exist to take.
 */
export const PerfFlags: {
  enabled: boolean;
  vfxSystem: boolean;
  particles: boolean;
  vfxPicture: boolean;
} = {
  /** Master switch for every logger below. */
  enabled: __DEV__,
  /** false: VfxSystem.update() is skipped entirely (no particles, no numbers, no rings). */
  vfxSystem: true,
  /** false: the two particle `<Atlas>` layers are not published or drawn. */
  particles: true,
  /** false: the procedural `<Picture>` layer (bolts, rings, numbers, banner, vignette) is not drawn. */
  vfxPicture: true,
};

/** A frame at or above this is a visible hitch at 60Hz (two dropped frames). */
const LONG_FRAME_MS = 32;
/** How often the rolling summary prints. */
const SUMMARY_INTERVAL_MS = 5000;

// ---------------------------------------------------------------- GC stats

export type GcStats = {
  numGCs: number;
  /** Seconds of CPU spent in GC since process start, as Hermes reports it. */
  gcTime: number;
  /** Bytes allocated since process start. */
  allocated: number;
};

/**
 * Hermes exposes cumulative GC counters through `HermesInternal`. The exact
 * key set has changed across Hermes versions, so every field is probed rather
 * than assumed, and a runtime without the API just reports nothing instead of
 * throwing. Safe to call from a worklet: the UI runtime is Hermes too.
 */
export function readGcStats(): GcStats | null {
  'worklet';
  const hermes = (globalThis as Record<string, any>).HermesInternal;
  const stats = hermes?.getInstrumentedStats?.();
  if (!stats) return null;
  return {
    numGCs: stats.js_numGCs ?? stats.js_numCollections ?? 0,
    gcTime: stats.js_gcCPUTime ?? stats.js_gcTime ?? 0,
    allocated: stats.js_allocatedBytes ?? stats.js_totalAllocatedBytes ?? 0,
  };
}

/** One-shot dump of every key Hermes actually offers, so the field probing above can be corrected if needed. */
export function logGcStatKeys(tag: string): void {
  'worklet';
  const hermes = (globalThis as Record<string, any>).HermesInternal;
  const stats = hermes?.getInstrumentedStats?.();
  if (!stats) {
    console.log(`[perf/${tag}] HermesInternal.getInstrumentedStats() unavailable — GC counters off`);
    return;
  }
  const keys = Object.keys(stats).filter((k) => k.startsWith('js_'));
  console.log(`[perf/${tag}] hermes stats keys: ${keys.join(', ')}`);
}

// ------------------------------------------------------- JS-thread profiler

/**
 * Fixed histogram buckets, in ms. Counting into buckets (rather than keeping
 * samples and sorting for a percentile) is what keeps this allocation-free.
 */
const BUCKET_EDGES = [17, 25, 33, 50, 100] as const;
const BUCKET_LABELS = ['<17', '<25', '<33', '<50', '<100', '100+'] as const;

export class FrameProfiler {
  private readonly tag: string;
  private readonly buckets = new Float64Array(BUCKET_LABELS.length);
  private lastFrame = 0;
  private lastSummary = 0;
  private frames = 0;
  private longFrames = 0;
  private maxDelta = 0;
  private publishedFloats = 0;
  private gcPrev: GcStats | null = null;
  private started = false;

  constructor(tag: string) {
    this.tag = tag;
  }

  /**
   * Records one frame. Every argument is a primitive on purpose — an options
   * object here would allocate 60 times a second inside the profiler itself.
   *
   * `now` is the rAF timestamp; the four timings are the milliseconds that
   * frame spent in each stage.
   */
  record(
    now: number,
    sim: number,
    vfx: number,
    pack: number,
    publish: number,
    frameFloats: number,
    enemies: number,
    wave: number,
    wavePhase: string,
    phaseTimeLeft: number,
  ): void {
    if (!PerfFlags.enabled) return;

    if (!this.started) {
      this.started = true;
      logGcStatKeys(this.tag);
      this.gcPrev = readGcStats();
      this.lastSummary = now;
      this.lastFrame = now;
      return;
    }

    const delta = now - this.lastFrame;
    this.lastFrame = now;
    this.frames++;
    this.publishedFloats += frameFloats;

    let bucket: number = BUCKET_EDGES.length;
    for (let i = 0; i < BUCKET_EDGES.length; i++) {
      if (delta < BUCKET_EDGES[i]) {
        bucket = i;
        break;
      }
    }
    this.buckets[bucket]++;
    if (delta > this.maxDelta) this.maxDelta = delta;

    if (delta >= LONG_FRAME_MS) {
      this.longFrames++;
      const work = sim + vfx + pack + publish;
      // `work` far below `delta` means the frame was stalled by something
      // outside this loop — GC, another thread, or the bridge — rather than
      // by the sim itself. That gap is the single most diagnostic number here.
      console.log(
        `[perf/${this.tag}] LONG ${delta.toFixed(1)}ms  work ${work.toFixed(1)}ms  ` +
          `(sim ${sim.toFixed(2)} vfx ${vfx.toFixed(2)} pack ${pack.toFixed(2)} publish ${publish.toFixed(2)})  ` +
          `unaccounted ${(delta - work).toFixed(1)}ms  ` +
          `enemies ${enemies}  wave ${wave} ${wavePhase} t-${phaseTimeLeft.toFixed(1)}s`,
      );
    }

    if (now - this.lastSummary >= SUMMARY_INTERVAL_MS) {
      this.summarize(now);
    }
  }

  private summarize(now: number): void {
    const seconds = (now - this.lastSummary) / 1000;
    let hist = '';
    for (let i = 0; i < BUCKET_LABELS.length; i++) {
      if (this.buckets[i] > 0) hist += `${BUCKET_LABELS[i]}:${this.buckets[i]} `;
    }

    const gc = readGcStats();
    let gcLine = 'gc n/a';
    if (gc && this.gcPrev) {
      const dGc = gc.numGCs - this.gcPrev.numGCs;
      const dTime = (gc.gcTime - this.gcPrev.gcTime) * 1000;
      const dAlloc = (gc.allocated - this.gcPrev.allocated) / 1048576;
      gcLine = `gc ${dGc}x ${dTime.toFixed(1)}ms  alloc ${dAlloc.toFixed(1)}MB (${(dAlloc / seconds).toFixed(1)}MB/s)`;
    }
    if (gc) this.gcPrev = gc;

    // Bytes actually published per frame — the number the whole frame-buffer
    // design exists to keep down (see vfx/frame-buffer.ts).
    const bytesPerFrame = this.frames > 0 ? (this.publishedFloats * 4) / this.frames : 0;

    console.log(
      `[perf/${this.tag}] ${seconds.toFixed(1)}s  fps~${(this.frames / seconds).toFixed(0)}  ` +
        `long ${this.longFrames}  max ${this.maxDelta.toFixed(1)}ms  pub ${(bytesPerFrame / 1024).toFixed(2)}KB/f  ` +
        `${hist} ${gcLine}`,
    );

    this.buckets.fill(0);
    this.publishedFloats = 0;
    this.frames = 0;
    this.longFrames = 0;
    this.maxDelta = 0;
    this.lastSummary = now;
  }
}

/** One profiler per battle screen. No-op object when profiling is off. */
export function useFrameProfiler(tag: string): FrameProfiler {
  return useMemo(() => new FrameProfiler(tag), [tag]);
}

// ------------------------------------------------------- UI-thread profiler

/**
 * The UI thread's own frame cadence, measured where it actually happens.
 *
 * `useFrameCallback` runs its worklet on the UI runtime once per rendered
 * frame, so `timeSincePreviousFrame` is the real interval between composited
 * frames — including any time the UI thread spent in Skia, in its own GC, or
 * waiting on the GPU. A stall that shows up here and *not* in `FrameProfiler`
 * is not a simulation problem.
 *
 * Counters hang off the UI runtime's own `globalThis` rather than off a
 * shared value or the worklet's closure: a worklet closure is captured by
 * value (plain `let`s outside it would reset every frame), and reading an
 * object back out of a shared value is not guaranteed to hand back the same
 * instance to mutate. A global on the UI runtime simply persists.
 */
const UI_STATE_KEY = '__voltspirePerfUi';

type UiPerfState = {
  frames: number;
  longFrames: number;
  maxDelta: number;
  lastSummary: number;
  elapsed: number;
  gcNum: number;
  gcTime: number;
  gcAlloc: number;
};

function uiPerfState(): UiPerfState {
  'worklet';
  const g = globalThis as Record<string, any>;
  let s: UiPerfState | undefined = g[UI_STATE_KEY];
  if (!s) {
    s = { frames: 0, longFrames: 0, maxDelta: 0, lastSummary: 0, elapsed: 0, gcNum: -1, gcTime: 0, gcAlloc: 0 };
    g[UI_STATE_KEY] = s;
  }
  return s;
}

export function useUiFrameMonitor(tag: string): void {
  const frameCallback = useFrameCallback((info) => {
    'worklet';
    if (!PerfFlags.enabled) return;
    const delta = info.timeSincePreviousFrame;
    if (delta == null) return;

    const s = uiPerfState();
    s.frames++;
    s.elapsed += delta;
    if (delta > s.maxDelta) s.maxDelta = delta;
    if (delta >= LONG_FRAME_MS) {
      s.longFrames++;
      console.log(`[perf/${tag}-ui] LONG ${delta.toFixed(1)}ms`);
    }

    if (s.elapsed - s.lastSummary >= SUMMARY_INTERVAL_MS) {
      const seconds = (s.elapsed - s.lastSummary) / 1000;
      const gc = readGcStats();
      let gcLine = 'gc n/a';
      if (gc) {
        if (s.gcNum >= 0) {
          const dTime = (gc.gcTime - s.gcTime) * 1000;
          const dAlloc = (gc.allocated - s.gcAlloc) / 1048576;
          gcLine = `gc ${gc.numGCs - s.gcNum}x ${dTime.toFixed(1)}ms  alloc ${dAlloc.toFixed(1)}MB (${(dAlloc / seconds).toFixed(1)}MB/s)`;
        }
        s.gcNum = gc.numGCs;
        s.gcTime = gc.gcTime;
        s.gcAlloc = gc.allocated;
      }
      console.log(
        `[perf/${tag}-ui] ${seconds.toFixed(1)}s  fps~${(s.frames / seconds).toFixed(0)}  ` +
          `long ${s.longFrames}  max ${s.maxDelta.toFixed(1)}ms  ${gcLine}`,
      );
      s.frames = 0;
      s.longFrames = 0;
      s.maxDelta = 0;
      s.lastSummary = s.elapsed;
    }
  }, false);

  useEffect(() => {
    if (!PerfFlags.enabled) return;
    // Clear last battle's counters so a second run doesn't report a summary
    // window that spans the menu in between.
    runOnUI(() => {
      'worklet';
      delete (globalThis as Record<string, any>)[UI_STATE_KEY];
      logGcStatKeys('ui');
    })();
    frameCallback.setActive(true);
    return () => frameCallback.setActive(false);
  }, [frameCallback]);
}

// ---------------------------------------------------------- one-off events

/**
 * Marks a discrete, suspicious event (a texture rebake, a wave transition) on
 * the same timeline as the frame logs, so a long frame can be read against
 * what happened next to it.
 */
export function perfEvent(tag: string, message: string): void {
  if (!PerfFlags.enabled) return;
  console.log(`[perf/${tag}] @${performance.now().toFixed(0)} ${message}`);
}
