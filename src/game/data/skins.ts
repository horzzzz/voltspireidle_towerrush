/**
 * Tower skins (Figma "Skins" grid, node 106:1100). Twelve alternate tower
 * arts, each gated behind a wave milestone on a Voltage tier.
 *
 * Design intent (to restore once tested): skin N unlocks by reaching wave 100
 * on Voltage N — CRIMSON on Voltage 1, RUST on Voltage 2, … SKULL on Voltage 12.
 *
 * TESTING OVERRIDE (current): the first two skins unlock at wave 5 and wave 6
 * on Voltage 1 so the flow can be exercised without grinding. See
 * `PRODUCTION_UNLOCK` below for the values to switch back to.
 */

export interface SkinDef {
  id: string;
  /** Display name, upper-cased in the UI. */
  name: string;
  /** `require`d PNG — full-res top-down tower art, drawn in battle. */
  image: number;
  /** `require`d PNG — small trimmed glyph for the Skins grid card. */
  icon: number;
  /** Reaching wave `wave` on Voltage `voltage` unlocks this skin. */
  unlock: { voltage: number; wave: number };
}

/** Grid order matches the Figma layout (row-major, 3 columns). */
export const SKINS: SkinDef[] = [
  { id: 'crimson', name: 'Crimson', image: require('@/assets/images/skins/skin-01-crimson.png'), icon: require('@/assets/images/skins/skin-01-crimson-icon.png'), unlock: { voltage: 1, wave: 100 } },
  { id: 'rust', name: 'Rust', image: require('@/assets/images/skins/skin-03-rust.png'), icon: require('@/assets/images/skins/skin-03-rust-icon.png'), unlock: { voltage: 1, wave: 100 } },
  { id: 'ember', name: 'Ember', image: require('@/assets/images/skins/skin-02-ember.png'), icon: require('@/assets/images/skins/skin-02-ember-icon.png'), unlock: { voltage: 3, wave: 100 } },
  { id: 'amber', name: 'Amber', image: require('@/assets/images/skins/skin-04-amber.png'), icon: require('@/assets/images/skins/skin-04-amber-icon.png'), unlock: { voltage: 4, wave: 100 } },
  { id: 'acid', name: 'Acid', image: require('@/assets/images/skins/skin-05-acid.png'), icon: require('@/assets/images/skins/skin-05-acid-icon.png'), unlock: { voltage: 5, wave: 100 } },
  { id: 'lime', name: 'Lime', image: require('@/assets/images/skins/skin-06-lime.png'), icon: require('@/assets/images/skins/skin-06-lime-icon.png'), unlock: { voltage: 6, wave: 100 } },
  { id: 'fried-egg', name: 'Fried Egg', image: require('@/assets/images/skins/skin-07-fried-egg.png'), icon: require('@/assets/images/skins/skin-07-fried-egg-icon.png'), unlock: { voltage: 7, wave: 100 } },
  { id: 'mush-mush', name: 'Mush-Mush', image: require('@/assets/images/skins/skin-08-mush-mush.png'), icon: require('@/assets/images/skins/skin-08-mush-mush-icon.png'), unlock: { voltage: 8, wave: 100 } },
  { id: 'turtle', name: 'Turtle', image: require('@/assets/images/skins/skin-09-turtle.png'), icon: require('@/assets/images/skins/skin-09-turtle-icon.png'), unlock: { voltage: 9, wave: 100 } },
  { id: 'cheese', name: 'Cheese', image: require('@/assets/images/skins/skin-10-cheese.png'), icon: require('@/assets/images/skins/skin-10-cheese-icon.png'), unlock: { voltage: 10, wave: 100 } },
  { id: 'cat', name: 'Cat', image: require('@/assets/images/skins/skin-11-cat.png'), icon: require('@/assets/images/skins/skin-11-cat-icon.png'), unlock: { voltage: 11, wave: 100 } },
  { id: 'skull', name: 'Skull', image: require('@/assets/images/skins/skin-12-skull.png'), icon: require('@/assets/images/skins/skin-12-skull-icon.png'), unlock: { voltage: 12, wave: 100 } },
];

/** Restore each skin's `unlock` to this (skin N → wave 100 on Voltage N) after testing. */
export const PRODUCTION_UNLOCK: Record<string, { voltage: number; wave: number }> = {
  crimson: { voltage: 1, wave: 100 },
  rust: { voltage: 2, wave: 100 },
};

/** Fresh saves wear no skin — the stock tower art (see render/battle-canvas). */
export const DEFAULT_SKIN_ID = '';

/** The skin for `id`, or `null` for the stock tower (empty / unknown id). */
export function getSkin(id: string): SkinDef | null {
  return SKINS.find((s) => s.id === id) ?? null;
}

/** Whether `skin` is unlocked given each tier's best wave so far. */
export function isSkinUnlocked(skin: SkinDef, highestWaveByVoltage: Record<number, number>): boolean {
  return (highestWaveByVoltage[skin.unlock.voltage] ?? 0) >= skin.unlock.wave;
}
