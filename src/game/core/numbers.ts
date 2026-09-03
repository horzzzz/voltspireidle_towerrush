/**
 * Number formatting for HUD/UI display. Deliberately plain `number` — the
 * sim stays on doubles through wave ~1400 (10 * 1.18^1400 is still far under
 * Number.MAX_VALUE well before that point matters gameplay-wise), and this
 * is the one seam the economy milestone will swap for a big-number type
 * (see voltspire-tech-stack memory). Nothing outside this file should
 * format a number by hand.
 */

const BASE_SUFFIXES = ['', 'K', 'M', 'B', 'T'];

/** 0 -> 'aa', 1 -> 'ab', ... 25 -> 'az', 26 -> 'ba', ... continuing past T. */
function tierToLetters(index: number): string {
  const first = Math.floor(index / 26);
  const second = index % 26;
  return String.fromCharCode(97 + first) + String.fromCharCode(97 + second);
}

function trimTrailingZeros(text: string): string {
  if (!text.includes('.')) return text;
  return text.replace(/0+$/, '').replace(/\.$/, '');
}

/** "5", "45.4", "783.37", "1.5K", "1M", "1.2aa" (after T, at 10^15). */
export function formatNumber(value: number, decimals = 2): string {
  if (Number.isNaN(value)) return '0';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  if (value === 0) return '0';

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const tier = abs < 1000 ? 0 : Math.floor(Math.log10(abs) / 3);
  const suffix = tier < BASE_SUFFIXES.length ? BASE_SUFFIXES[tier] : tierToLetters(tier - BASE_SUFFIXES.length);
  const scaled = abs / Math.pow(1000, tier);

  return sign + trimTrailingZeros(scaled.toFixed(decimals)) + suffix;
}

/** Whole numbers only — wave counters, kill counts. Never shows a suffix. */
export function formatInt(value: number): string {
  return String(Math.round(value));
}

/** "+14.2%", "-0.5%" — additive upgrade previews. */
export function formatPercent(value: number, decimals = 1): string {
  return `${trimTrailingZeros(value.toFixed(decimals))}%`;
}

/**
 * How an upgrade's raw value is written on a row. `display` comes from the
 * def (data/coilworks.ts `CoilworksDisplay`), so both the Coilworks screen
 * and the in-battle bar render the same stat the same way — including the
 * original's own quirk that Crit Chance is stored as a percentage while
 * Deflection is stored as a 0..1 fraction.
 */
export function formatStatValue(display: StatDisplay, value: number): string {
  switch (display) {
    case 'rate':
      return `${formatNumber(value, 2)}/s`;
    case 'percent':
      return formatPercent(value);
    case 'fractionPercent':
      return formatPercent(value * 100);
    case 'multiplier':
      return `${formatNumber(value, 2)}x`;
    default:
      return formatNumber(value, 2);
  }
}

export type StatDisplay = 'number' | 'rate' | 'percent' | 'fractionPercent' | 'multiplier';
