import {
  dateOf,
  daysEnding,
  statusOfImpact,
  statusOfUptime,
  SYSTEM_COMPONENTS,
  worstStatus,
  type ComponentKey,
  type Incident,
  type IsoDate,
  type Status,
} from '../domain/system';
import type { HealthSource, HealthSourceKind } from './ports';

/** How far back the uptime bars reach, and how many days Past Incidents lists -- a status page's 90 and 15. */
export const UPTIME_DAYS = 90;
export const INCIDENT_DAYS = 15;

/** One bar: a day's uptime, how it went, and the titles of the incidents that started on it. */
export interface DayReport {
  date: IsoDate;
  uptime: number;
  status: Status;
  incidents: string[];
}

export interface ComponentReport {
  key: ComponentKey;
  name: string;
  description: string;
  /** Now: an open incident on it decides; otherwise it is operational. */
  status: Status;
  /** The mean of its daily uptimes over the bars. */
  uptime: number;
  days: DayReport[];
}

export interface HealthReport {
  source: HealthSourceKind;
  /** When the report was made, to the minute. */
  checkedAt: string;
  /** The worst of the components now: the banner. */
  overall: Status;
  components: ComponentReport[];
  /** The last fifteen days, today first, each with the incidents that started on it (maybe none). */
  pastIncidents: Array<{ date: IsoDate; incidents: Incident[] }>;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function startedOn(date: IsoDate) {
  return (incident: Incident) => incident.startedAt.slice(0, 10) === date;
}

/**
 * How a day went. An incident we declared says how bad it was -- a minor one
 * is a degraded day however long it ran, as on a status page; without one,
 * the day's uptime decides (the probes can see downtime nobody declared).
 */
function dayOf(date: IsoDate, uptime: number, incidents: readonly Incident[]): DayReport {
  return {
    date,
    uptime,
    status: incidents.length > 0 ? worstStatus(incidents.map((incident) => statusOfImpact(incident.impact))) : statusOfUptime(uptime),
    incidents: incidents.map((incident) => incident.title),
  };
}

/** System Health: the state now, each part over 90 days, and the last fifteen days' incidents. */
export async function getHealthReport(source: HealthSource, input: { now: Date }): Promise<HealthReport> {
  const { now } = input;
  const today = dateOf(now);
  const barDays = daysEnding(today, UPTIME_DAYS);

  const [uptimes, incidents] = await Promise.all([
    Promise.all(SYSTEM_COMPONENTS.map((component) => source.dailyUptime({ component: component.key, days: barDays, now }))),
    source.incidents({ from: barDays[0] ?? today, to: today, now }),
  ]);

  const components: ComponentReport[] = SYSTEM_COMPONENTS.map((component, index) => {
    const daily = uptimes[index] ?? [];
    const own = incidents.filter((incident) => incident.component === component.key);
    const open = own.filter((incident) => incident.resolvedAt === null);

    return {
      key: component.key,
      name: component.name,
      description: component.description,
      status: worstStatus(open.map((incident) => statusOfImpact(incident.impact))),
      uptime: mean(daily),
      days: barDays.map((date, day) => dayOf(date, daily[day] ?? 1, own.filter(startedOn(date)))),
    };
  });

  return {
    source: source.kind,
    checkedAt: `${now.toISOString().slice(0, 16)}Z`,
    overall: worstStatus(components.map((component) => component.status)),
    components,
    pastIncidents: daysEnding(today, INCIDENT_DAYS)
      .reverse()
      .map((date) => ({
        date,
        incidents: incidents.filter(startedOn(date)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      })),
  };
}
