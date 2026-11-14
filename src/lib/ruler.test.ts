import { expect, test } from 'vitest';
import { awakeBand, awakePos, expectedPct, rulerPos, usualRangePct } from './ruler';

test('usual range is one SD of the session-to-session difference', () => {
  expect(usualRangePct(90, 90, 1)).toBeCloseTo(100 * 0.07 * Math.SQRT2, 9); // 9.9
  expect(usualRangePct(180, 90, 2)).toBeCloseTo(100 * Math.sqrt(0.066 ** 2 + 0.07 ** 2 / 2), 9);
  expect(usualRangePct(180, 180, 1)).toBeCloseTo(100 * 0.066 * Math.SQRT2, 9);
});

test('ruler runs from 10% faster to 30% slower and pins values outside it', () => {
  expect(rulerPos(-10)).toEqual({ pos: 0, off: null });
  expect(rulerPos(0)).toEqual({ pos: 25, off: null });
  expect(rulerPos(18).pos).toBeCloseTo(70, 9);
  expect(rulerPos(30)).toEqual({ pos: 100, off: null });
  expect(rulerPos(40)).toEqual({ pos: 100, off: 'right' });
  expect(rulerPos(-25)).toEqual({ pos: 0, off: 'left' });
  expect([0, 1, 2].map((p) => expectedPct(p as 0 | 1 | 2))).toEqual([0, 10, 20]);
});

test('hours awake bands and positions', () => {
  expect([10, 16, 17, 20, 21, 23, 24, 40].map(awakeBand)).toEqual([-1, -1, 0, 0, 1, 1, 2, 2]);
  expect(awakePos(21)).toBeCloseTo(75, 9);
  expect(awakePos(40)).toBe(100);
});
