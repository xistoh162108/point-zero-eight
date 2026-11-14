// Hand-computed checks of the scoring rules, independent of the reference vectors.
import { expect, test } from 'vitest';
import type { Trial, TrialKind } from '../engine/types';
import { awakeLine, distanceLine, predictionLine } from './lines';
import { baselineOf, metrics } from './metrics';
import { firstCall, score, zScores } from './verdict';

// n stimuli, 3 s apart starting at startMs, all with the same reaction time.
function block(n: number, rtMs: number, startMs = 0): Trial[] {
  return Array.from({ length: n }, (_, i) => ({
    i,
    isiMs: 2500,
    onsetMs: startMs + i * 3000,
    rtMs,
    kind: (rtMs >= 355 ? 'lapse' : 'ok') as TrialKind,
    frameMs: 16.7,
  }));
}

test('metrics counts only ok, lapse and timeout before the cutoff', () => {
  const trials: Trial[] = [
    ...block(4, 250),
    { i: 4, isiMs: 2000, onsetMs: null, rtMs: null, kind: 'false_start', frameMs: 16.7 },
    { i: 5, isiMs: 2000, onsetMs: 20000, rtMs: 200, kind: 'invalid', frameMs: 40 },
    { i: 6, isiMs: 2000, onsetMs: 30000, rtMs: 5000, kind: 'timeout', frameMs: 16.7 },
    { i: 7, isiMs: 2000, onsetMs: 95000, rtMs: 300, kind: 'ok', frameMs: 16.7 },
  ];
  const m = metrics(trials, 90000);
  expect(m.n).toBe(5);
  expect(m.speed).toBeCloseTo((4 * 4 + 0.2) / 5, 9);
  expect(m.typicalRtMs).toBeCloseTo(5000 / (4 * 4 + 0.2), 9);
  expect(m.lapseShare).toBeCloseTo(0.2, 9);
  expect(m.fastestMs).toBe(250);
  expect(m.slowestMs).toBe(250); // the timeout is left out of fastest and slowest
  expect(metrics(trials, 180000).n).toBe(6);
});

test('baseline is the mean of per-session metrics', () => {
  const b = baselineOf([block(30, 250), block(30, 200)], 90000);
  expect(b.k).toBe(2);
  expect(b.speed).toBeCloseTo(4.5, 9);
  expect(b.typicalRtMs).toBeCloseTo(1000 / 4.5, 9);
});

test('z uses the larger of speed and lapse, and speed only above 25% daytime lapses', () => {
  const now = { n: 30, speed: 3.2, lapseShare: 0.5, typicalRtMs: 312.5, fastestMs: 200, slowestMs: 600 };
  const ok = zScores(now, { speed: 4, lapseShare: 0.1, typicalRtMs: 250, k: 1 }, 90, 90);
  expect(ok.zS).toBeCloseTo(0.2 / (0.07 * Math.SQRT2), 9);
  expect(ok.zL).toBeCloseTo(0.4 / (0.065 * Math.SQRT2), 9);
  expect(ok.z).toBe(ok.zL);
  expect(ok.lapseRuleUsed).toBe(true);
  const noisy = zScores(now, { speed: 4, lapseShare: 0.3, typicalRtMs: 250, k: 1 }, 90, 90);
  expect(noisy.z).toBe(noisy.zS);
  expect(noisy.lapseRuleUsed).toBe(false);
  const mixed = zScores(now, { speed: 4, lapseShare: 0.1, typicalRtMs: 250, k: 2 }, 180, 90);
  expect(mixed.zS).toBeCloseTo(0.2 / Math.sqrt(0.066 ** 2 + 0.07 ** 2 / 2), 9);
});

test('first call boundaries', () => {
  expect(firstCall(3.0)).toBe('clear');
  expect(firstCall(2.999)).toBe('unclear');
  expect(firstCall(1.0)).toBe('unclear');
  expect(firstCall(0.999)).toBe('none');
});

