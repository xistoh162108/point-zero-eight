// Checks the TypeScript scoring against the vectors produced by the reference implementation
// (reference_scoring.py). The vectors live in fixtures/scoring-fixtures.json.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import type { Trial } from '../engine/types';
import { score } from './verdict';

interface Fixture {
  name: string;
  baselines: Trial[][];
  night: Trial[];
  team: boolean;
  overtimeAccepted: boolean;
  expected: {
    verdict: string;
    overtimeOffered: boolean;
    lapseRuleUsed: boolean;
    z: number;
    speedDeltaPct: number;
    meanRtDeltaMs: number;
    distanceFt: number;
  };
}

const fx = JSON.parse(readFileSync(resolve(__dirname, '../../fixtures/scoring-fixtures.json'), 'utf8')) as {
  fixtures: Fixture[];
};

test('there are nine vectors', () => {
  expect(fx.fixtures).toHaveLength(9);
});

for (const f of fx.fixtures) {
  test(f.name, () => {
    const r = score(f.baselines, f.night, f.team, f.overtimeAccepted);
    expect(r.verdict).toBe(f.expected.verdict);
    expect(r.overtimeOffered).toBe(f.expected.overtimeOffered);
    expect(r.lapseRuleUsed).toBe(f.expected.lapseRuleUsed);
    expect(r.z).toBeCloseTo(f.expected.z, 6);
    expect(r.speedDeltaPct).toBeCloseTo(f.expected.speedDeltaPct, 6);
    expect(r.meanRtDeltaMs).toBeCloseTo(f.expected.meanRtDeltaMs, 6);
    expect(r.distanceFt).toBeCloseTo(f.expected.distanceFt, 6);
  });
}
