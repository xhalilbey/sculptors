import 'server-only';

import type { MetricsSource } from './application/ports';
import { createDemoMetricsSource } from './infrastructure/demo-metrics-source';

/**
 * The metrics slice's server surface: what the /api/metrics routes need.
 */

export { getMetricDetail } from './application/get-metric-detail';
export { getOverview } from './application/get-overview';
export {
  metricDetailQuerySchema,
  metricParamsSchema,
  overviewQuerySchema,
  type MetricDetailResponse,
  type OverviewResponse,
} from './api/schemas';

/**
 * Where the numbers come from. Demo until the agents report real events; a
 * live source replaces it here and nothing else changes (every response
 * says which one answered, in its `source` field).
 */
export const metricsSource: MetricsSource = createDemoMetricsSource();
