'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError } from '@/lib/clients/api-error';
import { fetchMetricDetail, fetchOverview, selectionQuery } from '../api/client';
import type { MetricDetailDto, OverviewDto } from '../api/schemas';
import type { MetricKey } from '../domain/metrics';
import type { Granularity, RangeSelection } from '../domain/time';

export interface Remote<T> {
  /** The latest answer; while a new request runs, still the previous one. */
  data: T | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
}

interface Settled<T> {
  key: string;
  data: T | null;
  error: string | null;
}

function messageOf(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : 'Something went wrong. Please try again.';
}

/**
 * One request per key, the previous answer kept on screen while the next
 * one loads (the page dims it rather than blanking), a superseded request
 * aborted. `load` must be stable for a key (useCallback on the key's parts).
 */
function useRemote<T>(requestKey: string, load: (signal: AbortSignal) => Promise<T>): Remote<T> {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const key = `${requestKey}#${attempt}`;

  useEffect(() => {
    const controller = new AbortController();

    load(controller.signal).then(
      (data) => setSettled({ key, data, error: null }),
      (error: unknown) => {
        if (controller.signal.aborted) return;

        setSettled((previous) => ({ key, data: previous?.data ?? null, error: messageOf(error) }));
      }
    );

    return () => controller.abort();
  }, [key, load]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return {
    data: settled?.data ?? null,
    error: settled?.key === key ? settled.error : null,
    loading: settled?.key !== key,
    retry,
  };
}

/** `selection` must be stable while the URL does not change (memoize it on the search params). */
export function useOverview(selection: RangeSelection): Remote<OverviewDto> {
  const load = useCallback((signal: AbortSignal) => fetchOverview(selection, signal), [selection]);

  return useRemote(selectionQuery(selection).toString(), load);
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

  return useRemote(`${metric}?${selectionQuery(selection).toString()}&granularity=${granularity ?? ''}`, load);
}
