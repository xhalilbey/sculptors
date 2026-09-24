import { describe, expect, it } from 'vitest';
import type { OrganizationId } from '@/types/ids';
import { REVENUE_SOURCES, type MetricKey } from '../domain/metrics';
import { bucketsOf, type TimeInterval } from '../domain/time';
import { createDemoMetricsSource } from './demo-metrics-source';

const source = createDemoMetricsSource();
const STORE = 'org_01DEMOSTORE' as OrganizationId;
const OTHER = 'org_01OTHERSTORE' as OrganizationId;
const DAY: TimeInterval = { start: '2026-09-10T00:00:00Z', end: '2026-09-11T00:00:00Z' };
const MONTH: TimeInterval = { start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' };

async function total(metric: MetricKey, interval: TimeInterval, organizationId = STORE) {
  const [value] = await source.totals({ organizationId, metric, intervals: [interval] });

  return value ?? Number.NaN;
}

describe('the demo source', () => {
  it('gives the same store the same numbers every time, and another store different ones', async () => {
    expect(await total('purchases', MONTH)).toBe(await total('purchases', MONTH));
    expect(await total('purchases', MONTH)).not.toBe(await total('purchases', MONTH, OTHER));
  });

  it("makes a day exactly the sum of its hours", async () => {
    const hours = await source.totals({ organizationId: STORE, metric: 'add-to-cart', intervals: bucketsOf(DAY, 'hour') });

    expect(hours).toHaveLength(24);
    expect(hours.reduce((sum, value) => sum + value, 0)).toBe(await total('add-to-cart', DAY));
  });

  it('keeps the funnel in order: engaged, then cart, then purchase', async () => {
    const engaged = await total('engaged-users', DAY);
    const cart = await total('add-to-cart', DAY);
    const purchases = await total('purchases', DAY);

    expect(engaged).toBeGreaterThan(cart);
    expect(cart).toBeGreaterThan(purchases);
    expect(await total('refunds', MONTH)).toBeLessThan(await total('purchases', MONTH));
  });

  it('counts people once however many days they come back', async () => {
    const days = await source.totals({ organizationId: STORE, metric: 'engaged-users', intervals: bucketsOf(MONTH, 'day') });

    expect(await total('engaged-users', MONTH)).toBeLessThan(days.reduce((sum, value) => sum + value, 0));
  });

  it('splits revenue by source into parts that add up to the total', async () => {
    const split = await source.revenueBySource({ organizationId: STORE, interval: MONTH });
    const parts = REVENUE_SOURCES.reduce((sum, key) => sum + split[key], 0);

    expect(parts).toBeCloseTo(await total('revenue', MONTH), 2);
  });
});
