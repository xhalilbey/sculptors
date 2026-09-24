import { changeBetween, type Change } from '@/lib/change';
import type { OrganizationId } from '@/types/ids';
import {
  METRIC_KEYS,
  REVENUE_SOURCES,
  type MetricKey,
  type RevenueKpi,
  type RevenueSource,
} from '../domain/metrics';
import {
  bucketsOf,
  comparisonOffset,
  defaultGranularity,
  periodOf,
  shiftHours,
  type Granularity,
  type RangeSelection,
  type TimeInterval,
} from '../domain/time';
import type { MetricsSource, SourceKind } from './ports';
import { seriesFor, type SeriesPoint } from './series';

export interface MetricSummary {
  key: MetricKey;
  value: number;
  previous: number;
  change: Change;
  /** The period in buckets, oldest first: the tile's sparkline. */
  series: number[];
}

/**
 * One of the revenue panel's figures: its total and the comparison's (null
 * when a ratio has nothing to divide by), and its buckets for the chart. A
 * ratio's bucket is 0 where the bucket has no denominator.
 */
export interface RevenueKpiSeries {
  key: RevenueKpi;
  value: number | null;
  previous: number | null;
  change: Change;
  points: SeriesPoint[];
}

export interface RevenueOverview {
  /** Revenue, orders, average order value, revenue per engaged user, refund rate. */
  kpis: RevenueKpiSeries[];
  bySource: Array<{ source: RevenueSource; value: number; share: number }>;
}

export interface Overview {
  source: SourceKind;
  currency: string;
  selection: RangeSelection;
  period: TimeInterval;
  comparison: TimeInterval;
  /** The bucket size of every series on the page. */
  granularity: Granularity;
  /** Every metric, in METRIC_KEYS order. */
  metrics: MetricSummary[];
  revenue: RevenueOverview;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** Everything the Store Events Panel shows for one range. */
export async function getOverview(
  source: MetricsSource,
  input: { organizationId: OrganizationId; selection: RangeSelection; now: Date }
): Promise<Overview> {
  const { organizationId, selection, now } = input;
  const period = periodOf(selection, now);
  const offset = comparisonOffset(selection, period);
  const comparison = shiftHours(period, -offset);
  const granularity = defaultGranularity(period);
  const buckets = bucketsOf(period, granularity);

  const [metrics, [revenuePoints, orderPoints, engagedPoints, refundPoints], revenueBySource] = await Promise.all([
    Promise.all(
      METRIC_KEYS.map(async (key): Promise<MetricSummary> => {
        const [totals, series] = await Promise.all([
          source.totals({ organizationId, metric: key, intervals: [period, comparison] }),
          source.totals({ organizationId, metric: key, intervals: buckets }),
        ]);
        const value = totals[0] ?? 0;
        const previous = totals[1] ?? 0;

        return { key, value, previous, change: changeBetween(value, previous), series };
      })
    ),
    Promise.all([
      seriesFor(source, { organizationId, metric: 'revenue', buckets, offset }),
      seriesFor(source, { organizationId, metric: 'purchases', buckets, offset }),
      seriesFor(source, { organizationId, metric: 'engaged-users', buckets, offset }),
      seriesFor(source, { organizationId, metric: 'refunds', buckets, offset }),
    ]),
    source.revenueBySource({ organizationId, interval: period }),
  ]);

  const summaryOf = (key: MetricKey) => metrics.find((metric) => metric.key === key);
  const current = (key: MetricKey) => summaryOf(key)?.value ?? 0;
  const earlier = (key: MetricKey) => summaryOf(key)?.previous ?? 0;
  const sourcesTotal = REVENUE_SOURCES.reduce((sum, key) => sum + revenueBySource[key], 0);

  const kpi = (
    key: RevenueKpi,
    value: number | null,
    previous: number | null,
    points: SeriesPoint[]
  ): RevenueKpiSeries => ({ key, value, previous, change: changeBetween(value ?? 0, previous ?? 0), points });

  const ratioPoints = (numerator: SeriesPoint[], denominator: SeriesPoint[]): SeriesPoint[] =>
    numerator.map((point, index) => ({
      ...point,
      value: ratio(point.value, denominator[index]?.value ?? 0) ?? 0,
      previous: ratio(point.previous, denominator[index]?.previous ?? 0) ?? 0,
    }));

  return {
    source: source.kind,
    currency: source.currency,
    selection,
    period,
    comparison,
    granularity,
    metrics,
    revenue: {
      kpis: [
        kpi('revenue', current('revenue'), earlier('revenue'), revenuePoints),
        kpi('orders', current('purchases'), earlier('purchases'), orderPoints),
        kpi(
          'average-order-value',
          ratio(current('revenue'), current('purchases')),
          ratio(earlier('revenue'), earlier('purchases')),
          ratioPoints(revenuePoints, orderPoints)
        ),
        kpi(
          'revenue-per-user',
          ratio(current('revenue'), current('engaged-users')),
          ratio(earlier('revenue'), earlier('engaged-users')),
          ratioPoints(revenuePoints, engagedPoints)
        ),
        kpi(
          'refund-rate',
          ratio(current('refunds'), current('purchases')),
          ratio(earlier('refunds'), earlier('purchases')),
          ratioPoints(refundPoints, orderPoints)
        ),
      ],
      bySource: REVENUE_SOURCES.map((key) => ({
        source: key,
        value: revenueBySource[key],
        share: ratio(revenueBySource[key], sourcesTotal) ?? 0,
      })),
    },
  };
}
