import 'server-only';

import type { HealthSource } from './application/ports';
import { createDemoHealthSource } from './infrastructure/demo-health-source';

/** The health slice's server surface: what /api/health needs. */

export { getHealthReport } from './application/get-health-report';
export type { HealthResponse } from './api/schemas';

/**
 * Where the numbers come from. Demo until real probes and an incident log
 * exist; a live source replaces it here and nothing else changes (the
 * response says which answered, in its `source` field).
 */
export const healthSource: HealthSource = createDemoHealthSource();
