import { z } from 'zod';
import { COMPONENT_KEYS } from '../domain/system';

/**
 * System Health on the wire. The browser client parses the response with
 * this schema; a test parses a real report with it, so the two cannot drift.
 */

const status = z.enum(['operational', 'degraded', 'outage']);
const isoDate = z.iso.date();
const minute = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/);
const day = z.object({ date: isoDate, uptime: z.number(), status, incidents: z.array(z.string()) });

const incident = z.object({
  id: z.string(),
  component: z.enum(COMPONENT_KEYS as [string, ...string[]]),
  impact: z.enum(['minor', 'major']),
  title: z.string(),
  startedAt: minute,
  resolvedAt: minute.nullable(),
  updates: z.array(
    z.object({
      phase: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
      at: minute,
      message: z.string(),
    })
  ),
});

export const healthReportSchema = z.object({
  source: z.enum(['demo', 'live']),
  checkedAt: minute,
  overall: status,
  components: z.array(
    z.object({
      key: z.enum(COMPONENT_KEYS as [string, ...string[]]),
      name: z.string(),
      description: z.string(),
      status,
      uptime: z.number(),
      days: z.array(day),
    })
  ),
  pastIncidents: z.array(z.object({ date: isoDate, incidents: z.array(incident) })),
});

export const healthResponseSchema = z.object({ success: z.literal(true), report: healthReportSchema });

export type HealthReportDto = z.infer<typeof healthReportSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
