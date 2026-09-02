/**
 * Global feature flags.
 *
 * `ADS_ENABLED` gates every piece of UI that depends on rewarded video / ads.
 * No ad SDK is wired up yet, so it's `false` and all such buttons/pills are
 * hidden. Flip it to `true` (once an ad provider is integrated) to reveal them
 * all at once — search the codebase for `ADS_ENABLED` for every gated spot.
 */
export const ADS_ENABLED = false;
