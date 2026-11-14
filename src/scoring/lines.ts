import { en } from '../copy/en';
import { FT_PER_S_AT_65MPH } from './constants';
import type { Verdict } from './verdict';

const SAME_MS = 15; // a mean difference under this reads as "about as fast"

export function distanceLine(meanRtDeltaMs: number): string {
  if (Math.abs(meanRtDeltaMs) < SAME_MS) return en.result.distanceSame;
  if (meanRtDeltaMs > 0) {
    return en.result.distanceSlower(meanRtDeltaMs, (meanRtDeltaMs / 1000) * FT_PER_S_AT_65MPH);
  }
  return en.result.distanceFaster(meanRtDeltaMs);
}

// Research citation by hours awake. Always shown with en.result.awakeTag.
export function awakeLine(awakeH: number): string | null {
  if (awakeH < 17) return null;
  if (awakeH < 21) return en.result.awake17(awakeH);
  if (awakeH < 24) return en.result.awake21(awakeH);
  return en.result.awake24(awakeH);
}

// The measured half is written from the speed change, not from the verdict.
export function predictionLine(
  prediction: 0 | 1 | 2,
  _verdict: Verdict,
  speedDeltaPct: number,
): { expected: string; measured: string } {
  return { expected: en.result.expected(prediction), measured: en.result.measured(speedDeltaPct) };
}
