/**
 * What System Health reports on: the parts of our own system a customer's
 * store depends on, how each has done day by day, and the incidents --
 * laid out as the status pages of Cursor and Anthropic are (Atlassian
 * Statuspage), which the owner asked the page to match (23 Sep 2026).
 */

export const SYSTEM_COMPONENTS = [
  { key: 'dashboard', name: 'Dashboard', description: 'This app: sign-in, panels and settings.' },
  { key: 'agents-api', name: 'Agents API', description: 'The API your apps call to reach the agents.' },
  { key: 'agent-engine', name: 'Agent engine', description: 'Where the agents reason and answer.' },
  { key: 'events', name: 'Event ingestion', description: 'Store events from your web and app SDKs.' },
  { key: 'webhooks', name: 'Webhooks', description: 'Deliveries to your endpoints.' },
  { key: 'channels', name: 'Channel integrations', description: 'WhatsApp and Instagram messaging.' },
  { key: 'database', name: 'Database', description: "Where your store's data and settings live." },
] as const;

export type ComponentKey = (typeof SYSTEM_COMPONENTS)[number]['key'];

export const COMPONENT_KEYS = SYSTEM_COMPONENTS.map((component) => component.key) as readonly ComponentKey[];

export const STATUSES = ['operational', 'degraded', 'outage'] as const;

export type Status = (typeof STATUSES)[number];

const STATUS_RANK: Record<Status, number> = { operational: 0, degraded: 1, outage: 2 };

/**
 * A day's status from its uptime: at least 99.9% is operational, at least
 * 99% degraded, less an outage (about 14 minutes and 2.4 hours down).
 */
export function statusOfUptime(uptime: number): Status {
  if (uptime >= 0.999) return 'operational';
  if (uptime >= 0.99) return 'degraded';

  return 'outage';
}

export function worstStatus(statuses: readonly Status[]): Status {
  return statuses.reduce<Status>((worst, status) => (STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst), 'operational');
}

export const INCIDENT_IMPACTS = ['minor', 'major'] as const;

export type IncidentImpact = (typeof INCIDENT_IMPACTS)[number];

/** What an incident makes of the part it hits: minor degrades it, major takes it out. */
export function statusOfImpact(impact: IncidentImpact): Status {
  return impact === 'major' ? 'outage' : 'degraded';
}

export const INCIDENT_PHASES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;

export type IncidentPhase = (typeof INCIDENT_PHASES)[number];

export interface IncidentUpdate {
  phase: IncidentPhase;
  /** ISO instant, to the minute. */
  at: string;
  message: string;
}

export interface Incident {
  id: string;
  component: ComponentKey;
  impact: IncidentImpact;
  title: string;
  startedAt: string;
  /** Null while it is still open. */
  resolvedAt: string | null;
  /** Newest first, as a status page lists them. */
  updates: IncidentUpdate[];
}

/** Calendar days in UTC, 'YYYY-MM-DD'. */
export type IsoDate = string;

const DAY_MS = 86_400_000;

export function dateOf(instant: Date): IsoDate {
  return instant.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return dateOf(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));
}

/** `count` consecutive days ending with `last`, oldest first. */
export function daysEnding(last: IsoDate, count: number): IsoDate[] {
  return Array.from({ length: count }, (_, index) => addDays(last, index - count + 1));
}

export function dayNumber(date: IsoDate): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}
