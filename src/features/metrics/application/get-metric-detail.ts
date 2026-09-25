import { changeBetween, type Change } from '@/lib/change';
import type { OrganizationId } from '@/types/ids';
import type { MetricKey } from '../domain/metrics';
import {
  bucketsOf,
  comparisonOffset,
  defaultGranularity,
  granularitiesFor,
  periodOf,
  shiftHours,
  type Granularity,
  type RangeSelection,
  type TimeInterval,
} from '../domain/time';
import type { MetricsSource, SourceKind } from './ports';
import { seriesFor, type SeriesPoint } from './series';

export interface MetricDetail {
  source: SourceKind;
  currency: string;
  metric: MetricKey;
  selection: RangeSelection;
  granularity: Granularity;
  /** The bucket sizes this period offers, for the page's control. */
  granularities: Granularity[];
  period: TimeInterval;
  comparison: TimeInterval;
  value: number;
  previous: number;
  change: Change;
  points: SeriesPoint[];
}

/**
 * One metric over one range, in buckets of the size asked for -- or the
 * period's default when none was asked for. The route answers a size the
 * period does not offer with a 400 (api/schemas.ts), so falling back to the
 * default here only guards a caller that skipped that schema.
 */
export async function getMetricDetail(
  source: MetricsSource,
  input: {
    organizationId: OrganizationId;
    metric: MetricKey;
    selection: RangeSelection;
    granularity?: Granularity;
    now: Date;
  }
): Promise<MetricDetail> {
  const { organizationId, metric, selection, now } = input;
  const period = periodOf(selection, now);
  const offset = comparisonOffset(selection, period);
  const comparison = shiftHours(period, -offset);
  const granularities = [...granularitiesFor(period)];
  const granularity =
    input.granularity && granularities.includes(input.granularity) ? input.granularity : defaultGranularity(period);

  const [totals, points] = await Promise.all([
    source.totals({ organizationId, metric, intervals: [period, comparison] }),
    seriesFor(source, { organizationId, metric, buckets: bucketsOf(period, granularity), offset }),
  ]);
  const value = totals[0] ?? 0;
  const previous = totals[1] ?? 0;

  return {
    source: source.kind,
    currency: source.currency,
    metric,
    selection,
    granularity,
    granularities,
    period,
    comparison,
    value,
    previous,
    change: changeBetween(value, previous),
    points,
  };
}
