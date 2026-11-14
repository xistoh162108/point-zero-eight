import { expect, test } from 'vitest';
import type { Summary } from '../storage/upload';
import { bucketStats, parseRow, predictionStats, tCrit, toCsv, usable } from './room';

function row(over: Partial<Summary> = {}): Summary {
  return {
    v: 1, kind: 'compare', at: '2026-11-15T08:00:00.000Z', bucket: '03-06', first: true, team: false,
    lengthS: 90, overtime: 'none', awakeH: 20, caffeine: false, alcohol: false, justWoke: false,
    hzClass: 'normal', refreshHz: 60, os: 'ios', n: 30, prediction: 0, baselineClass: 'day', k: 1,
    z: 1.2, verdict: 'none', speedDeltaPct: 5, lapseDeltaPts: 3, rtDeltaMs: 20,
    ...over,
  };
}

test('usable excludes repeats, alcohol, just woke, late baselines and daytime records', () => {
  expect(usable(row())).toBe(true);
  expect(usable(row({ baselineClass: 'evening' }))).toBe(true);
  expect(usable(row({ first: false }))).toBe(false);
  expect(usable(row({ alcohol: true }))).toBe(false);
  expect(usable(row({ justWoke: true }))).toBe(false);
  expect(usable(row({ baselineClass: 'late' }))).toBe(false);
  expect(usable(row({ kind: 'baseline', speedDeltaPct: null, baselineClass: null }))).toBe(false);
});

test('tCrit uses the next lower df and 2.042 above 30', () => {
  expect(tCrit(4)).toBe(2.776);
  expect(tCrit(22)).toBe(2.086);
  expect(tCrit(27)).toBe(2.06);
  expect(tCrit(30)).toBe(2.042);
  expect(tCrit(80)).toBe(2.042);
});

test('bucket stats: mean, sample sd, 95% CI, slower share', () => {
  const xs = [2, 4, 6, 8, 10];
  const rows = [...xs.map((x) => row({ speedDeltaPct: x })), row({ speedDeltaPct: 90, alcohol: true })];
  const b = bucketStats(rows).find((s) => s.bucket === '03-06');
  expect(b?.n).toBe(5);
  expect(b?.mean).toBeCloseTo(6, 9);
  expect(b?.sd).toBeCloseTo(Math.sqrt(10), 9);
  expect(b?.ciLow).toBeCloseTo(6 - (2.776 * Math.sqrt(10)) / Math.sqrt(5), 9);
  expect(b?.ciHigh).toBeCloseTo(6 + (2.776 * Math.sqrt(10)) / Math.sqrt(5), 9);
  expect(b?.slowerShare).toBe(1);
  expect(bucketStats(rows).find((s) => s.bucket === '00-03')?.n).toBe(0);
});

test('prediction stats use night buckets only', () => {
  const rows = [
    row({ prediction: 0, speedDeltaPct: 10, verdict: 'signs' }),
    row({ prediction: 0, speedDeltaPct: 6, bucket: '00-03' }),
    row({ prediction: 0, speedDeltaPct: 50, bucket: '06-09' }),
    row({ prediction: 2, speedDeltaPct: 20, verdict: 'clear' }),
  ];
  const [p0, p1, p2] = predictionStats(rows);
  expect(p0.n).toBe(2);
  expect(p0.mean).toBeCloseTo(8, 9);
  expect(p0.flaggedShare).toBe(0.5);
  expect(p1.n).toBe(0);
  expect(p2.mean).toBe(20);
});

test('csv has a header and one line per row, nulls empty', () => {
  const csv = toCsv([row(), row({ kind: 'baseline', prediction: null })]).trim().split('\n');
  expect(csv).toHaveLength(3);
  expect(csv[0].split(',')).toHaveLength(24);
  expect(csv[2].split(',')[16]).toBe('');
});

test('rows read from the server are checked field by field', () => {
  const { at, ...body } = row();
  expect(parseRow(body, at)).toEqual(row());
  expect(parseRow({ ...body, extra: '=HYPERLINK("x")' }, at)).toEqual(row());
  expect(parseRow({ ...body, os: '=cmd' }, at)).toBeNull();
  expect(parseRow({ ...body, speedDeltaPct: 1e9 }, at)).toBeNull();
  expect(parseRow({ ...body, speedDeltaPct: '5' }, at)).toBeNull();
  expect(parseRow({ ...body, n: 2 }, at)).toBeNull();
  expect(parseRow({ ...body, first: 'yes' }, at)).toBeNull();
  expect(parseRow({ ...body, verdict: 'pass' }, at)).toBeNull();
});

test('csv neutralises text a spreadsheet would run as a formula', () => {
  const line = toCsv([row({ os: '=1+1' as never, verdict: 'a,"b"' as never })]).trim().split('\n')[1];
  expect(line).toContain(`"'=1+1"`);
  expect(line).toContain('"a,""b"""');
  expect(toCsv([row({ speedDeltaPct: -3.5 })])).toContain(',-3.5,');
});
