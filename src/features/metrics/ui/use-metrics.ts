'use client';

import { useCallback } from 'react';
import { useRemote, type Remote } from '@/hooks/use-remote';
import { fetchMetricDetail, fetchOverview, selectionQuery } from '../api/client';
import type { MetricDetailDto, OverviewDto } from '../api/schemas';
import type { MetricKey } from '../domain/metrics';
import type { Granularity, RangeSelection } from '../domain/time';

/** `selection` must be stable while the URL does not change (memoize it on the search params). */
export function useOverview(selection: RangeSelection): Remote<OverviewDto> {
  const load = useCallback((signal: AbortSignal) => fetchOverview(selection, signal), [selection]);

  return useRemote(load, { key: selectionQuery(selection).toString() });
}

export function useMetricDetail(
  metric: MetricKey,
  selection: RangeSelection,
  granularity: Granularity | null
): Remote<MetricDetailDto> {
  const load = useCallback(
    (signal: AbortSignal) => fetchMetricDetail(metric, selection, granularity, signal),
    [metric, selection, granularity]
  );

  return useRemote(load, {
    key: `${metric}?${selectionQuery(selection).toString()}&granularity=${granularity ?? ''}`,
  });
}
