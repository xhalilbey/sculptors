import { NextResponse } from 'next/server';
import { getHealthReport, healthSource, type HealthResponse } from '@/features/health/server';
import { defineRoute } from '@/lib/api/define-route';

/**
 * GET /api/health -> System Health: every component's status and 90 days of
 * uptime, the last week's incidents, and the health numbers against the 30
 * days before. The system is ours, not the tenant's, but only signed-in
 * members of an organization see it.
 */
export const GET = defineRoute({
  envelope: 'success',
  authz: { kind: 'session-organization' },
  handler: async () => {
    const report = await getHealthReport(healthSource, { now: new Date() });
    const body: HealthResponse = { success: true, report };

    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  },
});
