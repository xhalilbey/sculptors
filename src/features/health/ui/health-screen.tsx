'use client';

import { CircleHelp } from 'lucide-react';
import { useState } from 'react';
import type { Tone } from '@/components/charts/verdict';
import { useDashboardTheme } from '@/hooks/use-dashboard-theme';
import { useRemote } from '@/hooks/use-remote';
import { cn } from '@/lib/utils';
import { fetchHealthReport } from '../api/client';
import type { HealthReportDto } from '../api/schemas';
import { statusOfImpact, type IncidentPhase, type Status } from '../domain/system';

/**
 * System Health, laid out as the status pages of Cursor and Anthropic are
 * (Atlassian Statuspage), which the owner asked it to match (23 Sep 2026):
 * a banner with the state now, every component with 90 days of bars and its
 * uptime, and the last fifteen days of incidents with their updates. It
 * replaced a panel of emerald health tiles. The page follows the dashboard
 * theme; the status colours are Cursor's green and Statuspage's yellow and
 * red, deepened where a colour is text on the light ground.
 */

const STATUS: Record<
  Status,
  { label: string; headline: string; banner: string; bar: string; text: Record<Tone, string> }
> = {
  operational: {
    label: 'Operational',
    headline: 'All Systems Operational',
    banner: '#1e8542',
    bar: '#1e8542',
    text: { dark: '#3fb96f', light: '#1e8542' },
  },
  degraded: {
    label: 'Degraded Performance',
    headline: 'Partially Degraded Service',
    banner: '#e67e22',
    bar: '#f1c40f',
    text: { dark: '#f1c40f', light: '#b8860b' },
  },
  outage: {
    label: 'Major Outage',
    headline: 'Major Service Outage',
    banner: '#e74c3c',
    bar: '#e74c3c',
    text: { dark: '#ff6b5b', light: '#c0392b' },
  },
};

const PHASES: Record<IncidentPhase, string> = {
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

const tooltipDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const headingDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const updateDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const updateClock = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });

const atMidnight = (date: string) => new Date(`${date}T00:00:00Z`);

/** As a status page writes it: at most two decimals, at least one -- "99.5", "99.66", "100.0". */
function formatUptime(uptime: number): string {
  const text = (uptime * 100).toFixed(2).replace(/0$/, '');

  return text.endsWith('.') ? `${text}0` : text;
}

/** "Sep 22, 13:45 UTC". */
function formatUpdateTime(instant: string): string {
  const at = new Date(instant);

  return `${updateDay.format(at)}, ${updateClock.format(at)} UTC`;
}

type Day = HealthReportDto['components'][number]['days'][number];

/**
 * The 90 bars, drawn as a status page draws them: 3 units wide on a 5-unit
 * step, stretched to the row. Each day is hovered through a full-step strip,
 * so the gaps between bars answer too.
 */
