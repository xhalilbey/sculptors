/**
 * The metrics slice's client-safe surface: the Overview's screens and the
 * metric keys the pages validate their route segment with.
 */

export { isMetricKey, METRIC_KEYS, METRICS, type MetricKey } from './domain/metrics';
export { MetricDetailScreen } from './ui/metric-detail-screen';
export { OverviewScreen } from './ui/overview-screen';
