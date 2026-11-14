// Checks the TypeScript scoring against the vectors produced by the reference implementation
// (reference_scoring.py). The vectors live in fixtures/scoring-fixtures.json.
// The file is read at run time so that the app still builds before the vectors are checked in.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import type { Trial } from '../engine/types';
import { score, type Verdict } from './verdict';

interface Fixture {
  name: string;
  team: boolean;
  overtimeAccepted: boolean;
  baselines: Trial[][];
  night: Trial[];
  expected: {
    k: number;
    z: number;
    z90?: number | null;
    z180?: number | null;
    verdict: Verdict;
    overtimeOffered: boolean;
    finalLengthS: 90 | 180;
    lapseRuleUsed: boolean;
    speedDeltaPct: number;
    lapseDeltaPts: number;
    rtDeltaMs: number;
    distanceFt: number;
  };
}

const fx = JSON.parse(readFileSync(resolve(__dirname, '../../fixtures/scoring-fixtures.json'), 'utf8')) as {
  fixtures: Fixture[];
};

const close = (got: number | null, want: number | null | undefined) => {
  if (want === null || want === undefined) expect(got).toBeNull();
  else expect(got).toBeCloseTo(want, 6);
};

test('there are twelve vectors', () => {
  expect(fx.fixtures).toHaveLength(12);
});

for (const f of fx.fixtures) {
  test(f.name, () => {
    const r = score(f.baselines, f.night, f.team, f.overtimeAccepted);
    const e = f.expected;
    expect(r.verdict).toBe(e.verdict);
    expect(r.overtimeOffered).toBe(e.overtimeOffered);
    expect(r.finalLengthS).toBe(e.finalLengthS);
    expect(r.lapseRuleUsed).toBe(e.lapseRuleUsed);
    expect(r.k).toBe(e.k);
    close(r.z90, e.z90);
    close(r.z180, e.z180);
    close(r.z, e.z);
    close(r.speedDeltaPct, e.speedDeltaPct);
    close(r.lapseDeltaPts, e.lapseDeltaPts);
    close(r.rtDeltaMs, e.rtDeltaMs);
    close(r.distanceFt, e.distanceFt);
  });
}