function UptimeBars({ days, tone, label }: { days: readonly Day[]; tone: Tone; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const hovered = active === null ? undefined : days[active];
  const width = days.length * 5 - 2;

  return (
    <div className="relative mt-2">
      <svg
        viewBox={`0 0 ${width} 34`}
        preserveAspectRatio="none"
        className="block h-[34px] w-full"
        role="img"
        aria-label={label}
        onPointerLeave={() => setActive(null)}
      >
        {days.map((day, index) => (
          <rect
            key={day.date}
            x={index * 5}
            y={0}
            width={3}
            height={34}
            fill={STATUS[day.status].bar}
            opacity={active === index ? 0.72 : 1}
          />
        ))}
        {days.map((day, index) => (
          <rect
            key={`${day.date}-hit`}
            x={index * 5 - 1}
            y={0}
            width={5}
            height={34}
            fill="transparent"
            onPointerEnter={() => setActive(index)}
          />
        ))}
      </svg>
      {hovered && active !== null ? (
        <div
          className={cn(
            'pointer-events-none absolute bottom-full z-10 mb-2 w-[240px] -translate-x-1/2 rounded-[6px] border px-3.5 py-3 text-[13px] leading-5',
            tone === 'dark'
              ? 'border-white/10 bg-[#1c1c1f] text-white shadow-[0_10px_28px_rgba(0,0,0,0.55)]'
              : 'border-black/10 bg-white text-[#333333] shadow-[0_10px_28px_rgba(0,0,0,0.14)]'
          )}
          style={{ left: `${Math.min(88, Math.max(12, ((active + 0.5) / days.length) * 100))}%` }}
        >
          <p className="font-semibold">{tooltipDay.format(atMidnight(hovered.date))}</p>
          {hovered.status === 'operational' && hovered.incidents.length === 0 ? (
            <p className="mt-1 text-[var(--dashboard-text-muted)]">No downtime recorded on this day.</p>
          ) : (
            <>
              <p className="mt-1 font-medium" style={{ color: STATUS[hovered.status].text[tone] }}>
                {STATUS[hovered.status].label}
              </p>
              {hovered.incidents.length > 0 ? (
                <div className="mt-2 border-t border-[var(--dashboard-line)] pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--dashboard-text-muted)]">Related</p>
                  {hovered.incidents.map((title) => (
                    <p key={title} className="mt-0.5">
                      {title}
                    </p>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ComponentRow({ component, tone }: { component: HealthReportDto['components'][number]; tone: Tone }) {
  const troubled = component.days.filter((day) => day.status !== 'operational').length;

  return (
    <li className="border-t border-[var(--dashboard-line)] px-5 pb-3.5 pt-4 first:border-t-0">
      <div className="flex items-center justify-between gap-4">
        <p className="flex min-w-0 items-center gap-1.5 text-[16px] font-medium text-[var(--dashboard-text)]">
          <span className="truncate">{component.name}</span>
          <span title={component.description} className="shrink-0 text-[var(--dashboard-text-muted)]">
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{component.description}</span>
          </span>
        </p>
        <p className="shrink-0 text-[14px]" style={{ color: STATUS[component.status].text[tone] }}>
          {STATUS[component.status].label}
        </p>
      </div>
      <UptimeBars
        days={component.days}
        tone={tone}
        label={`${formatUptime(component.uptime)}% uptime over the past 90 days; ${troubled} ${troubled === 1 ? 'day' : 'days'} with incidents`}
      />
      <div className="mt-1.5 flex items-center gap-4 text-[13px] text-[var(--dashboard-text-muted)]">
        <span className="shrink-0">90 days ago</span>
        <span className="h-px flex-1 bg-current opacity-35" aria-hidden="true" />
        <span className="shrink-0">{formatUptime(component.uptime)} % uptime</span>
        <span className="h-px flex-1 bg-current opacity-35" aria-hidden="true" />
        <span className="shrink-0">Today</span>
      </div>
    </li>
  );
}

function PastIncidents({ days, tone }: { days: HealthReportDto['pastIncidents']; tone: Tone }) {
  return (
    <section aria-labelledby="past-incidents" className="mt-16">
      <h2 id="past-incidents" className="text-[28px] font-medium tracking-[-0.01em] text-[var(--dashboard-text)]">
        Past Incidents
      </h2>
      {days.map(({ date, incidents }, index) => (
        <section key={date} className="mt-7">
          <h3 className="border-b border-[var(--dashboard-line)] pb-2 text-[18px] font-medium text-[var(--dashboard-text)]">
            {headingDay.format(atMidnight(date))}
          </h3>
          {incidents.length === 0 ? (
            <p className="mt-3 text-[15px] text-[var(--dashboard-text-muted)]">
              {index === 0 ? 'No incidents reported today.' : 'No incidents reported.'}
            </p>
          ) : (
            incidents.map((incident) => (
              <article key={incident.id} className="mt-4">
                <h4
                  className="text-[20px] font-medium leading-7"
                  style={{ color: STATUS[statusOfImpact(incident.impact)].text[tone] }}
                >
                  {incident.title}
                </h4>
                {incident.updates.map((update) => (
                  <div key={`${update.phase}-${update.at}`} className="mt-3">
                    <p className="text-[15px] leading-6 text-[var(--dashboard-text)]">
                      <strong className="font-bold">{PHASES[update.phase]}</strong> - {update.message}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[var(--dashboard-text-muted)]">{formatUpdateTime(update.at)}</p>
                  </div>
                ))}
              </article>
            ))
          )}
        </section>
      ))}
    </section>
  );
}

export function HealthScreen() {
  const theme = useDashboardTheme();
  const { data: report, error, retry } = useRemote(fetchHealthReport);

  return (
    <section className="min-h-full px-6 pb-16 pt-8 text-[var(--dashboard-text)] lg:px-10">
      <div className="max-w-[850px]">
        <h1 className="text-[32px] font-bold leading-10 tracking-[-0.025em]">System Health</h1>

        {error && !report ? (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-[var(--dashboard-line)] px-5 py-4">
            <p className="text-[14px] text-[var(--dashboard-text-muted)]">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="h-9 rounded-[4px] border border-[var(--dashboard-line)] px-4 text-[13px] font-semibold transition-colors hover:bg-[var(--dashboard-fill-strong)]"
            >
              Try again
            </button>
          </div>
        ) : null}

        {report ? (
          <>
            <div
              role="status"
              className="mt-8 rounded-[4px] px-5 py-[18px] text-[20px] font-semibold text-white"
              style={{ backgroundColor: STATUS[report.overall].banner }}
            >
              {STATUS[report.overall].headline}
            </div>

            <p className="mt-14 text-right text-[13px] text-[var(--dashboard-text-muted)]">Uptime over the past 90 days.</p>
            <ul className="mt-2 rounded-[4px] border border-[var(--dashboard-line)]">
              {report.components.map((component) => (
                <ComponentRow key={component.key} component={component} tone={theme} />
              ))}
            </ul>

            <PastIncidents days={report.pastIncidents} tone={theme} />
          </>
        ) : !error ? (
          <div className="mt-8" aria-busy="true">
            <div className="h-[66px] animate-pulse rounded-[4px] bg-[var(--dashboard-fill-strong)]" />
            <div className="mt-[88px] h-[560px] animate-pulse rounded-[4px] border border-[var(--dashboard-line)] bg-[var(--dashboard-fill)]" />
            <span className="sr-only">Loading System Health</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
