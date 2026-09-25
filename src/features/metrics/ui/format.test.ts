import { describe, expect, it } from 'vitest';
import { formatBucket, formatKpi, formatMoney, formatPartialNote, formatPeriod, formatTick } from './format';

describe('formatPeriod', () => {
  it('writes a stretch of days with the year once', () => {
    expect(formatPeriod({ start: '2026-08-24T00:00:00Z', end: '2026-09-23T00:00:00Z' })).toMatch(/^Aug 24\s–\sSep 22, 2026$/);
  });

  it('writes a single whole day once', () => {
    expect(formatPeriod({ start: '2026-09-22T00:00:00Z', end: '2026-09-23T00:00:00Z' })).toBe('Sep 22, 2026');
  });

  it('writes part of a day as its hours', () => {
    expect(formatPeriod({ start: '2026-09-23T00:00:00Z', end: '2026-09-23T14:00:00Z' })).toBe(
      'Sep 23, 2026, 00:00–14:00 UTC'
    );
  });
});

describe('buckets', () => {
  const week = { start: '2026-09-14T00:00:00Z', end: '2026-09-21T00:00:00Z', hours: 168, partial: false };
  const clipped = { start: '2026-09-21T00:00:00Z', end: '2026-09-23T00:00:00Z', hours: 48, partial: true };

  it('heads a week with its span and ticks it with its first day', () => {
    expect(formatBucket(week, 'week')).toMatch(/^Sep 14\s–\s20, 2026$/);
    expect(formatTick(week, 'week')).toBe('Sep 14');
  });

  it('heads an hour with its clock time', () => {
    expect(formatBucket({ start: '2026-09-23T13:00:00Z', end: '2026-09-23T14:00:00Z', hours: 1, partial: false }, 'hour')).toBe(
      'Sep 23, 13:00–14:00'
    );
  });

  it('notes how much of a clipped bucket is in range', () => {
    expect(formatPartialNote(clipped, 'week')).toBe('2 days of this week in range');
    expect(formatPartialNote(week, 'week')).toBeUndefined();
  });
});

describe('formatMoney', () => {
  it('writes totals whole, small amounts with cents, and axes compact', () => {
    expect(formatMoney(333_978.4, 'USD')).toBe('$333,978');
    expect(formatMoney(53.834, 'USD', { cents: true })).toBe('$53.83');
    expect(formatMoney(15_000, 'USD', { compact: true })).toBe('$15K');
  });
});

describe('formatKpi', () => {
  it('writes each revenue figure in its own unit', () => {
    expect(formatKpi(333_978.4, 'currency', 'USD')).toBe('$333,978');
    expect(formatKpi(53.8, 'currency-cents', 'USD')).toBe('$53.80');
    expect(formatKpi(0.05, 'percent', 'USD')).toBe('5.0%');
    expect(formatKpi(1_284.6, 'count', 'USD')).toBe('1,285');
  });

  it('writes the chart axis compact, with no trailing .0 on money', () => {
    expect(formatKpi(15_000, 'currency', 'USD', true)).toBe('$15K');
    expect(formatKpi(15_000, 'currency-cents', 'USD', true)).toBe('$15K');
    expect(formatKpi(1_284.6, 'count', 'USD', true)).toBe('1.3K');
    expect(formatKpi(0.05, 'percent', 'USD', true)).toBe('5.0%');
  });

  it('writes a dash for a ratio with nothing to divide by', () => {
    expect(formatKpi(null, 'percent', 'USD')).toBe('\u2014');
    expect(formatKpi(null, 'currency-cents', 'USD', true)).toBe('\u2014');
  });
});
