import { describe, expect, it } from 'vitest';
import type { OrganizationId } from '@/types/ids';
import { METRIC_KEYS, REVENUE_KPIS, REVENUE_SOURCES, type MetricKey } from '../domain/metrics';
import { hoursIn } from '../domain/time';
import { getMetricDetail } from './get-metric-detail';
import { getOverview } from './get-overview';
import type { MetricsSource } from './ports';

const NOW = new Date('2026-09-23T14:35:00Z');
const ORGANIZATION = 'org_01TEST' as OrganizationId;

/**
 * A source whose answers are easy to reason about: a metric is worth
 * (its position + 1) per hour, so an interval's value is its hours times
 * that.
 */
function fakeSource() {
  const perHour = (metric: MetricKey) => METRIC_KEYS.indexOf(metric) + 1;
  const source: MetricsSource = {
    kind: 'demo',
    currency: 'USD',
    totals: ({ metric, intervals }) => Promise.resolve(intervals.map((interval) => hoursIn(interval) * perHour(metric))),
    revenueBySource: () => Promise.resolve({ conversations: 50, catalogs: 20, comparisons: 10, 'discovery-pages': 20 }),
  };

  return { source, perHour };
}

describe('getOverview', () => {
  it('shows every metric, in order, against the period before, with a point per day', async () => {
    const { source, perHour } = fakeSource();
    const overview = await getOverview(source, { organizationId: ORGANIZATION, selection: { preset: '7d' }, now: NOW });

    expect(overview.period).toEqual({ start: '2026-09-16T00:00:00Z', end: '2026-09-23T00:00:00Z' });
    expect(overview.comparison).toEqual({ start: '2026-09-09T00:00:00Z', end: '2026-09-16T00:00:00Z' });
    expect(overview.granularity).toBe('day');
    expect(overview.metrics.map((metric) => metric.key)).toEqual([...METRIC_KEYS]);

    const purchases = overview.metrics.find((metric) => metric.key === 'purchases');

    expect(purchases?.value).toBe(168 * perHour('purchases'));
    expect(purchases?.series).toEqual(Array.from({ length: 7 }, () => 24 * perHour('purchases')));
  });

  it('compares Today with the same hours yesterday', async () => {
    const { source } = fakeSource();
    const overview = await getOverview(source, { organizationId: ORGANIZATION, selection: { preset: 'today' }, now: NOW });

    expect(overview.comparison).toEqual({ start: '2026-09-22T00:00:00Z', end: '2026-09-22T14:00:00Z' });
    expect(overview.granularity).toBe('hour');
    const revenue = overview.revenue.kpis.find((kpi) => kpi.key === 'revenue');

    expect(revenue?.points).toHaveLength(14);
    expect(revenue?.points[0]?.previous).toBe(revenue?.points[0]?.value);
  });

  it('works out the revenue figures, each with its own chart, from the totals', async () => {
    const { source, perHour } = fakeSource();
    const { revenue } = await getOverview(source, { organizationId: ORGANIZATION, selection: { preset: '7d' }, now: NOW });
    const byKey = Object.fromEntries(revenue.kpis.map((kpi) => [kpi.key, kpi]));

    expect(revenue.kpis.map((kpi) => kpi.key)).toEqual([...REVENUE_KPIS]);
    expect(byKey.orders?.value).toBe(168 * perHour('purchases'));
    expect(byKey['average-order-value']?.value).toBeCloseTo(perHour('revenue') / perHour('purchases'));
    expect(byKey['refund-rate']?.value).toBeCloseTo(perHour('refunds') / perHour('purchases'));
    // A ratio's bucket is the ratio of its buckets: the same here in every day.
    expect(byKey['average-order-value']?.points.map((point) => point.value)).toEqual(
      Array.from({ length: 7 }, () => perHour('revenue') / perHour('purchases'))
    );
    expect(revenue.bySource.map((entry) => entry.source)).toEqual([...REVENUE_SOURCES]);
    expect(revenue.bySource.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1);
  });
});

describe('getMetricDetail', () => {
  it('uses the bucket size asked for when the period offers it', async () => {
    const { source } = fakeSource();
    const detail = await getMetricDetail(source, {
      organizationId: ORGANIZATION,
      metric: 'revenue',
      selection: { preset: '12m' },
      granularity: 'month',
      now: NOW,
    });

    expect(detail.granularity).toBe('month');
    expect(detail.granularities).toEqual(['day', 'week', 'month']);
    expect(detail.points[0]?.partial).toBe(true);
    expect(detail.points).toHaveLength(13);
  });

  it("falls back to the period's own bucket size when the one asked for is not offered", async () => {
    const { source } = fakeSource();
    const detail = await getMetricDetail(source, {
      organizationId: ORGANIZATION,
      metric: 'refunds',
      selection: { preset: 'yesterday' },
      granularity: 'month',
      now: NOW,
    });

    expect(detail.granularity).toBe('hour');
    expect(detail.points).toHaveLength(24);
  });
});
