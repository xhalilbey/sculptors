import type { DashboardTheme } from '@/hooks/use-dashboard-theme';

/**
 * The Store Events Panel's own surfaces, per theme. The shared ones live
 * elsewhere: the cards and the blue band in components/ui/surfaces.ts, the
 * good, bad and neutral colours in components/charts/verdict.ts.
 */

/** The charts' line: 5.0:1 on the dark card, 5.4:1 on white. */
export const CHART_BLUE: Record<DashboardTheme, string> = {
  dark: '#4f7dff',
  light: '#4359ef',
};

/** The revenue sources, one hue in steps of lightness, per theme. */
export const SOURCE_COLORS: Record<DashboardTheme, readonly string[]> = {
  dark: ['#4f7dff', '#7b9cff', '#a7bdff', '#d3deff'],
  light: ['#4359ef', '#6f80f3', '#9ba7f7', '#c7cefb'],
};

/**
 * The chosen figure in the revenue panel's strip: a raised key lit from
 * above in the chart blue, in the rail's active-key idiom. It replaced a
 * 2px accent line along the cell's top (owner's direction, 23 Sep 2026).
 */
export const KPI_KEY: Record<DashboardTheme, string> = {
  dark:
    'border border-transparent ' +
    '[background:radial-gradient(120%_90%_at_50%_0%,rgba(79,125,255,0.18),transparent_62%)_padding-box,linear-gradient(180deg,#2b2b30,#1d1d21)_padding-box,linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))_border-box] ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.5),0_10px_22px_-12px_rgba(0,0,0,0.9)]',
  light:
    'border border-transparent ' +
    '[background:radial-gradient(120%_90%_at_50%_0%,rgba(67,89,239,0.09),transparent_62%)_padding-box,linear-gradient(180deg,#ffffff,#f7f7f8)_padding-box,linear-gradient(180deg,rgba(25,25,25,0.12),rgba(25,25,25,0.05))_border-box] ' +
    'shadow-[inset_0_1px_0_#ffffff,0_1px_2px_rgba(25,25,25,0.06),0_10px_22px_-14px_rgba(25,25,25,0.35)]',
};
