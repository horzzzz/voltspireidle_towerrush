/**
 * Balance constants, ported 1:1 from the original's `balance_config.gd`
 * (Voltspire: Idle Tower Defense 1.9.0, Godot 4.7 — extracted from the
 * shipped `index.pck`; see the `voltspire-pck-extraction` memory for how).
 *
 * Names deliberately mirror the original's exported property names so any
 * number here can be checked against the source in one grep. Anything that
 * is *not* a straight port is grouped under "Port-specific" at the bottom
 * and says why it deviates.
 *
 * `src/game/core/formulas.ts` is the matching port of `formulas.gd` and is
 * the only place these constants are turned into gameplay values.
 */

// --- Enemy HP curve -------------------------------------------------------
// hp(w) = (poly + linear + const) * additive-steps * growth-steps * scale
export const ENEMY_HP_POLY_COEFFICIENT = 0.00320453105;
export const ENEMY_HP_POLY_EXPONENT = 2.5;
export const ENEMY_HP_LINEAR_COEFFICIENT = 2.2;
export const ENEMY_HP_CONSTANT = 0.616281531;

/** `[everyNWaves, addedFraction]` — each contributes `+y * floor(wave / x)`. */
export const ENEMY_HP_STEP_ADDITIVE_TERMS: [number, number][] = [
  [10, 0.15],
  [20, 0.15],
  [40, 0.15],
  [80, 0.15],
  [160, 0.15],
  [320, 0.15],
  [640, 0.15],
  [1280, 0.15],
];

/** `[everyNWaves, multiplier]` — each contributes `y ^ floor(wave / x)`. */
export const ENEMY_HP_STEP_GROWTH_TERMS: [number, number][] = [
  [15, 1.045],
  [30, 1.045],
  [60, 1.045],
  [120, 1.045],
  [240, 1.045],
  [480, 1.045],
  [960, 1.045],
  [1920, 1.045],
];

// --- Enemy contact damage -------------------------------------------------
export const ENEMY_CONTACT_DAMAGE_BASE = 1.0;
export const ENEMY_CONTACT_DAMAGE_GROWTH = 1.06;
/** Seconds between melee contact hits. */
export const ENEMY_ATTACK_INTERVAL = 1.5;

/** Flat px/s for every enemy before its type multiplier — `Enemy.MOVE_SPEED`. */
export const ENEMY_MOVE_SPEED = 60;

// --- Wave structure -------------------------------------------------------
/** Enemies drip in over this many seconds... */
export const WAVE_SPAWN_PHASE_DURATION = 18;
/** ...then the wave idles this long before the next one starts. */
export const WAVE_COOLDOWN_DURATION = 12;
export const WAVE_BASE_ENEMY_COUNT = 10;
export const WAVE_ENEMY_COUNT_PER_WAVE = 0.8;

/**
 * Income is normalised against this "reference" headcount rather than the
 * actual one, so a fatter wave pays the same total — the fix the original
 * shipped when per-kill income made big waves a gift instead of a threat.
 */
export const WAVE_INCOME_REFERENCE_BASE = 6;
export const WAVE_INCOME_REFERENCE_PER_WAVE = 0.25;

/** Simultaneously alive enemies the sim will keep spawning up to. */
export const NORMAL_MAX_ON_SCREEN = 120;

// --- Boss -----------------------------------------------------------------
export const BOSS_WAVE_INTERVAL = 10;
export const BOSS_HP_MULTIPLIER = 20;
export const BOSS_SPEED_MULTIPLIER = 0.3;
export const BOSS_CHARGE_MULTIPLIER = 15;
export const BOSS_SCRAP_MULTIPLIER = 15;

// --- Income ---------------------------------------------------------------
export const CHARGE_BASE_REWARD = 0.07;
export const CHARGE_INCOME_EXPONENT = 1.39;
/** Scrap per kill gains `1 + wave * this` on top of the enemy's base value. */
export const SCRAP_WAVE_GROWTH = 0.002;
/** `GameState.STARTING_CHARGE_FLOOR` — Charge every run opens with. */
export const STARTING_CHARGE = 20;

// --- Spire base stats -----------------------------------------------------
export const TOWER_BASE_DAMAGE = 14;
export const TOWER_BASE_HP = 6;
export const TOWER_BASE_ATTACK_SPEED = 1.0;
export const REGEN_UPGRADE_BASE_VALUE = 0.2;
/** Percent, not a fraction — the Spire starts at a 1% crit chance. */
export const TOWER_BASE_CRIT_CHANCE = 1.0;
export const TOWER_BASE_CRIT_MULTIPLIER = 1.2;
export const TOWER_BASE_ARMOR = 1.0;
export const TOWER_BASE_DEFLECTION = 0;
/**
 * A contact hit never drops below this fraction of its raw damage, no matter
 * how much Armor and Deflection are stacked. This — not a clamp on Deflection
 * itself — is what caps damage reduction in the original.
 */
export const TOWER_INCOMING_DAMAGE_FLOOR_FRACTION = 0.05;

// --- Enemy composition ----------------------------------------------------
export const ENEMY_TYPE_FAST_MIN_WAVE = 3;
export const ENEMY_TYPE_TANK_MIN_WAVE = 5;
export const ENEMY_TYPE_SHARE_RAMP_WAVES = 20;
export const ENEMY_TYPE_MAX_SHARE = 0.3;

// --- Voltage ladders ------------------------------------------------------
/** Cumulative: V2 = 22x, V3 = 22 * 2.5 = 55x, ... */
export const VOLTAGE_HP_LADDER_STEPS = [22, 2.5, 2.5, 2.5, 2.5, 3, 3, 3, 3];
export const VOLTAGE_SCRAP_LADDER_STEPS = [2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2];
export const VOLTAGE_DMG_MULT_BASE = 2.4;

// --- Game speed -----------------------------------------------------------
export const GAME_SPEED_BASE_MAX = 2;
export const GAME_SPEED_STEP = 1;

// --- Port-specific --------------------------------------------------------
/**
 * The one deliberate deviation from 1:1, and the single knob to tune with it.
 *
 * The original's Spire shoots at 375 px (30 m * 12.5 px/m) and can upgrade
 * that to 850; ours is pinned at the 91 px dashed ring from the Figma frame
 * (see `data/arena.ts`) and has no Range branch. That means an enemy in this
 * port spends a fraction of the time under fire before it reaches the tower,
 * so the original's own HP curve — which assumes the longer engagement —
 * would wipe a fresh 6 HP Spire almost immediately.
 *
 * Rather than bend the curve itself (which would make every number here
 * unverifiable against the source), the whole curve is scaled by this one
 * factor, exactly the way the original's own `enemy_hp_scale` knob works —
 * it just ships at 1.0 there. Tune with `npm run sim`, never by editing the
 * polynomial above.
 */
export const ENEMY_HP_SCALE = 1.0;

/** Run rewards (Scrap + Gems) are banked at this multiple of what the run earned. */
export const RUN_REWARD_MULTIPLIER = 2;
