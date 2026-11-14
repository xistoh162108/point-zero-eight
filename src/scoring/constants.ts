// Thresholds and reference values. Frozen: do not edit during the event.
// They come from a simulation over assumed distributions, not from validation on real participants.
export const LAPSE_MS = 355;
export const MIN_VALID_MS = 100;
export const TIMEOUT_MS = 5000;
export const S_SPEED_REL = { 90: 0.07, 180: 0.066 } as const; // between-session SD, relative to own daytime speed
export const S_LAPSE = { 90: 0.065, 180: 0.055 } as const; // between-session SD of the lapse share
export const E_FIRST = 3.0; // clear on a single look
export const G_NONE = 1.0; // below this at 90 s: none, no overtime
export const E_OVERTIME = 3.2; // clear after overtime
export const F_SIGNS = 2.0; // signs
export const MAX_BASELINE_LAPSE_FOR_LAPSE_RULE = 0.25;
export const FT_PER_S_AT_65MPH = 95.33;
