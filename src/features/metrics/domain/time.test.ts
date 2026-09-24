import { describe, expect, it } from 'vitest';
import {
  addMonths,
  bucketsOf,
  comparisonOffset,
  customRangeProblem,
  defaultGranularity,
  granularitiesFor,
  hoursIn,
  isIsoDate,
  periodOf,
  type RangeSelection,
} from './time';

const NOW = new Date('2026-09-23T14:35:00Z');

function days(selection: RangeSelection) {
  return hoursIn(periodOf(selection, NOW)) / 24;
}

describe('periodOf', () => {
  it('ends every preset but Today at the midnight that starts today', () => {
    expect(periodOf({ preset: 'yesterday' }, NOW)).toEqual({
      start: '2026-09-22T00:00:00Z',
      end: '2026-09-23T00:00:00Z',
    });
    expect(periodOf({ preset: '7d' }, NOW)).toEqual({ start: '2026-09-16T00:00:00Z', end: '2026-09-23T00:00:00Z' });
    expect(periodOf({ preset: '30d' }, NOW).start).toBe('2026-08-24T00:00:00Z');
  });

  it('counts months by the calendar', () => {
    expect(periodOf({ preset: '3m' }, NOW).start).toBe('2026-06-23T00:00:00Z');
    expect(periodOf({ preset: '6m' }, NOW).start).toBe('2026-03-23T00:00:00Z');
    expect(days({ preset: '12m' })).toBe(365);
  });

  it('makes Today the complete hours so far, and at least one', () => {
    expect(periodOf({ preset: 'today' }, NOW)).toEqual({ start: '2026-09-23T00:00:00Z', end: '2026-09-23T14:00:00Z' });
    expect(hoursIn(periodOf({ preset: 'today' }, new Date('2026-09-23T00:20:00Z')))).toBe(1);
  });

  it('includes both days of a custom range', () => {
    expect(periodOf({ from: '2026-08-01', to: '2026-08-31' }, NOW)).toEqual({
      start: '2026-08-01T00:00:00Z',
      end: '2026-09-01T00:00:00Z',
    });
  });
});

describe('comparisonOffset', () => {
  it('compares Today with the same hours yesterday, and a range with the one before it', () => {
    expect(comparisonOffset({ preset: 'today' }, periodOf({ preset: 'today' }, NOW))).toBe(24);
    expect(comparisonOffset({ preset: '7d' }, periodOf({ preset: '7d' }, NOW))).toBe(168);
  });
});

describe('addMonths', () => {
  it('lands on the last day of a shorter month', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29');
    expect(addMonths('2026-01-15', 12)).toBe('2027-01-15');
  });
});

describe('bucketsOf', () => {
  it('cuts weeks on Mondays and marks the clipped ends', () => {
    // 2026-09-16 is a Wednesday; the period ends before Wednesday 23rd.
    const buckets = bucketsOf(periodOf({ preset: '7d' }, NOW), 'week');

    expect(buckets.map((bucket) => [bucket.start.slice(0, 10), bucket.hours / 24, bucket.partial])).toEqual([
      ['2026-09-16', 5, true],
      ['2026-09-21', 2, true],
    ]);
  });

  it('cuts months on the first and hours on the hour', () => {
    const months = bucketsOf({ start: '2026-06-23T00:00:00Z', end: '2026-09-23T00:00:00Z' }, 'month');

    expect(months.map((bucket) => bucket.start.slice(0, 10))).toEqual(['2026-06-23', '2026-07-01', '2026-08-01', '2026-09-01']);
    expect(months.map((bucket) => bucket.partial)).toEqual([true, false, false, true]);
    expect(bucketsOf(periodOf({ preset: 'today' }, NOW), 'hour')).toHaveLength(14);
  });

  it('covers the period exactly, without gaps or overlaps', () => {
    const period = periodOf({ preset: '12m' }, NOW);
    const buckets = bucketsOf(period, 'week');

    expect(buckets[0]?.start).toBe(period.start);
    expect(buckets.at(-1)?.end).toBe(period.end);
    expect(buckets.reduce((sum, bucket) => sum + bucket.hours, 0)).toBe(hoursIn(period));
    buckets.slice(1).forEach((bucket, index) => expect(bucket.start).toBe(buckets[index]?.end));
  });
});

describe('granularities', () => {
  it('offers hours for a day, days for a week, and more as the period grows', () => {
    expect(granularitiesFor(periodOf({ preset: 'yesterday' }, NOW))).toEqual(['hour']);
    expect(granularitiesFor(periodOf({ preset: '7d' }, NOW))).toEqual(['day']);
    expect(granularitiesFor(periodOf({ preset: '30d' }, NOW))).toEqual(['day', 'week']);
    expect(granularitiesFor(periodOf({ preset: '12m' }, NOW))).toEqual(['day', 'week', 'month']);
  });

  it('opens each preset on a readable number of points', () => {
    expect(defaultGranularity(periodOf({ preset: 'today' }, NOW))).toBe('hour');
    expect(defaultGranularity(periodOf({ preset: '30d' }, NOW))).toBe('day');
    expect(defaultGranularity(periodOf({ preset: '3m' }, NOW))).toBe('week');
  });
});

describe('customRangeProblem', () => {
  it('accepts a range that ends today or earlier', () => {
    expect(customRangeProblem('2026-09-01', '2026-09-23', NOW)).toBeNull();
  });

  it('refuses a reversed, future, oversized or impossible range', () => {
    expect(customRangeProblem('2026-09-10', '2026-09-01', NOW)).toMatch(/after the end/);
    expect(customRangeProblem('2026-09-01', '2026-09-24', NOW)).toMatch(/future/);
    expect(customRangeProblem('2024-01-01', '2026-09-01', NOW)).toMatch(/two years/);
    expect(customRangeProblem('2026-02-30', '2026-03-01', NOW)).toMatch(/both days/);
  });
});

describe('isIsoDate', () => {
  it('accepts only real calendar days', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('26-02-28')).toBe(false);
  });
});
