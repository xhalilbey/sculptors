import { getJson } from '@/lib/clients/api-error';
import type { MetricKey } from '../domain/metrics';
import type { Granularity, RangeSelection } from '../domain/time';
import {
  metricDetailResponseSchema,
  overviewResponseSchema,
  type MetricDetailDto,
  type OverviewDto,
} from './schemas';

/**
 * Browser calls to /api/metrics. Every response is parsed with its wire
 * schema. A non-2xx answer throws an ApiRequestError carrying the server's
 * (sanitized) message. A body that no longer matches its schema throws a
 * ZodError, and a network failure or an abort throws the browser's own
 * error; the UI shows a generic line for those and logs them (messageOf in
 * hooks/use-remote.ts).
 */

/** A selection as the API and the page URL both write it. */
export function selectionQuery(selection: RangeSelection): URLSearchParams {
  return new URLSearchParams(
    'from' in selection ? { range: 'custom', from: selection.from, to: selection.to } : { range: selection.preset }
  );
}

export async function fetchOverview(selection: RangeSelection, signal?: AbortSignal): Promise<OverviewDto> {
  const body = await getJson(
    `/api/metrics?${selectionQuery(selection).toString()}`,
    'Failed to load the panel',
    signal
  );

  return overviewResponseSchema.parse(body).overview;
}

export async function fetchMetricDetail(
  metric: MetricKey,
  selection: RangeSelection,
  granularity: Granularity | null,
  signal?: AbortSignal
): Promise<MetricDetailDto> {
  const query = selectionQuery(selection);

  if (granularity) query.set('granularity', granularity);

  const body = await getJson(
    `/api/metrics/${metric}?${query.toString()}`,
    'Failed to load this metric',
    signal
  );

  return metricDetailResponseSchema.parse(body).detail;
}
