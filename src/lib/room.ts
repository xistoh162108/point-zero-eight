// Room averages. Both numbers use the speed change only; no verdict threshold is involved.
import type { Summary } from '../storage/upload';

export const NIGHT = ['21-24', '00-03', '03-06'] as const;
export const MIN_N = 5; // below this the mean is hidden

export const usable = (r: Summary) =>
  r.kind === 'compare' &&
  r.first &&
  !r.alcohol &&
  !r.justWoke &&
  (r.baselineClass === 'day' || r.baselineClass === 'evening') &&
  r.speedDeltaPct !== null;

const num = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const oneOf = (v: unknown, allowed: readonly unknown[]) => allowed.includes(v);
const orNull = (v: unknown, ok: (x: unknown) => boolean) => v === null || ok(v);

// The collection is world-readable and any anonymous client can add to it, so a row read back
// is untrusted. Rows that do not have exactly the expected shape are dropped.
export function parseRow(d: Record<string, unknown>, at: string | null): Summary | null {
  const ok =
    d.v === 1 &&
    oneOf(d.kind, ['baseline', 'compare']) &&
    oneOf(d.bucket, ['day', 'evening', '21-24', '00-03', '03-06', '06-09', 'other']) &&
    typeof d.first === 'boolean' &&
    typeof d.team === 'boolean' &&
    oneOf(d.lengthS, [90, 180]) &&
    oneOf(d.overtime, ['none', 'declined', 'taken']) &&
    num(d.awakeH, 0, 72) &&
    typeof d.caffeine === 'boolean' &&
    typeof d.alcohol === 'boolean' &&
    typeof d.justWoke === 'boolean' &&
    oneOf(d.hzClass, ['normal', 'low']) &&
    num(d.refreshHz, 1, 1000) &&
    oneOf(d.os, ['ios', 'android', 'other']) &&
    num(d.n, 5, 120) &&
    orNull(d.prediction, (x) => oneOf(x, [0, 1, 2])) &&
    orNull(d.baselineClass, (x) => oneOf(x, ['day', 'evening', 'late'])) &&
    orNull(d.k, (x) => num(x, 1, 3)) &&
    orNull(d.z, (x) => num(x, -20, 50)) &&
    orNull(d.verdict, (x) => oneOf(x, ['clear', 'signs', 'none'])) &&
    orNull(d.speedDeltaPct, (x) => num(x, -100, 100)) &&
    orNull(d.lapseDeltaPts, (x) => num(x, -100, 100)) &&
    orNull(d.rtDeltaMs, (x) => num(x, -5000, 5000));
  if (!ok) return null;
  const row = {} as Record<string, unknown>;
  for (const c of CSV_COLUMNS) row[c] = c === 'at' ? at : d[c];
  return row as unknown as Summary;
}

export interface BucketStat {
  bucket: string;
  n: number;
  mean: number;
  sd: number;
  ciLow: number;
  ciHigh: number;
  slowerShare: number;
}

const T975: Record<number, number> = {
  4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179,
  13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086, 25: 2.06, 30: 2.042,
};

// Two-sided 95% t value. Not in the table: use the next lower df (wider). Above 30: 2.042.
export function tCrit(df: number): number {
  if (df > 30) return 2.042;
  for (let d = Math.floor(df); d >= 4; d--) if (T975[d] !== undefined) return T975[d];
  return NaN;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function bucketStats(rows: Summary[]): BucketStat[] {
  return NIGHT.map((bucket) => {
    const x = rows.filter((r) => usable(r) && r.bucket === bucket).map((r) => r.speedDeltaPct as number);
    const n = x.length;
    const m = n ? mean(x) : NaN;
    const sd = n > 1 ? Math.sqrt(x.reduce((a, v) => a + (v - m) ** 2, 0) / (n - 1)) : NaN;
    const half = (tCrit(n - 1) * sd) / Math.sqrt(n);
    return {
      bucket,
      n,
      mean: m,
      sd,
      ciLow: m - half,
      ciHigh: m + half,
      slowerShare: n ? x.filter((v) => v > 0).length / n : NaN,
    };
  });
}

export interface PredictionStat {
  prediction: 0 | 1 | 2;
  n: number;
  mean: number;
  flaggedShare: number; // share with verdict signs or clear. Secondary: it leans on the fixed thresholds
}

export function predictionStats(rows: Summary[]): PredictionStat[] {
  const night = rows.filter((r) => usable(r) && (NIGHT as readonly string[]).includes(r.bucket));
  return ([0, 1, 2] as const).map((prediction) => {
    const g = night.filter((r) => r.prediction === prediction);
    return {
      prediction,
      n: g.length,
      mean: g.length ? mean(g.map((r) => r.speedDeltaPct as number)) : NaN,
      flaggedShare: g.length ? g.filter((r) => r.verdict === 'signs' || r.verdict === 'clear').length / g.length : NaN,
    };
  });
}

const CSV_COLUMNS = [
  'v', 'kind', 'at', 'bucket', 'first', 'team', 'lengthS', 'overtime', 'awakeH', 'caffeine', 'alcohol',
  'justWoke', 'hzClass', 'refreshHz', 'os', 'n', 'prediction', 'baselineClass', 'k', 'z', 'verdict',
  'speedDeltaPct', 'lapseDeltaPts', 'rtDeltaMs',
] as const;

// Text cells are quoted, and one that a spreadsheet would read as a formula gets a leading quote mark.
function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r']/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: Summary[]): string {
  const lines = rows.map((r) => CSV_COLUMNS.map((c) => cell(r[c])).join(','));
  return [CSV_COLUMNS.join(','), ...lines].join('\n') + '\n';
}
