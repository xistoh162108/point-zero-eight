import type { Trial } from '../engine/types';
import { LAPSE_MS } from './constants';

export interface Metrics {
  n: number; // valid stimuli
  speed: number; // mean of 1000 / rtMs. A timeout enters as 5000
  lapseShare: number; // share of valid stimuli with rtMs >= 355
  typicalRtMs: number; // 1000 / speed. The reaction time shown on screen
  fastestMs: number | null; // fastest answered stimulus, timeouts left out
  slowestMs: number | null; // slowest answered stimulus, timeouts left out
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Valid stimulus: kind is ok, lapse or timeout, and onsetMs < uptoMs.
export function metrics(trials: Trial[], uptoMs: number): Metrics {
  const rts: number[] = [];
  const answered: number[] = [];
  for (const t of trials) {
    if (t.kind !== 'ok' && t.kind !== 'lapse' && t.kind !== 'timeout') continue;
    if (t.onsetMs === null || t.rtMs === null || t.onsetMs >= uptoMs) continue;
    rts.push(t.rtMs);
    if (t.kind !== 'timeout') answered.push(t.rtMs);
  }
  // The typical reaction time is 1000 / mean speed, not the mean of the times:
  // one missed stimulus (5000 ms) would drag a plain mean far more than it changes the speed.
  const speed = mean(rts.map((rt) => 1000 / rt));
  return {
    n: rts.length,
    speed,
    lapseShare: rts.filter((rt) => rt >= LAPSE_MS).length / rts.length,
    typicalRtMs: 1000 / speed,
    fastestMs: answered.length ? Math.min(...answered) : null,
    slowestMs: answered.length ? Math.max(...answered) : null,
  };
}

export interface Baseline {
  speed: number;
  lapseShare: number;
  typicalRtMs: number;
  k: number;
}

// Metrics per session first, then speed and lapse share averaged across sessions.
export function baselineOf(sessions: Trial[][], uptoMs: number): Baseline {
  const ms = sessions.map((s) => metrics(s, uptoMs));
  const speed = mean(ms.map((m) => m.speed));
  return {
    speed,
    lapseShare: mean(ms.map((m) => m.lapseShare)),
    typicalRtMs: 1000 / speed,
    k: ms.length,
  };
}
