import { getHealthReport, healthSource, type HealthResponse } from '@/features/health/server';
import { defineRoute } from '@/lib/api/define-route';

/**
 * GET /api/health -> System Health: the state now, each component's status
 * with its uptime and 90 daily bars, and the incidents of the last fifteen
 * days. The system is ours, not the tenant's, but only signed-in members of
 * an organization see it; like every defineRoute answer, it is no-store.
 */
export const GET = defineRoute({
  envelope: 'success',
  authz: { kind: 'session-organization' },
  handler: async () => {
    const report = await getHealthReport(healthSource, { now: new Date() });
    const body: HealthResponse = { success: true, report };

    return body;
  },
});
