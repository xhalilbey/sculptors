import type { HealthSource } from '../application/ports';
import {
  COMPONENT_KEYS,
  dateOf,
  dayNumber,
  type ComponentKey,
  type Incident,
  type IncidentImpact,
  type IncidentUpdate,
  type IsoDate,
} from '../domain/system';

/**
 * Demo numbers for System Health until the probes and the incident log
 * exist. Deterministic: the same day always has the same incident (or
 * none), so a reload does not rewrite history. About one day in three has an
 * incident on one component, most of them minor, and the uptime bars move
 * with them, so the page reads as one account of one system. Today has
 * none: a demo should not open on an alarm.
 */

const SEED = 0x5c1b7a11;

/** How often each part is the one in trouble. */
const COMPONENT_WEIGHTS: Record<ComponentKey, number> = {
  dashboard: 0.08,
  'agents-api': 0.22,
  'agent-engine': 0.22,
  events: 0.14,
  webhooks: 0.12,
  channels: 0.16,
  database: 0.06,
};

const TEMPLATES: Record<
  ComponentKey,
  { minor: string; major: string; investigating: string; identified: string; monitoring: string }
> = {
  dashboard: {
    minor: 'Slow dashboard loads for some users',
    major: 'Dashboard unavailable',
    investigating: 'We are looking into slow page loads on the dashboard.',
    identified: 'A slow query behind the panels was found; a fix is rolling out.',
    monitoring: 'Pages load normally again. We are watching it.',
  },
  'agents-api': {
    minor: 'Elevated latency on the Agents API',
    major: 'Agents API returning errors',
    investigating: 'Some requests to the Agents API are slower than usual or failing. We are investigating.',
    identified: 'An overloaded node pool is the cause; capacity is being added.',
    monitoring: 'Latency is back to normal. We are monitoring.',
  },
  'agent-engine': {
    minor: 'Agent replies delayed',
    major: 'Agents not answering',
    investigating: 'Agents are taking longer than usual to answer. We are investigating.',
    identified: 'An upstream model provider is degraded; traffic is moving to a fallback.',
    monitoring: 'Replies are back to their usual speed. We are monitoring.',
  },
  events: {
    minor: 'Delayed event ingestion',
    major: 'Store events not being ingested',
    investigating: 'Events from the SDKs are reaching the panels late. We are investigating.',
    identified: 'An ingestion queue backed up; it is draining now.',
    monitoring: 'The backlog is cleared. The panels are current again.',
  },
  webhooks: {
    minor: 'Delayed webhook deliveries',
    major: 'Webhook deliveries failing',
    investigating: 'Some webhooks are being delivered late. We are investigating.',
    identified: 'A delivery worker was stuck; it has been restarted and retries are going out.',
    monitoring: 'Deliveries and retries are flowing normally.',
  },
  channels: {
    minor: 'Instagram messages delayed',
    major: 'WhatsApp messages not delivered',
    investigating: 'Messages on a channel are arriving late. We are investigating.',
    identified: 'The channel provider is rate limiting us; sends are being paced.',
    monitoring: 'Messages are flowing again. We are monitoring.',
  },
  database: {
    minor: 'Database latency elevated',
    major: 'Database connection errors',
    investigating: 'Some requests are slow because of the database. We are investigating.',
    identified: 'A connection pool was exhausted; its limits have been raised.',
    monitoring: 'The database is responding normally.',
  },
};

/** A repeatable number in [0, 1) for a day and a channel. */
function unit(day: number, channel: number): number {
  let x = (SEED ^ Math.imul(day, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca77)) >>> 0;

  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;

  return (x >>> 0) / 4_294_967_296;
}

function minuteInstant(day: number, minute: number): string {
  return `${new Date(day * 86_400_000 + minute * 60_000).toISOString().slice(0, 16)}Z`;
}

interface DayIncident {
  component: ComponentKey;
  impact: IncidentImpact;
  startMinute: number;
  durationMinutes: number;
}

/** The day's incident, if it has one. Only past days do. */
function incidentOn(day: number, today: number): DayIncident | null {
  if (day >= today || unit(day, 1) >= 0.35) return null;

  let pick = unit(day, 2);
  let component: ComponentKey = 'agents-api';

  for (const key of COMPONENT_KEYS) {
    pick -= COMPONENT_WEIGHTS[key];

    if (pick < 0) {
      component = key;
      break;
    }
  }

  const impact = unit(day, 3) < 0.22 ? 'major' : 'minor';

  return {
    component,
    impact,
    startMinute: 60 + Math.floor(unit(day, 4) * 1260),
    durationMinutes: 15 + Math.floor(unit(day, 5) * (impact === 'major' ? 150 : 90)),
  };
}

function incidentFrom(day: number, found: DayIncident): Incident {
  const text = TEMPLATES[found.component];
  const start = found.startMinute;
  const end = start + found.durationMinutes;
  const updates: IncidentUpdate[] = [
    { phase: 'investigating', at: minuteInstant(day, start), message: text.investigating },
    {
      phase: 'identified',
      at: minuteInstant(day, start + Math.round(found.durationMinutes * 0.35)),
      message: text.identified,
    },
  ];

  // Short incidents go straight from the fix to resolved.
  if (found.durationMinutes >= 25) {
    updates.push({
      phase: 'monitoring',
      at: minuteInstant(day, start + Math.round(found.durationMinutes * 0.7)),
      message: text.monitoring,
    });
  }

  updates.push({ phase: 'resolved', at: minuteInstant(day, end), message: 'This incident has been resolved.' });

  return {
    id: `inc_${day}`,
    component: found.component,
    impact: found.impact,
    title: text[found.impact],
    startedAt: minuteInstant(day, start),
    resolvedAt: minuteInstant(day, end),
    updates: updates.reverse(),
  };
}

function uptimeOn(component: ComponentKey, day: number, today: number): number {
  const found = incidentOn(day, today);

  if (!found || found.component !== component) return 1;

  // A major incident is downtime; a minor one counts as partial.
  const downtime = found.durationMinutes * (found.impact === 'major' ? 1 : 0.3);

  return 1 - downtime / 1440;
}

export function createDemoHealthSource(): HealthSource {
  return {
    kind: 'demo',

    dailyUptime({ component, days, now }) {
      const today = dayNumber(dateOf(now));

      return Promise.resolve(days.map((date) => uptimeOn(component, dayNumber(date), today)));
    },

    incidents({ from, to, now }: { from: IsoDate; to: IsoDate; now: Date }) {
      const today = dayNumber(dateOf(now));
      const found: Incident[] = [];

      for (let day = dayNumber(from); day <= dayNumber(to); day += 1) {
        const incident = incidentOn(day, today);

        if (incident) found.push(incidentFrom(day, incident));
      }

      return Promise.resolve(found);
    },
  };
}
