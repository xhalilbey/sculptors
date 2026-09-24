'use client';

import Link from 'next/link';
import { DeltaPill } from '@/components/charts/delta-pill';
import { Sparkline } from '@/components/charts/sparkline';
import { SERIES_COLORS } from '@/components/charts/verdict';
import { BAND_CAPTION, BLUE_BAND, darkCard, lightCard } from '@/components/ui/surfaces';
import { useDashboardTheme } from '@/hooks/use-dashboard-theme';
import { directionOf, verdictOf } from '@/lib/change';
import { cn } from '@/lib/utils';
import type { OverviewDto } from '../api/schemas';
import { METRICS } from '../domain/metrics';
import { formatMetricValue } from './format';

/**
 * One metric on the panel: its name and change at the top, its trend in the
 * middle in green or red by whether the change is good news, and the number
 * in a blue band at the foot, after the WorkOS AuthKit tile the owner
 * pointed to. The whole tile opens the metric's own chart for the same
 * range, where it can be read bucket by bucket.
 *
 * It does not move under the pointer (owner's direction, 23 Sep 2026); the
 * sparkline's own hover is the feedback.
 */
export function MetricTile({
  summary,
  currency,
  bucketLabels,
  query,
}: {
  summary: OverviewDto['metrics'][number];
  currency: string;
  /** One per point of the sparkline, for its hover. */
  bucketLabels: readonly string[];
  /** The panel's range, carried into the metric's page. */
  query: string;
}) {
  const theme = useDashboardTheme();
  const definition = METRICS[summary.key];
  const verdict = verdictOf(directionOf(summary.change), definition.higherIsBetter);
  const format = (value: number) => formatMetricValue(value, definition.unit, currency);

  return (
    <Link
      href={`/dashboard/${summary.key}?${query}`}
      className={cn(
        theme === 'dark' ? darkCard : lightCard,
        'flex min-h-[236px] flex-col',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4359ef]'
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <h3 className="text-[14px] font-medium leading-6 text-[var(--card-text-soft)]">{definition.label}</h3>
        <DeltaPill change={summary.change} higherIsBetter={definition.higherIsBetter} tone={theme} />
      </div>

      <div className="mt-3 px-3">
        <Sparkline
          values={summary.series}
          labels={bucketLabels}
          color={SERIES_COLORS[theme][verdict]}
          format={format}
          tone={theme}
        />
      </div>

      <div className={cn(BLUE_BAND[theme], 'm-2 mt-auto px-4 pb-4 pt-3.5')}>
        <p className="text-[30px] font-semibold leading-9 tracking-[-0.02em] text-white">{format(summary.value)}</p>
        <p className={cn('mt-0.5 text-[13px]', BAND_CAPTION[theme])}>{definition.caption}</p>
      </div>
    </Link>
  );
}
