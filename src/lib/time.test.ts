import { expect, test } from 'vitest';
import type { Session } from '../engine/types';
import { baselinesFor, compareCooldownMin, decideMode } from '../storage/local';
import { baselineClassOf, bucketOf, hoursAwake, wakeIsAhead } from './time';

const at = (h: number, m: number) => new Date(2026, 10, h < 12 ? 15 : 14, h, m);

test('bucket boundaries', () => {
  expect(bucketOf(at(11, 59).getHours())).toBe('other');
  expect(bucketOf(at(12, 0).getHours())).toBe('day');
  expect(bucketOf(17)).toBe('day');
  expect(bucketOf(18)).toBe('evening');
  expect(bucketOf(at(19, 59).getHours())).toBe('evening');
  expect(bucketOf(at(20, 0).getHours())).toBe('evening');
  expect(bucketOf(21)).toBe('21-24');
  expect(bucketOf(at(23, 59).getHours())).toBe('21-24');
  expect(bucketOf(at(0, 0).getHours())).toBe('00-03');
  expect(bucketOf(at(2, 59).getHours())).toBe('00-03');
  expect(bucketOf(at(3, 0).getHours())).toBe('03-06');
  expect(bucketOf(6)).toBe('06-09');
  expect(bucketOf(9)).toBe('other');
});

test('baseline class boundaries', () => {
  expect(baselineClassOf(11)).toBe('late');
  expect(baselineClassOf(12)).toBe('day');
  expect(baselineClassOf(18)).toBe('evening');
  expect(baselineClassOf(21)).toBe('evening');
  expect(baselineClassOf(22)).toBe('late');
  expect(baselineClassOf(0)).toBe('late');
});

function session(startedAt: Date, over: Partial<Session> = {}): Session {
  return {
    v: 1,
    id: String(startedAt.getTime()),
    startedAt: startedAt.toISOString(),
    localHour: startedAt.getHours(),
    mode: 'baseline',
    baselineClass: 'day',
    lengthS: 90,
    overtime: 'none',
    team: false,
    awakeH: 8,
    prediction: null,
    caffeine: false,
    alcohol: false,
    justWoke: false,
    refreshHz: 60,
    hzClass: 'normal',
    os: 'other',
    trials: [],
    metrics: { n: 30, speed: 4, lapseShare: 0, typicalRtMs: 250, fastestMs: 200, slowestMs: 320 },
    result: null,
    uploaded: false,
    ...over,
  };
}

test('decideMode: no usable daytime record means baseline at any hour', () => {
  for (const [h, m] of [[11, 59], [12, 0], [19, 59], [20, 0], [23, 59], [0, 0], [2, 59], [3, 0]]) {
    expect(decideMode(at(h, m), [], 'normal')).toBe('baseline');
  }
  const woke = [session(at(15, 0), { justWoke: true })];
  expect(decideMode(at(23, 59), woke, 'normal')).toBe('baseline');
  const low = [session(at(15, 0), { hzClass: 'low' })];
  expect(decideMode(at(23, 59), low, 'normal')).toBe('baseline');
  expect(decideMode(at(23, 59), low, 'low')).toBe('compare');
});

test('decideMode: second daytime record only between 12 and 20, 30 minutes after the first', () => {
  const one = [session(at(17, 0))];
  expect(decideMode(at(17, 29), one, 'normal')).toBe('compare');
  expect(decideMode(at(17, 30), one, 'normal')).toBe('baseline');
  expect(decideMode(at(19, 59), one, 'normal')).toBe('baseline');
  expect(decideMode(at(20, 0), one, 'normal')).toBe('compare');
  expect(decideMode(at(23, 59), one, 'normal')).toBe('compare');
  expect(decideMode(at(0, 0), one, 'normal')).toBe('compare');
  expect(decideMode(at(2, 59), one, 'normal')).toBe('compare');
  expect(decideMode(at(3, 0), one, 'normal')).toBe('compare');
  const d = (h: number, m: number) => new Date(2026, 10, 14, h, m);
  const morning = [session(d(11, 0))];
  expect(decideMode(d(11, 59), morning, 'normal')).toBe('compare');
  expect(decideMode(d(12, 0), morning, 'normal')).toBe('baseline');
  const two = [session(at(17, 0)), session(at(18, 30))];
  expect(decideMode(at(19, 30), two, 'normal')).toBe('compare');
});

test('baselinesFor: same class and length, most recent first, at most three', () => {
  const all = [
    session(at(13, 0)),
    session(at(14, 0), { justWoke: true }),
    session(at(15, 0), { hzClass: 'low' }),
    session(at(16, 0)),
    session(at(17, 0), { lengthS: 180 }),
    session(at(18, 0)),
    session(at(19, 0)),
    session(at(23, 0), { mode: 'compare' }),
  ];
  expect(baselinesFor(all, 'normal', 90).map((s) => s.localHour)).toEqual([19, 18, 16]);
  expect(baselinesFor(all, 'normal', 180).map((s) => s.localHour)).toEqual([17]);
  expect(baselinesFor(all, 'low', 90).map((s) => s.localHour)).toEqual([15]);
});

test('compare cooldown is 30 minutes', () => {
  const s = [session(at(0, 0), { mode: 'compare' })];
  expect(compareCooldownMin(at(0, 10), s)).toBe(20);
  expect(compareCooldownMin(at(0, 30), s)).toBe(0);
  expect(compareCooldownMin(at(0, 10), [])).toBe(0);
});

test('hours awake from a wake-up time', () => {
  const now = new Date(2026, 10, 15, 2, 10); // 02:10
  expect(hoursAwake('01:40', 'today', now)).toBe(1); // 30 min rounds up
  expect(hoursAwake('02:10', 'today', now)).toBe(0);
  expect(hoursAwake('08:00', 'today', now)).toBe(18); // still ahead today: yesterday 08:00
  expect(hoursAwake('08:00', 'yesterday', now)).toBe(18);
  expect(hoursAwake('01:00', 'yesterday', now)).toBe(25);
  expect(wakeIsAhead('08:00', now)).toBe(true);
  expect(wakeIsAhead('01:00', now)).toBe(false);

  const evening = new Date(2026, 10, 14, 23, 30);
  expect(hoursAwake('07:30', 'today', evening)).toBe(16);
  expect(hoursAwake('07:30', 'yesterday', evening)).toBe(40);
  expect(hoursAwake('', 'today', evening)).toBeNull();
});
