import type { ComponentKey, Incident, IsoDate } from '../domain/system';

/** 'demo' until the probes and the incident log exist. */
export type HealthSourceKind = 'demo' | 'live';

/**
 * Where System Health's numbers come from. The use case takes it as an
 * argument, so the demo generator and, later, real probes and an incident
 * log are interchangeable behind it.
 */
export interface HealthSource {
  readonly kind: HealthSourceKind;
  /** A component's uptime (0 to 1) on each day, in the order given. */
  dailyUptime(query: { component: ComponentKey; days: readonly IsoDate[]; now: Date }): Promise<number[]>;
  /** Incidents that started on the given days (both ends included) and before `now`. */
  incidents(query: { from: IsoDate; to: IsoDate; now: Date }): Promise<Incident[]>;
}
