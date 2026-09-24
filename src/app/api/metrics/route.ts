import {
  getOverview,
  metricsSource,
  overviewQuerySchema,
  type OverviewResponse,
} from '@/features/metrics/server';
import { defineRoute } from '@/lib/api/define-route';

/**
 * GET /api/metrics?range=30d -> the Store Events Panel for the session's
 * organization: every metric's total against the comparison period with its
 * sparkline, and the revenue panel. `range` is a preset (today, yesterday,
 * 7d, 30d, 3m, 6m, 12m) or custom with `from` and `to`.
 */
export const GET = defineRoute({
  envelope: 'success',
  authz: { kind: 'session-organization' },
  query: overviewQuerySchema,
  handler: async ({ query }, ctx) => {
    const overview = await getOverview(metricsSource, {
      organizationId: ctx.tenant.organizationId,
      selection: query.selection,
      now: new Date(),
    });
    const body: OverviewResponse = { success: true, overview };

    return body;
  },
});
