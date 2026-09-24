import { describe, expect, it } from 'vitest';
import { addDays, daysEnding, statusOfImpact, statusOfUptime, worstStatus } from './system';

describe('statusOfUptime', () => {
  it('calls 99.9% operational, 99% degraded, and less an outage', () => {
    expect(statusOfUptime(1)).toBe('operational');
    expect(statusOfUptime(0.999)).toBe('operational');
    expect(statusOfUptime(0.9989)).toBe('degraded');
    expect(statusOfUptime(0.99)).toBe('degraded');
    expect(statusOfUptime(0.9899)).toBe('outage');
  });
});

describe('statusOfImpact', () => {
  it('degrades a part on a minor incident and takes it out on a major one', () => {
    expect(statusOfImpact('minor')).toBe('degraded');
    expect(statusOfImpact('major')).toBe('outage');
  });
});

describe('worstStatus', () => {
  it('is the worst of them, and operational when there are none', () => {
    expect(worstStatus([])).toBe('operational');
    expect(worstStatus(['operational', 'degraded', 'operational'])).toBe('degraded');
    expect(worstStatus(['degraded', 'outage', 'operational'])).toBe('outage');
  });
});

describe('the calendar', () => {
  it('counts days in UTC across month ends, oldest first', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysEnding('2026-09-02', 3)).toEqual(['2026-08-31', '2026-09-01', '2026-09-02']);
  });
});
