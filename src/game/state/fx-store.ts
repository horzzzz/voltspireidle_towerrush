import { create } from 'zustand';

import type { RewardFxRequest } from '../vfx/reward-system';

export type FxAnchor = 'scrap' | 'gems';

export interface ScreenPoint {
  x: number;
  y: number;
}

interface FxStore {
  /**
   * Where the top-bar counters currently sit on screen, in dp — registered by
   * `TopBar` via `measureInWindow`, so a reward burst knows what to fly into.
   * Empty until a screen with a TopBar has laid out.
   */
  anchors: Partial<Record<FxAnchor, ScreenPoint>>;
  /** Requests waiting for the overlay's next frame. */
  queue: RewardFxRequest[];
  setAnchor: (key: FxAnchor, point: ScreenPoint) => void;
  /** Fire off a reward burst. Safe to call with no overlay mounted — it's just dropped. */
  burst: (request: RewardFxRequest) => void;
  /** Overlay-only: takes everything queued and clears it. */
  drain: () => RewardFxRequest[];
}

/**
 * The seam between "something good happened" and "something sparkles".
 *
 * Screens don't own effects: they call `burst({ kind, from, to })` with screen
 * coordinates and forget about it. A single `<RewardOverlay>` per screen tree
 * drains the queue into the shared particle pools. Keeping it a store (rather
 * than props or a context) is what lets `TopBar` publish its counter positions
 * once and every claim button anywhere aim at them.
 */
export const useFxStore = create<FxStore>((set, get) => ({
  anchors: {},
  queue: [],

  setAnchor: (key, point) => {
    const current = get().anchors[key];
    // Layout fires on every re-render; only disturb subscribers on a real move.
    if (current && Math.abs(current.x - point.x) < 1 && Math.abs(current.y - point.y) < 1) return;
    set((s) => ({ anchors: { ...s.anchors, [key]: point } }));
  },

  burst: (request) => set((s) => ({ queue: [...s.queue, request] })),

  drain: () => {
    const { queue } = get();
    if (queue.length === 0) return queue;
    set({ queue: [] });
    return queue;
  },
}));

/**
 * Anything that can report where it is on screen — every React Native host
 * component can. Typed structurally so this module stays free of RN imports.
 */
type Measurable = { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void };

/**
 * The one call a claim button needs: burst out of `node`, and — for a currency
 * — fly into that currency's top-bar counter.
 *
 * `measureInWindow` is asynchronous, so this fires on the next tick; that is
 * exactly right, since the burst should land after the press has visibly
 * registered. A missing node or a counter that hasn't laid out yet degrades to
 * a plain scatter rather than an error.
 */
export function burstFrom(node: Measurable | null | undefined, kind: RewardFxRequest['kind'], power = 1): void {
  if (!node) return;
  node.measureInWindow((x, y, width, height) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const { anchors, burst } = useFxStore.getState();
    const to = kind === 'gems' || kind === 'scrap' ? (anchors[kind] ?? null) : null;
    burst({ kind, from: { x: x + width / 2, y: y + height / 2 }, to, power });
  });
}
