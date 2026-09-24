import { z } from 'zod';
import { SOURCE_KINDS } from '../application/ports';
import { METRIC_KEYS, REVENUE_KPIS, REVENUE_SOURCES } from '../domain/metrics';
import {
  customRangeProblem,
  DEFAULT_PRESET,
  GRANULARITIES,
  granularitiesFor,
  INSTANT,
  periodOf,
  PRESETS,
  type Granularity,
  type RangeSelection,
} from '../domain/time';

/**
 * The metrics API on the wire. The routes validate their input with the
 * query schemas; the browser client parses every response with the response
 * schemas, never casting. The response shapes mirror the use cases' results
 * (application/get-overview.ts, get-metric-detail.ts), and a test parses a
 * real result with them, so the two cannot drift apart unnoticed.
 *
 * A range is `?range=7d`, or `?range=custom&from=2026-08-01&to=2026-08-31`
 * (both days included). A custom range is checked against the current time
 * when the request is parsed: it cannot end in the future or run past two
 * years.
 */

const presetOrCustom = z.enum([...PRESETS, 'custom']);
const granularitySchema = z.enum(GRANULARITIES);

const selectionFields = {
  range: presetOrCustom.default(DEFAULT_PRESET),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};

type SelectionFields = { range: z.infer<typeof presetOrCustom>; from?: string; to?: string };

function checkCustom(input: SelectionFields, context: z.RefinementCtx) {
  if (input.range !== 'custom') return;

  const problem =
    input.from && input.to ? customRangeProblem(input.from, input.to, new Date()) : 'A custom range needs from and to.';

  if (problem) context.addIssue({ code: 'custom', message: problem, path: ['from'] });
}

function toSelection(input: SelectionFields): RangeSelection {
  return input.range === 'custom' ? { from: input.from ?? '', to: input.to ?? '' } : { preset: input.range };
}

/** GET /api/metrics */
export const overviewQuerySchema = z
  .object(selectionFields)
  .superRefine(checkCustom)
  .transform((input) => ({ selection: toSelection(input) }));

/** GET /api/metrics/[metric] */
export const metricParamsSchema = z.object({
  metric: z.enum(METRIC_KEYS),
});

/**
 * A bucket size the period does not offer is a 400; a missing one is the
 * period's default. The second check sees only a range the first accepted:
 * the transform between them runs only when there are no issues.
 */
export const metricDetailQuerySchema = z
  .object({ ...selectionFields, granularity: granularitySchema.optional() })
  .superRefine(checkCustom)
  .transform((input) => ({ selection: toSelection(input), granularity: input.granularity }))
  .superRefine(({ selection, granularity }, context) => {
    if (!granularity) return;

    const offered: readonly Granularity[] = granularitiesFor(periodOf(selection, new Date()));

    if (!offered.includes(granularity)) {
      context.addIssue({ code: 'custom', message: 'That bucket size is not offered for this range', path: ['granularity'] });
    }
  });

const isoDate = z.iso.date();
const instant = z.string().regex(INSTANT);
const interval = z.object({ start: instant, end: instant });
const change = z.object({ absolute: z.number(), ratio: z.number().nullable() });
const sourceKind = z.enum(SOURCE_KINDS);
const selection = z.union([z.object({ preset: z.enum(PRESETS) }), z.object({ from: isoDate, to: isoDate })]);

const seriesPoint = z.object({
  start: instant,
  end: instant,
  hours: z.number().int().positive(),
  partial: z.boolean(),
  value: z.number(),
  previous: z.number(),
});

export const overviewSchema = z.object({
  source: sourceKind,
  currency: z.string(),
  selection,
  period: interval,
  comparison: interval,
  granularity: granularitySchema,
  metrics: z.array(
    z.object({
      key: z.enum(METRIC_KEYS),
      value: z.number(),
      previous: z.number(),
      change,
      series: z.array(z.number()),
    })
  ),
  revenue: z.object({
    kpis: z.array(
      z.object({
        key: z.enum(REVENUE_KPIS),
        value: z.number().nullable(),
        previous: z.number().nullable(),
        change,
        points: z.array(seriesPoint),
      })
    ),
    bySource: z.array(z.object({ source: z.enum(REVENUE_SOURCES), value: z.number(), share: z.number() })),
  }),
});

export const metricDetailSchema = z.object({
  source: sourceKind,
  currency: z.string(),
  metric: z.enum(METRIC_KEYS),
  selection,
  granularity: granularitySchema,
  granularities: z.array(granularitySchema),
  period: interval,
  comparison: interval,
  value: z.number(),
  previous: z.number(),
  change,
  points: z.array(seriesPoint),
});

export const overviewResponseSchema = z.object({ success: z.literal(true), overview: overviewSchema });
export const metricDetailResponseSchema = z.object({ success: z.literal(true), detail: metricDetailSchema });

export type OverviewDto = z.infer<typeof overviewSchema>;
export type MetricDetailDto = z.infer<typeof metricDetailSchema>;
export type OverviewResponse = z.infer<typeof overviewResponseSchema>;
export type MetricDetailResponse = z.infer<typeof metricDetailResponseSchema>;
