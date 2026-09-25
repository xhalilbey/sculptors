import type { OrganizationId } from '@/types/ids';
import type { MetricKey, RevenueSource } from '../domain/metrics';
import type { TimeInterval } from '../domain/time';

/** 'demo' until the agents report real events. */
export const SOURCE_KINDS = ['demo', 'live'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface TotalsQuery {
  organizationId: OrganizationId;
  metric: MetricKey;
  intervals: readonly TimeInterval[];
}

/**
 * Where the numbers come from. The use cases take it as an argument, so the
 * demo generator and, later, the event store are interchangeable behind it.
 */
export interface MetricsSource {
  readonly kind: SourceKind;
  /** ISO 4217 code revenue is counted in. */
  readonly currency: string;
  /**
   * One value per interval, in the order given, aggregated the metric's own
   * way (see Aggregation): an interval's value is not always the sum of its
   * hours' values.
   */
  totals(query: TotalsQuery): Promise<number[]>;
  /** Revenue in one interval, split by the agent surface the order came through. */
  revenueBySource(query: { organizationId: OrganizationId; interval: TimeInterval }): Promise<Record<RevenueSource, number>>;
}
