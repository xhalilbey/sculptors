'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DeltaPill } from '@/components/charts/delta-pill';
import { ChartLegend, LineChart, type ChartPoint } from '@/components/charts/line-chart';
import { darkCard, lightCard } from '@/components/ui/surfaces';
import { useDashboardTheme } from '@/hooks/use-dashboard-theme';
import { cn } from '@/lib/utils';
import type { OverviewDto } from '../api/schemas';
import {
  REVENUE_KPI_DEFINITIONS,
  REVENUE_SOURCE_LABELS,
  type RevenueKpi,
} from '../domain/metrics';
import { formatBucket, formatKpi, formatMoney, formatPartialNote, formatPercent, formatPeriod, formatTick } from './format';
import { CHART_BLUE, KPI_KEY, SOURCE_COLORS } from './styles';

const SERIES_LABELS = { current: 'This period', previous: 'Comparison period' };

/**
 * The wide panel under the tiles. Simpler than it was, and more capable
 * (owner's direction, 23 Sep 2026): one strip of figures -- revenue, orders,
 * average order value, revenue per engaged user, refund rate -- each a tab
 * with its change, a chart of whichever is chosen against the comparison
 * period, and where the revenue came from as a single bar in steps of the
 * chart blue (one hue, lightness only), each source named beside its dot.
 */
export function RevenuePanel({ overview, query, className }: { overview: OverviewDto; query: string; className?: string }) {
  const theme = useDashboardTheme();
  const sourceColors = SOURCE_COLORS[theme];
  const { comparison, currency, granularity, period, revenue } = overview;
  const [activeKey, setActiveKey] = useState<RevenueKpi>('revenue');
  const active = revenue.kpis.find((kpi) => kpi.key === activeKey) ?? revenue.kpis[0];
  const sourcesTotal = revenue.bySource.reduce((sum, entry) => sum + entry.value, 0);

  if (!active) return null;

  const definition = REVENUE_KPI_DEFINITIONS[active.key];
  const points: ChartPoint[] = active.points.map((point) => ({
    tick: formatTick(point, granularity),
    label: formatBucket(point, granularity),
    note: formatPartialNote(point, granularity),
    partial: point.partial,
    value: point.value,
    previous: point.previous,
  }));
  const hasPartial = points.some((point) => point.partial);

  return (
    <section className={cn(theme === 'dark' ? darkCard : lightCard, className)} aria-labelledby="revenue-panel-title">
      <header className="flex items-start justify-between gap-4 px-6 pt-5">
        <div>
          <h2 id="revenue-panel-title" className="text-[15px] font-semibold text-[var(--card-text)]">
            Revenue
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--card-text-faint)]">
            {formatPeriod(period)} vs {formatPeriod(comparison)}
          </p>
        </div>
        <Link
          href={`/dashboard/revenue?${query}`}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-[var(--card-text-muted)] transition-colors hover:bg-[var(--card-fill)] hover:text-[var(--card-text)]"
        >
          Full report
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </header>

      <div className="mt-4 grid grid-cols-2 border-y border-[var(--card-line)] sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Revenue figures">
        {revenue.kpis.map((kpi) => {
          const kpiDefinition = REVENUE_KPI_DEFINITIONS[kpi.key];
          const selected = kpi.key === active.key;

          return (
            <button
              key={kpi.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveKey(kpi.key)}
              className={cn(
                'group relative px-6 py-4 text-left',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#4f7dff]'
              )}
            >
              {/* The chosen one rises as a key; hovering another shows a faint one. */}
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-1.5 rounded-[14px] transition-[opacity,transform] duration-200 ease-out',
                  KPI_KEY[theme],
                  selected ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-0 group-hover:scale-100 group-hover:opacity-40'
                )}
              />
              <span className="relative block">
                <span className={cn('block text-[12px]', selected ? 'text-[var(--card-text-soft)]' : 'text-[var(--card-text-faint)]')}>
                  {kpiDefinition.label}
                </span>
                <span className="mt-1.5 block text-[22px] font-semibold tabular-nums tracking-[-0.01em] text-[var(--card-text)]">
                  {formatKpi(kpi.value, kpiDefinition.unit, currency)}
                </span>
                <DeltaPill change={kpi.change} higherIsBetter={kpiDefinition.higherIsBetter} tone={theme} className="mt-2" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-6 pb-4 pt-5">
        <ChartLegend
          color={CHART_BLUE[theme]}
          labels={SERIES_LABELS}
          tone={theme}
          partialLabel={hasPartial ? `Partial ${granularity}` : undefined}
        />
        <div className="mt-3">
          <LineChart
            points={points}
            height={260}
            color={CHART_BLUE[theme]}
            tone={theme}
            formatValue={(value) => formatKpi(value, definition.unit, currency)}
            formatAxis={(value) => formatKpi(value, definition.unit, currency, true)}
            ariaLabel={`${definition.label} by ${granularity}, ${formatPeriod(period)}, against the comparison period`}
            seriesLabels={SERIES_LABELS}
          />
        </div>
      </div>

      <div className="border-t border-[var(--card-line)] px-6 py-5">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-[12px] font-medium text-[var(--card-text-muted)]">Revenue by source</h3>
          <span className="text-[12px] tabular-nums text-[var(--card-text-faint)]">{formatMoney(sourcesTotal, currency)}</span>
        </div>
        <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
          {revenue.bySource.map((entry, index) => (
            <span
              key={entry.source}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${entry.share * 100}%`, backgroundColor: sourceColors[index % sourceColors.length] }}
            />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
          {revenue.bySource.map((entry, index) => (
            <li key={entry.source} className="flex min-w-0 items-center gap-2 text-[12px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: sourceColors[index % sourceColors.length] }}
                aria-hidden="true"
              />
              <span className="truncate text-[var(--card-text-soft)]">{REVENUE_SOURCE_LABELS[entry.source]}</span>
              <span className="ml-auto shrink-0 tabular-nums text-[var(--card-text-faint)]">{formatPercent(entry.share)}</span>
              <span className="shrink-0 tabular-nums text-[var(--card-text)]">{formatMoney(entry.value, currency)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
