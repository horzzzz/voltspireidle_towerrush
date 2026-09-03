/**
 * One `Float32Array` per frame, carrying every section the render layer reads,
 * sized to what is *actually alive* rather than to pool capacity.
 *
 * Why this shape exists — measured, not guessed. Publishing a `Float32Array`
 * to a shared value copies it twice: `SerializableArrayBuffer` memcpy's the
 * bytes into a C++ vector on the JS thread, and `toJSValue` allocates a brand
 * new `ArrayBuffer` on the UI runtime and memcpy's into that (see
 * `node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/Serializable.cpp`).
 * Reusing one array and mutating it in place cannot work: the serializable is
 * cached by the array's object identity, so the UI thread would keep seeing
 * the bytes captured at the first assignment.
 *
 * So a fresh array per frame is unavoidable — but its *size* is not. The
 * previous scheme published ten fixed-capacity buffers (~30KB) every frame no
 * matter how empty the field was, and profiling on device showed the JS heap
 * growing at exactly that rate (~1.6MB/s) until Hermes ran a full collection
 * that stopped the JS thread for 100–250ms, roughly every ten seconds. That
 * pause was the micro-freeze.
 *
 * Packing only live entries into one exactly-sized array turns a constant
 * ~30KB/frame into a few hundred bytes on a calm field and a few KB at full
 * tilt, and collapses ten cross-thread publishes into one.
 *
 * ## Layout
 *
 * ```
 * [0 .. sectionCount*2-1]  (offset, count) pair per section
 * [sectionCount*2 .. ]     section payloads, in section order
 * ```
 *
 * Globals are just section 0 with a count of 1, so the readers need one rule
 * rather than two.
 */

/** Battle scene sections. Order here is the order payloads are laid out in. */
export const BSec = {
  globals: 0,
  scavenger: 1,
  hulk: 2,
  runner: 3,
  boss0: 4,
  boss1: 5,
  boss2: 6,
  additive: 7,
  normal: 8,
  numbers: 9,
  beams: 10,
  rings: 11,
} as const;
export const BSEC_COUNT = 12;

/** Menu reward-overlay sections (components/fx/reward-overlay.tsx). */
export const USec = {
  globals: 0,
  additive: 1,
  normal: 2,
  rings: 3,
} as const;
export const USEC_COUNT = 4;

/** Float index of a section's first element. */
export function secOffset(data: Float32Array, section: number): number {
  'worklet';
  return data[section * 2];
}

/** How many live entries that section holds this frame. */
export function secCount(data: Float32Array, section: number): number {
  'worklet';
  return data[section * 2 + 1];
}

/**
 * Allocates the frame's buffer and writes its header. `counts[i]` entries of
 * `strides[i]` floats each, in section order.
 *
 * Takes preallocated arrays rather than an object literal or a varargs list:
 * this runs 60 times a second, and a helper that allocates to describe an
 * allocation would defeat its own purpose.
 */
export function buildFrame(counts: Int32Array, strides: Int32Array, sectionCount: number): Float32Array {
  let total = sectionCount * 2;
  for (let i = 0; i < sectionCount; i++) total += counts[i] * strides[i];

  const out = new Float32Array(total);
  let offset = sectionCount * 2;
  for (let i = 0; i < sectionCount; i++) {
    out[i * 2] = offset;
    out[i * 2 + 1] = counts[i];
    offset += counts[i] * strides[i];
  }
  return out;
}
