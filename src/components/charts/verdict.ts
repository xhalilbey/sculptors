import type { DashboardTheme } from '@/hooks/use-dashboard-theme';
import type { Verdict } from '@/lib/change';

/**
 * Good news, bad news and no news, in colour, for charts on a dark card and
 * on white. Status colours: they always travel with an arrow and a sign,
 * never alone.
 */

/**
 * The surface a chart sits on: the dark card, or white. That is the
 * dashboard's theme, so the union is the theme's own, under a chart's name.
 */
export type Tone = DashboardTheme;

/**
 * Lines, each at least 3:1 on its surface: on the dark card (#151517) green
 * 8.7:1 and red 6.1:1; on white green 3.3:1 and red 3.9:1.
 */
export const SERIES_COLORS: Record<Tone, Record<Verdict, string>> = {
  dark: { good: '#2ecc71', bad: '#ff5d5d', neutral: 'rgba(255,255,255,0.55)' },
  light: { good: '#16a34a', bad: '#e5484d', neutral: 'rgba(25,25,25,0.4)' },
};

/** The delta pill. */
export const VERDICT_PILL: Record<Tone, Record<Verdict, string>> = {
  dark: {
    good: 'bg-[#2ecc71]/12 text-[#2ecc71]',
    bad: 'bg-[#ff5d5d]/12 text-[#ff5d5d]',
    neutral: 'bg-white/8 text-white/65',
  },
  light: {
    good: 'bg-[#1a7f45]/10 text-[#1a7f45]',
    bad: 'bg-[#c93b37]/10 text-[#c93b37]',
    neutral: 'bg-ink/5 text-ink/60',
  },
};

/** Change text in a table. */
export const VERDICT_TEXT: Record<Tone, Record<Verdict, string>> = {
  dark: { good: 'text-[#2ecc71]', bad: 'text-[#ff5d5d]', neutral: 'text-white/55' },
  light: { good: 'text-[#1a7f45]', bad: 'text-[#c93b37]', neutral: 'text-ink/55' },
};
