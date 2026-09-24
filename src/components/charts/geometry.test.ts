import { describe, expect, it } from 'vitest';
import { monotonePath, niceScale } from './geometry';

/** Every y coordinate in a path, control points included. */
function ysOf(path: string): number[] {
  const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

  return numbers.filter((_, index) => index % 2 === 1);
}

describe('monotonePath', () => {
  it('starts at the first point and ends at the last', () => {
    const path = monotonePath([
      { x: 0, y: 10 },
      { x: 10, y: 20 },
      { x: 20, y: 5 },
    ]);

    expect(path.startsWith('M0,10')).toBe(true);
    expect(path.endsWith(',20,5')).toBe(true);
  });

  it('never bulges past the data: no invented peaks or dips between points', () => {
    const points = [0, 12, 12, 40, 41, 3, 3, 30].map((y, index) => ({ x: index * 10, y }));
    const ys = ysOf(monotonePath(points));

    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(41);
  });

  it('draws a single point as a single move and nothing as nothing', () => {
    expect(monotonePath([{ x: 5, y: 5 }])).toBe('M5,5');
    expect(monotonePath([])).toBe('');
  });
});

describe('niceScale', () => {
  it('rounds the top up to a round step from zero', () => {
    expect(niceScale(9_430)).toEqual({ max: 10_000, ticks: [0, 2_500, 5_000, 7_500, 10_000] });
    expect(niceScale(37)).toEqual({ max: 40, ticks: [0, 10, 20, 30, 40] });
  });

  it('gives an empty series an axis of its own', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0] });
  });
});
