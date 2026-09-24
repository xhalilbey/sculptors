import { describe, expect, it } from 'vitest';
import type { ComponentKey, Incident } from '../domain/system';
import { getHealthReport, INCIDENT_DAYS, UPTIME_DAYS } from './get-health-report';
import type { HealthSource } from './ports';

const NOW = new Date('2026-09-23T14:35:00Z');

function incident(overrides: Partial<Incident> & Pick<Incident, 'id' | 'startedAt'>): Incident {
  return {
    component: 'agents-api',
    impact: 'minor',
    title: `Incident ${overrides.id}`,
    resolvedAt: overrides.startedAt,
    updates: [],
    ...overrides,
  };
}

/** A source whose every number is set by the test. */
function sourceWith({
  uptime = () => 1,
  incidents = [],
}: {
  uptime?: (component: ComponentKey, date: string) => number;
  incidents?: Incident[];
}): HealthSource {
  return {
    kind: 'demo',
    dailyUptime: ({ component, days }) => Promise.resolve(days.map((date) => uptime(component, date))),
    incidents: ({ from, to }) =>
      Promise.resolve(incidents.filter((found) => found.startedAt.slice(0, 10) >= from && found.startedAt.slice(0, 10) <= to)),
  };
}

describe('getHealthReport', () => {
  it('draws every component over 90 days ending today', async () => {
    const report = await getHealthReport(sourceWith({}), { now: NOW });

    expect(report.components).toHaveLength(7);
    expect(report.components.every((component) => component.days.length === UPTIME_DAYS)).toBe(true);
    expect(report.components[0]?.days.at(-1)?.date).toBe('2026-09-23');
    expect(report.components[0]?.days[0]?.date).toBe('2026-06-26');
    expect(report.overall).toBe('operational');
    expect(report.checkedAt).toBe('2026-09-23T14:35Z');
  });

  it('lets a declared incident say how bad its day was, and the uptime decide a day without one', async () => {
    const report = await getHealthReport(
      sourceWith({
        // A long minor incident on the 20th, and on the 21st downtime nobody declared.
        uptime: (component, date) =>
          component === 'agents-api' && date === '2026-09-20' ? 0.97 : component === 'webhooks' && date === '2026-09-21' ? 0.995 : 1,
        incidents: [incident({ id: 'a', startedAt: '2026-09-20T10:00Z' })],
      }),
      { now: NOW }
    );
    const api = report.components.find((component) => component.key === 'agents-api');
    const webhooks = report.components.find((component) => component.key === 'webhooks');

    expect(api?.days.find((day) => day.date === '2026-09-20')).toMatchObject({ status: 'degraded', incidents: ['Incident a'] });
    expect(webhooks?.days.find((day) => day.date === '2026-09-21')).toMatchObject({ status: 'degraded', incidents: [] });
    expect(api?.days.find((day) => day.date === '2026-09-21')?.status).toBe('operational');
  });

  it('marks a part down only while an incident on it is open', async () => {
    const report = await getHealthReport(
      sourceWith({
        incidents: [
          incident({ id: 'open', component: 'channels', impact: 'major', startedAt: '2026-09-23T13:10Z', resolvedAt: null }),
          incident({ id: 'closed', component: 'events', impact: 'major', startedAt: '2026-09-23T09:00Z' }),
        ],
      }),
      { now: NOW }
    );

    expect(report.components.find((component) => component.key === 'channels')?.status).toBe('outage');
    expect(report.components.find((component) => component.key === 'events')?.status).toBe('operational');
    expect(report.overall).toBe('outage');
  });

  it('lists the last fifteen days, today first, each day newest incident first', async () => {
    const report = await getHealthReport(
      sourceWith({
        incidents: [
          incident({ id: 'early', startedAt: '2026-09-20T02:00Z' }),
          incident({ id: 'late', startedAt: '2026-09-20T18:00Z' }),
          incident({ id: 'too-old', startedAt: '2026-09-08T12:00Z' }),
        ],
      }),
      { now: NOW }
    );

    expect(report.pastIncidents).toHaveLength(INCIDENT_DAYS);
    expect(report.pastIncidents[0]).toEqual({ date: '2026-09-23', incidents: [] });
    expect(report.pastIncidents.at(-1)?.date).toBe('2026-09-09');
    expect(report.pastIncidents.find((day) => day.date === '2026-09-20')?.incidents.map((found) => found.id)).toEqual([
      'late',
      'early',
    ]);
    expect(report.pastIncidents.flatMap((day) => day.incidents).some((found) => found.id === 'too-old')).toBe(false);
  });
});
