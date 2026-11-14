// Geometry of the two scales on the result screen. No verdict threshold is used here.
import { S_SPEED_REL } from '../scoring/constants';

export const RULER_MIN = -10; // 10% faster
export const RULER_MAX = 30; // 30% slower

// Half-width of the "usual range" band, in percent of daytime speed: one standard deviation of
// the expected session-to-session difference, 100 * sqrt(s_T^2 + s_Tb^2 / k).
// The s values are the fixed design constants, not something measured on this person.
export function usualRangePct(tNow: 90 | 180, tBase: 90 | 180, k: number): number {
  return 100 * Math.sqrt(S_SPEED_REL[tNow] ** 2 + S_SPEED_REL[tBase] ** 2 / k);
}

// Where the three answers sit on the ruler: just as sharp 0%, a bit slower 10%, much slower 20%.
export const expectedPct = (prediction: 0 | 1 | 2): number => prediction * 10;

// Position on the ruler, 0 to 100. A value outside the axis is pinned to the end.
export function rulerPos(pct: number): { pos: number; off: 'left' | 'right' | null } {
  if (pct < RULER_MIN) return { pos: 0, off: 'left' };
  if (pct > RULER_MAX) return { pos: 100, off: 'right' };
  return { pos: ((pct - RULER_MIN) / (RULER_MAX - RULER_MIN)) * 100, off: null };
}

export const AWAKE_MAX_H = 28;
export const AWAKE_STEPS = [17, 21, 24] as const;

// Which study line applies to the hours entered: -1 below 17 h, else 0, 1 or 2.
export function awakeBand(awakeH: number): -1 | 0 | 1 | 2 {
  if (awakeH < 17) return -1;
  if (awakeH < 21) return 0;
  if (awakeH < 24) return 1;
  return 2;
}

export const awakePos = (awakeH: number): number => (Math.min(Math.max(awakeH, 0), AWAKE_MAX_H) / AWAKE_MAX_H) * 100;
