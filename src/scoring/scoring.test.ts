// Checks the TypeScript scoring against the vectors produced by the reference implementation
// (fixtures/reference_scoring.py). Numbers must agree to six decimals, strings and booleans exactly.
import { expect, test } from 'vitest';
import fx from '../../fixtures/scoring-fixtures.json';
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

const fixtures = fx.fixtures as unknown as Fixture[];

const close = (got: number | null, want: number | null | undefined) => {
  if (want === null || want === undefined) expect(got).toBeNull();
  else expect(got).toBeCloseTo(want, 6);
};

test('there are twelve vectors', () => {
  expect(fixtures).toHaveLength(12);
});

for (const f of fixtures) {
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
