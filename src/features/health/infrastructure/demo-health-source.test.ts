import { describe, expect, it } from 'vitest';
import { COMPONENT_KEYS, daysEnding } from '../domain/system';
import { createDemoHealthSource } from './demo-health-source';

const source = createDemoHealthSource();
const NOW = new Date('2026-09-23T14:35:00Z');
const DAYS = daysEnding('2026-09-23', 90);

describe('the demo health source', () => {
  it('tells the same history on every call, and never opens on an incident today', async () => {
    const first = await source.incidents({ from: DAYS[0] ?? '', to: '2026-09-23', now: NOW });
    const again = await source.incidents({ from: DAYS[0] ?? '', to: '2026-09-23', now: NOW });

    expect(first).toEqual(again);
    expect(first.length).toBeGreaterThan(0);
    expect(first.some((incident) => incident.startedAt.startsWith('2026-09-23'))).toBe(false);
  });

  it('takes uptime only from the part an incident hit, on its day', async () => {
    const incidents = await source.incidents({ from: DAYS[0] ?? '', to: '2026-09-23', now: NOW });

    for (const component of COMPONENT_KEYS) {
      const uptimes = await source.dailyUptime({ component, days: DAYS, now: NOW });

      DAYS.forEach((date, index) => {
        const hit = incidents.some((incident) => incident.component === component && incident.startedAt.startsWith(date));

        expect(uptimes[index] ?? Number.NaN, `${component} on ${date}`)[hit ? 'toBeLessThan' : 'toBe'](1);
      });
    }
  });

  it('writes each incident as a status page does: newest update first, resolved at its end', async () => {
    const incidents = await source.incidents({ from: DAYS[0] ?? '', to: '2026-09-23', now: NOW });

    for (const incident of incidents) {
      const times = incident.updates.map((update) => update.at);

      expect(times).toEqual([...times].sort().reverse());
      expect(incident.updates[0]).toMatchObject({ phase: 'resolved', at: incident.resolvedAt });
      expect(incident.updates.at(-1)).toMatchObject({ phase: 'investigating', at: incident.startedAt });
    }
  });
});
