/**
 * The metrics slice's client-safe surface: the Overview's screens, the
 * Overview as the landing hero draws it (on demo numbers), and the metric
 * keys the pages validate their route segment with.
 */

export { isMetricKey, METRIC_KEYS, METRICS, type MetricKey } from './domain/metrics';
export { MetricDetailScreen } from './ui/metric-detail-screen';
export { OverviewPreview } from './ui/overview-preview';
export { OverviewScreen } from './ui/overview-screen';
