import { getJson } from '@/lib/clients/api-error';
import { healthResponseSchema, type HealthReportDto } from './schemas';

/** GET /api/health, parsed with its wire schema. */
export async function fetchHealthReport(signal?: AbortSignal): Promise<HealthReportDto> {
  const body = await getJson('/api/health', 'Failed to load System Health', signal);

  return healthResponseSchema.parse(body).report;
}
