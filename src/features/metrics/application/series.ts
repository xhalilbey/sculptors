import type { OrganizationId } from '@/types/ids';
import type { MetricKey } from '../domain/metrics';
import { shiftHours, type Bucket, type Instant } from '../domain/time';
import type { MetricsSource } from './ports';

export interface SeriesPoint {
  start: Instant;
  end: Instant;
  hours: number;
  /** Cut short by the period's edge: fewer hours than a whole day, week or month. */
  partial: boolean;
  value: number;
  /** The same hours in the comparison period. */
  previous: number;
}

/**
 * The period's buckets, each beside its counterpart in the comparison
 * period: the bucket moved back by the comparison offset, so the two always
 * cover the same number of hours, even when a week or month is clipped.
 */
export async function seriesFor(
  source: MetricsSource,
  query: { organizationId: OrganizationId; metric: MetricKey; buckets: readonly Bucket[]; offset: number }
): Promise<SeriesPoint[]> {
  const { organizationId, metric, buckets, offset } = query;
  const [values, previous] = await Promise.all([
    source.totals({ organizationId, metric, intervals: buckets }),
    source.totals({ organizationId, metric, intervals: buckets.map((bucket) => shiftHours(bucket, -offset)) }),
  ]);

  return buckets.map((bucket, index) => ({
    start: bucket.start,
    end: bucket.end,
    hours: bucket.hours,
    partial: bucket.partial,
    value: values[index] ?? 0,
    previous: previous[index] ?? 0,
  }));
}
