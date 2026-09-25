'use client';

import { useEffect, useState } from 'react';
import { DashboardThemeOverride, type DashboardTheme } from '@/hooks/use-dashboard-theme';
import type { OrganizationId } from '@/types/ids';
import { selectionQuery } from '../api/client';
import type { OverviewDto } from '../api/schemas';
import { getOverview } from '../application/get-overview';
import { createDemoMetricsSource } from '../infrastructure/demo-metrics-source';
import { formatBucket } from './format';
import { MetricTile } from './metric-tile';
import { RangeBar } from './range-bar';
import { DEFAULT_SELECTION } from './ranges';
import { RevenuePanel } from './revenue-panel';

/**
 * The app's real Overview -- the Store Events Panel -- drawn inside the
 * landing hero's tilted sheet (owner's direction, 24 Sep 2026: "make it the
 * real dashboard, the Overview"). Not a picture of it: the same tiles,
 * range bar and revenue panel the app renders, fed by the same demo source
 * the app's /api/metrics serves before real events arrive. Change the
 * Overview and the landing follows.
 *
 * The numbers are computed in the browser for a fixed demo store, so the
 * public page makes no API call and needs no session.
 */
const DEMO_STORE = 'org_01DEMOSTORE' as OrganizationId;

export function OverviewPreview({ theme }: { readonly theme: DashboardTheme }) {
  const [overview, setOverview] = useState<OverviewDto | null>(null);

  useEffect(() => {
    let live = true;

    void getOverview(createDemoMetricsSource(), {
      organizationId: DEMO_STORE,
      selection: DEFAULT_SELECTION,
      now: new Date(),
    }).then((result) => {
      if (live) setOverview(result);
    });

    return () => {
      live = false;
    };
  }, []);

  const query = selectionQuery(DEFAULT_SELECTION).toString();
  const bucketLabels = overview
    ? (overview.revenue.kpis[0]?.points ?? []).map((point) => formatBucket(point, overview.granularity))
    : [];

  return (
    <DashboardThemeOverride value={theme}>
      <div className="iso-overview" data-dashboard-theme={theme}>
        <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em]">Store Events Panel</h1>
        <div className="mt-5">
          {/* The bar is shown, not driven: the sheet is a picture of the page. */}
          <RangeBar selection={DEFAULT_SELECTION} onChange={() => undefined} />
        </div>
        {overview ? (
          <>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {overview.metrics.map((summary) => (
                <MetricTile
                  key={summary.key}
                  summary={summary}
                  currency={overview.currency}
                  bucketLabels={bucketLabels}
                  query={query}
                />
              ))}
            </div>
            <RevenuePanel overview={overview} query={query} className="mt-4" />
          </>
        ) : null}
      </div>
    </DashboardThemeOverride>
  );
}
