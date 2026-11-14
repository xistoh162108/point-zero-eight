import type { Trial } from '../engine/types';
import { LAPSE_MS } from './constants';

export interface Metrics {
  n: number; // valid stimuli
  speed: number; // mean of 1000 / rtMs
  lapseShare: number; // share of valid stimuli with rtMs >= 355
  meanRtMs: number; // timeouts count as 5000
  fastestMs: number;
  slowestMs: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Valid stimulus: kind is ok, lapse or timeout, and onsetMs < uptoMs.
export function metrics(trials: Trial[], uptoMs: number): Metrics {
  const rts: number[] = [];
  for (const t of trials) {
    if (t.kind !== 'ok' && t.kind !== 'lapse' && t.kind !== 'timeout') continue;
    if (t.onsetMs === null || t.rtMs === null || t.onsetMs >= uptoMs) continue;
    rts.push(t.rtMs);
  }
  return {
    n: rts.length,
    speed: mean(rts.map((rt) => 1000 / rt)),
    lapseShare: rts.filter((rt) => rt >= LAPSE_MS).length / rts.length,
    meanRtMs: mean(rts),
    fastestMs: Math.min(...rts),
    slowestMs: Math.max(...rts),
  };
}

export interface Baseline {
  speed: number;
  lapseShare: number;
  meanRtMs: number;
  k: number;
}

// Metrics per session first, then the mean across sessions.
export function baselineOf(sessions: Trial[][], uptoMs: number): Baseline {
  const ms = sessions.map((s) => metrics(s, uptoMs));
  return {
    speed: mean(ms.map((m) => m.speed)),
    lapseShare: mean(ms.map((m) => m.lapseShare)),
    meanRtMs: mean(ms.map((m) => m.meanRtMs)),
    k: ms.length,
  };
}
