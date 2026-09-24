'use client';

import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { DeltaPill, DIRECTION_GLYPHS, formatChange } from '@/components/charts/delta-pill';
import { ChartLegend, LineChart, type ChartPoint } from '@/components/charts/line-chart';
import { VERDICT_TEXT } from '@/components/charts/verdict';
import { brandButton, darkCard, lightCard } from '@/components/ui/surfaces';
import { useDashboardTheme } from '@/hooks/use-dashboard-theme';
import { changeBetween, directionOf, verdictOf } from '@/lib/change';
import { cn } from '@/lib/utils';
import { selectionQuery } from '../api/client';
import type { MetricDetailDto } from '../api/schemas';
import { METRICS, type MetricDefinition, type MetricKey } from '../domain/metrics';
import { dateOf, GRANULARITIES, isGranularity, type Granularity, type RangeSelection } from '../domain/time';
import { Segmented } from './controls';
import { formatBucket, formatMetricValue, formatPartialNote, formatPeriod, formatTick } from './format';
import { RangeBar } from './range-bar';
import { selectionFromParams } from './ranges';
import { CHART_BLUE } from './styles';
import { useMetricDetail } from './use-metrics';

const SERIES_LABELS = { current: 'This period', previous: 'Comparison period' };

const GRANULARITY_LABELS: Record<Granularity, string> = { hour: 'Hour', day: 'Day', week: 'Week', month: 'Month' };

