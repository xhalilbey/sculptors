import { readJson, toApiRequestError } from '@/lib/clients/api-error';
import { healthResponseSchema, type HealthReportDto } from './schemas';

/** GET /api/health, parsed with its wire schema. */
export async function fetchHealthReport(signal?: AbortSignal): Promise<HealthReportDto> {
  const response = await fetch('/api/health', { credentials: 'include', cache: 'no-store', signal });
  const body = await readJson(response);

  if (!response.ok) throw toApiRequestError(response, body, 'Failed to load System Health');

  return healthResponseSchema.parse(body).report;
}
