import {
  getMetricDetail,
  metricDetailQuerySchema,
  metricParamsSchema,
  metricsSource,
  type MetricDetailResponse,
} from '@/features/metrics/server';
import { defineRoute } from '@/lib/api/define-route';

/**
 * GET /api/metrics/[metric]?range=3m&granularity=week -> one metric for the
 * session's organization, in buckets, each beside the same hours in the
 * comparison period. An unknown metric, a bad custom range, or a bucket size
 * the range does not offer is a 400.
 */
export const GET = defineRoute({
  envelope: 'success',
  authz: { kind: 'session-organization' },
  params: metricParamsSchema,
  query: metricDetailQuerySchema,
  handler: async ({ params, query }, ctx) => {
    const detail = await getMetricDetail(metricsSource, {
      organizationId: ctx.tenant.organizationId,
      metric: params.metric,
      selection: query.selection,
      granularity: query.granularity,
      now: new Date(),
    });
    const body: MetricDetailResponse = { success: true, detail };

    return body;
  },
});
