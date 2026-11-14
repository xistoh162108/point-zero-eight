import type { Trial } from '../engine/types';
import {
  E_FIRST,
  E_OVERTIME,
  F_SIGNS,
  FT_PER_S_AT_65MPH,
  G_NONE,
  MAX_BASELINE_LAPSE_FOR_LAPSE_RULE,
  S_LAPSE,
  S_SPEED_REL,
} from './constants';
import { baselineOf, metrics, type Baseline, type Metrics } from './metrics';

export type Verdict = 'clear' | 'signs' | 'none';

// zS: how much slower than the daytime speed, in units of the expected session-to-session noise.
// zL: the same for the lapse share. Devices whose daytime lapse share is above 0.25 use speed only.
export function zScores(
  now: Metrics,
  base: Baseline,
  tNow: 90 | 180,
  tBase: 90 | 180,
): { zS: number; zL: number; z: number; lapseRuleUsed: boolean } {
  const k = base.k;
  const zS = (base.speed - now.speed) / (base.speed * Math.sqrt(S_SPEED_REL[tNow] ** 2 + S_SPEED_REL[tBase] ** 2 / k));
  const zL = (now.lapseShare - base.lapseShare) / Math.sqrt(S_LAPSE[tNow] ** 2 + S_LAPSE[tBase] ** 2 / k);
  const lapseRuleUsed = base.lapseShare <= MAX_BASELINE_LAPSE_FOR_LAPSE_RULE;
  return { zS, zL, z: lapseRuleUsed ? Math.max(zS, zL) : zS, lapseRuleUsed };
}

export function firstCall(z90: number): 'clear' | 'none' | 'unclear' {
  if (z90 >= E_FIRST) return 'clear';
  if (z90 < G_NONE) return 'none';
  return 'unclear';
}

export interface Result {
  k: number;
  z90: number | null;
  z180: number | null;
  z: number; // the z used last
  verdict: Verdict;
  overtimeOffered: boolean;
  finalLengthS: 90 | 180;
  lapseRuleUsed: boolean;
  speedDeltaPct: number; // 100 * (day speed - now speed) / day speed. Positive means slower
  lapseDeltaPts: number; // 100 * (now lapse share - day lapse share)
  meanRtDeltaMs: number; // now mean - day mean
  distanceFt: number; // max(0, meanRtDeltaMs) / 1000 * 95.33
}

const signsOrNone = (z: number): Verdict => (z >= F_SIGNS ? 'signs' : 'none');

export function score(baselines: Trial[][], night: Trial[], team: boolean, overtimeAccepted: boolean): Result {
  let z90: number | null = null;
  let z180: number | null = null;
  let verdict: Verdict;
  let overtimeOffered = false;
  let finalLengthS: 90 | 180;
  let now: Metrics;
  let base: Baseline;
  let used: ReturnType<typeof zScores>;

  if (team) {
    // Team: night 180 s against daytime 180 s.
    base = baselineOf(baselines, 180000);
    now = metrics(night, 180000);
    used = zScores(now, base, 180, 180);
    z180 = used.z;
    verdict = used.z >= E_FIRST ? 'clear' : signsOrNone(used.z);
    finalLengthS = 180;
  } else {
    // Room: first call on night 90 s against daytime 90 s.
    base = baselineOf(baselines, 90000);
    now = metrics(night, 90000);
    used = zScores(now, base, 90, 90);
    z90 = used.z;
    finalLengthS = 90;
    const first = firstCall(used.z);
    if (first !== 'unclear') {
      verdict = first;
    } else {
      overtimeOffered = true;
      if (overtimeAccepted) {
        // Overtime: the whole night 180 s against daytime 90 s.
        now = metrics(night, 180000);
        used = zScores(now, base, 180, 90);
        z180 = used.z;
        verdict = used.z >= E_OVERTIME ? 'clear' : signsOrNone(used.z);
        finalLengthS = 180;
      } else {
        verdict = signsOrNone(used.z);
      }
    }
  }

  const meanRtDeltaMs = now.meanRtMs - base.meanRtMs;
  return {
    k: base.k,
    z90,
    z180,
    z: used.z,
    verdict,
    overtimeOffered,
    finalLengthS,
    lapseRuleUsed: used.lapseRuleUsed,
    speedDeltaPct: (100 * (base.speed - now.speed)) / base.speed,
    lapseDeltaPts: 100 * (now.lapseShare - base.lapseShare),
    meanRtDeltaMs,
    distanceFt: (Math.max(0, meanRtDeltaMs) / 1000) * FT_PER_S_AT_65MPH,
  };
}
