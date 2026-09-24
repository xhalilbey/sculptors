'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { darkCard, lightCard } from '@/components/ui/surfaces';
import { useDashboardTheme } from '@/hooks/use-dashboard-theme';
import { cn } from '@/lib/utils';
import { selectionQuery } from '../api/client';
import { METRIC_KEYS } from '../domain/metrics';
import type { RangeSelection } from '../domain/time';
import { formatBucket } from './format';
import { MetricTile } from './metric-tile';
import { RangeBar } from './range-bar';
import { selectionFromParams } from './ranges';
import { RevenuePanel } from './revenue-panel';
import { useOverview } from './use-metrics';

/**
 * The Store Events Panel (the rail's Overview): what the agents did for the
 * store over a range -- a tile per metric, each opening its own chart, and
 * revenue across the full width under them.
 *
 * The heading is only its name, with the range bar under it (owner's
 * direction, 23 Sep 2026). The range lives in the URL, so a view can be
 * shared and the back button returns to it, and every tile carries it into
 * the metric's own page.
 */
export function OverviewScreen() {
  const theme = useDashboardTheme();
  const card = theme === 'dark' ? darkCard : lightCard;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selection = useMemo(() => selectionFromParams(searchParams), [searchParams]);
  const query = selectionQuery(selection).toString();
  const { data, error, loading, retry } = useOverview(selection);
  const bucketLabels = data
    ? (data.revenue.kpis[0]?.points ?? []).map((point) => formatBucket(point, data.granularity))
    : [];

  const onSelectionChange = (next: RangeSelection) => {
    router.replace(`${pathname}?${selectionQuery(next).toString()}`, { scroll: false });
  };

  return (
    <section className="min-h-full px-6 pb-14 pt-8 text-[var(--dashboard-text)] lg:px-10">
      <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em]">Store Events Panel</h1>

      <div className="mt-5">
        <RangeBar selection={selection} onChange={onSelectionChange} />
      </div>

      {error ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[var(--dashboard-line)] bg-[var(--dashboard-fill)] px-5 py-4">
          <p className="text-[14px] text-[var(--dashboard-text-muted)]">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="h-9 rounded-full border border-[var(--dashboard-line)] bg-[var(--dashboard-fill)] px-4 text-[13px] font-semibold text-[var(--dashboard-text)] transition-colors hover:bg-[var(--dashboard-fill-strong)]"
          >
            Try again
          </button>
        </div>
      ) : null}

      {data ? (
        <div className={cn('transition-opacity duration-200', loading && 'opacity-60')} aria-busy={loading}>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.metrics.map((summary) => (
              <MetricTile
                key={summary.key}
                summary={summary}
                currency={data.currency}
                bucketLabels={bucketLabels}
                query={query}
              />
            ))}
          </div>
          <RevenuePanel overview={data} query={query} className="mt-4" />
        </div>
      ) : !error ? (
        <div className="mt-6" aria-busy="true">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: METRIC_KEYS.length }, (_, index) => (
              <div key={index} className={cn(card, 'min-h-[236px] animate-pulse')} />
            ))}
          </div>
          <div className={cn(card, 'mt-4 h-[560px] animate-pulse')} />
          <span className="sr-only">Loading the panel</span>
        </div>
      ) : null}
    </section>
  );
}