/** The table's rows as a file, so the numbers can leave the page. */
function downloadCsv(detail: MetricDetailDto) {
  const header = ['start', 'end', 'hours', detail.metric, 'comparison_period'];
  const rows = detail.points.map((point) => [point.start, point.end, point.hours, point.value, point.previous]);
  const csv = `${[header, ...rows].map((row) => row.join(',')).join('\n')}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = `sculptors-${detail.metric}-${dateOf(detail.period.start)}-${detail.granularity}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * One metric at full size, after RevenueCat's chart pages: back to the
 * panel, the same range bar with the bucket size beside it (both in the
 * URL), the period's number against the comparison period, a large chart
 * with the comparison under it, and every bucket in a table (newest first)
 * that downloads as CSV.
 */
export function MetricDetailScreen({ metric }: { metric: MetricKey }) {
  const definition = METRICS[metric];
  const theme = useDashboardTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selection = useMemo(() => selectionFromParams(searchParams), [searchParams]);
  const requested = searchParams.get('granularity');
  const requestedGranularity = requested && isGranularity(requested) ? requested : null;
  const { data, error, loading, retry } = useMetricDetail(metric, selection, requestedGranularity);
  const query = selectionQuery(selection);

  // A new range lets the server pick its bucket size; a new bucket size keeps the range.
  const onSelectionChange = (next: RangeSelection) => {
    router.replace(`${pathname}?${selectionQuery(next).toString()}`, { scroll: false });
  };
  const onGranularityChange = (next: Granularity) => {
    const nextQuery = selectionQuery(selection);

    nextQuery.set('granularity', next);
    router.replace(`${pathname}?${nextQuery.toString()}`, { scroll: false });
  };

  return (
    <section className="min-h-full px-6 pb-14 pt-6 text-[var(--dashboard-text)] lg:px-10">
      <Link
        href={`/dashboard?${query.toString()}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-full pl-1 pr-3 text-[13px] font-medium text-[var(--dashboard-text-muted)] transition-colors hover:bg-[var(--dashboard-fill)] hover:text-[var(--dashboard-text)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Store Events Panel
      </Link>

      <header className="mt-3">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{definition.label}</h1>
        <p className="mt-1 text-[14px] text-[var(--dashboard-text-muted)]">{definition.description}</p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <RangeBar selection={selection} onChange={onSelectionChange} />
        <Segmented
          label="Bucket size"
          options={GRANULARITIES.map((value) => ({
            value,
            label: GRANULARITY_LABELS[value],
            disabled: !data?.granularities.includes(value),
          }))}
          // Until the answer arrives, the size the URL asks for, if it is one; else none.
          value={data?.granularity ?? requestedGranularity}
          onChange={onGranularityChange}
        />
        <button
          type="button"
          className={cn(brandButton, 'ml-auto')}
          disabled={!data}
          onClick={() => {
            if (data) downloadCsv(data);
          }}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download CSV
        </button>
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
        <MetricDetailBody detail={data} definition={definition} loading={loading} />
      ) : !error ? (
        <div className="mt-8" aria-busy="true">
          <div className="h-12 w-56 animate-pulse rounded-[12px] bg-[var(--dashboard-fill-strong)]" />
          <div className={cn(theme === 'dark' ? darkCard : lightCard, 'mt-6 h-[440px] animate-pulse')} />
          <span className="sr-only">Loading {definition.label}</span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The period's number, its chart, and every bucket in a table. Drawn only
 * once an answer has arrived, so the bucket size and the currency are always
 * the answer's own, never a placeholder standing in while it loads.
 */
function MetricDetailBody({
  detail,
  definition,
  loading,
}: {
  detail: MetricDetailDto;
  definition: MetricDefinition;
  loading: boolean;
}) {
  const theme = useDashboardTheme();
  const { granularity } = detail;
  const format = (value: number) => formatMetricValue(value, definition.unit, detail.currency);
  const points: ChartPoint[] = detail.points.map((point) => ({
    tick: formatTick(point, granularity),
    label: formatBucket(point, granularity),
    note: formatPartialNote(point, granularity),
    partial: point.partial,
    value: point.value,
    previous: point.previous,
  }));
  const hasPartial = points.some((point) => point.partial);

  return (
    <div className={cn('transition-opacity duration-200', loading && 'opacity-60')} aria-busy={loading}>
      <div className="mt-8 flex flex-wrap items-end gap-x-4 gap-y-2">
        <p className="text-[48px] font-semibold leading-none tracking-[-0.03em]">{format(detail.value)}</p>
        <DeltaPill change={detail.change} higherIsBetter={definition.higherIsBetter} tone={theme} className="mb-1.5" />
      </div>
      <p className="mt-2 text-[13px] text-[var(--dashboard-text-muted)]">
        {definition.caption} · {formatPeriod(detail.period)} · {format(detail.previous)} in{' '}
        {formatPeriod(detail.comparison)}
      </p>

      <div className={cn(theme === 'dark' ? darkCard : lightCard, 'mt-6 p-6')}>
        <ChartLegend
          color={CHART_BLUE[theme]}
          labels={SERIES_LABELS}
          tone={theme}
          partialLabel={hasPartial ? `Partial ${granularity}` : undefined}
        />
        <div className="mt-3">
          <LineChart
            points={points}
            height={360}
            color={CHART_BLUE[theme]}
            tone={theme}
            formatValue={format}
            formatAxis={(value) => formatMetricValue(value, definition.unit, detail.currency, { compact: true })}
            ariaLabel={`${definition.label} by ${granularity}, ${formatPeriod(detail.period)}, against the comparison period`}
            seriesLabels={SERIES_LABELS}
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[16px] border border-[var(--dashboard-line)]">
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">
              {definition.label} by {granularity}, newest first, with the comparison period
            </caption>
            <thead className="sticky top-0 z-10 bg-[var(--dashboard-table-head)] text-left text-[12px] font-semibold text-[var(--dashboard-text-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {GRANULARITY_LABELS[granularity]}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  {definition.label}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Comparison period
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Change
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...detail.points].reverse().map((point) => {
                const change = changeBetween(point.value, point.previous);
                const direction = directionOf(change);
                const verdict = verdictOf(direction, definition.higherIsBetter);

                return (
                  <tr key={point.start} className="border-t border-[var(--dashboard-line)]">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-[var(--dashboard-text)]">
                      {formatBucket(point, granularity)}
                      {point.partial ? <span className="ml-2 text-[12px] font-normal text-[var(--dashboard-text-muted)]">partial</span> : null}
                    </th>
                    <td className="px-4 py-2.5 text-right text-[var(--dashboard-text)]">{format(point.value)}</td>
                    <td className="px-4 py-2.5 text-right text-[var(--dashboard-text-muted)]">{format(point.previous)}</td>
                    <td className={cn('px-4 py-2.5 text-right font-medium', VERDICT_TEXT[theme][verdict])}>
                      <span aria-hidden="true" className="mr-1 text-[9px]">
                        {DIRECTION_GLYPHS[direction]}
                      </span>
                      {formatChange(change)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