test('room: same speed is none with no overtime', () => {
  const r = score([block(30, 250)], block(30, 250), false, false);
  expect(r.verdict).toBe('none');
  expect(r.overtimeOffered).toBe(false);
  expect(r.z).toBeCloseTo(0, 9);
  expect(r.finalLengthS).toBe(90);
  expect(r.distanceFt).toBe(0);
});

test('room: unclear first call, declined and accepted', () => {
  const night = [...block(30, 300), ...block(30, 300, 90000)];
  const zS90 = (1 - 250 / 300) / (0.07 * Math.SQRT2); // 1.68
  const declined = score([block(30, 250)], night, false, false);
  expect(declined.overtimeOffered).toBe(true);
  expect(declined.z).toBeCloseTo(zS90, 9);
  expect(declined.z90).toBeCloseTo(zS90, 9);
  expect(declined.z180).toBeNull();
  expect(declined.verdict).toBe('none');
  expect(declined.speedDeltaPct).toBeCloseTo(100 / 6, 9);
  expect(declined.rtDeltaMs).toBeCloseTo(50, 9);
  expect(declined.distanceFt).toBeCloseTo(0.05 * 95.33, 9);

  const taken = score([block(30, 250)], night, false, true);
  expect(taken.finalLengthS).toBe(180);
  expect(taken.z180).toBeCloseTo((1 - 250 / 300) / Math.sqrt(0.066 ** 2 + 0.07 ** 2), 9);
  expect(taken.verdict).toBe('none');
});

test('room: much slower is clear at the first call', () => {
  const r = score([block(30, 250)], block(30, 400), false, true);
  expect(r.verdict).toBe('clear');
  expect(r.overtimeOffered).toBe(false);
  expect(r.finalLengthS).toBe(90);
});

test('team: 180 s against 180 s with the 3.0 and 2.0 cut-offs', () => {
  const day = [[...block(30, 250), ...block(30, 250, 90000)]];
  const night = [...block(30, 310), ...block(30, 310, 90000)];
  const r = score(day, night, true, false);
  const z = (1 - 250 / 310) / (0.066 * Math.SQRT2);
  expect(r.z90).toBeNull();
  expect(r.z180).toBeCloseTo(z, 9);
  expect(r.verdict).toBe('signs');
  expect(r.overtimeOffered).toBe(false);
});

test('lines', () => {
  expect(distanceLine(10)).toBe('Your typical reaction was about as fast as in the daytime.');
  expect(distanceLine(50)).toBe(
    'Your typical reaction was 0.05 s later than in the daytime. At 65 mph, that is about 5 feet of road.',
  );
  expect(distanceLine(-30)).toBe('Your typical reaction was 0.03 s faster than in the daytime.');
  expect(awakeLine(16)).toBeNull();
  expect(awakeLine(17)).toContain('0.05%');
  expect(awakeLine(21)).toContain('0.08%');
  expect(awakeLine(24)).toContain('0.10%');
  expect(predictionLine(0, 'none', 11.2)).toEqual({
    expected: 'You expected: just as sharp.',
    measured: 'Measured: 11% slower than daytime you.',
  });
  expect(predictionLine(1, 'none', 2.9).measured).toBe('Measured: about the same as daytime you.');
  expect(predictionLine(2, 'none', -4.6).measured).toBe('Measured: 5% faster than daytime you.');
});

test('one missed stimulus barely moves the typical reaction time and the distance', () => {
  const night = block(30, 250);
  night[10] = { ...night[10], rtMs: 5000, kind: 'timeout' };
  const r = score([block(30, 250)], night, false, false);
  expect(r.verdict).toBe('none');
  expect(r.rtDeltaMs).toBeCloseTo(1000 / ((29 * 4 + 0.2) / 30) - 250, 9);
  expect(r.distanceFt).toBeLessThan(1);
});
