/**
 * What the Overview counts. Each metric is something an agent did or caused
 * in the merchant's store, counted per organization.
 */

export const METRIC_KEYS = [
  'engaged-users',
  'revenue',
  'add-to-cart',
  'purchases',
  'catalogs',
  'comparisons',
  'discovery-pages',
  'cancellations',
  'refunds',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type MetricUnit = 'count' | 'currency';

/**
 * How a period's value is made from its events. A count or an amount adds
 * up; people do not -- someone engaged on Monday and Tuesday is one engaged
 * user for the week, so a week's value is not the sum of its days.
 */
export type Aggregation = 'sum' | 'unique';

export interface MetricDefinition {
  key: MetricKey;
  /** The tile's title. */
  label: string;
  /** What the number counts, under the number. */
  caption: string;
  /** One line on the metric's own page. */
  description: string;
  unit: MetricUnit;
  aggregation: Aggregation;
  /** False for the ones a merchant wants fewer of (cancellations, refunds). */
  higherIsBetter: boolean;
}

export const METRICS: Record<MetricKey, MetricDefinition> = {
  'engaged-users': {
    key: 'engaged-users',
    label: 'Engaged users',
    caption: 'Unique users',
    description: 'People who talked to an agent or opened a page it made.',
    unit: 'count',
    aggregation: 'unique',
    higherIsBetter: true,
  },
  revenue: {
    key: 'revenue',
    label: 'Revenue',
    caption: 'Attributed revenue',
    description: 'Order value from purchases an agent took part in.',
    unit: 'currency',
    aggregation: 'sum',
    higherIsBetter: true,
  },
  'add-to-cart': {
    key: 'add-to-cart',
    label: 'Add to cart',
    caption: 'Items added to cart',
    description: "Items added to a cart from an agent's answer or page.",
    unit: 'count',
    aggregation: 'sum',
    higherIsBetter: true,
  },
  purchases: {
    key: 'purchases',
    label: 'Purchases',
    caption: 'Completed orders',
    description: 'Orders completed after an agent took part.',
    unit: 'count',
    aggregation: 'sum',
    higherIsBetter: true,
  },
  catalogs: {
    key: 'catalogs',
    label: 'Catalogs created',
    caption: 'Catalogs generated',
    description: 'Catalogs the agents put together for shoppers.',
    unit: 'count',
    aggregation: 'sum',
    higherIsBetter: true,
  },
  comparisons: {
    key: 'comparisons',
    label: 'Comparison pages created',
    caption: 'Pages generated',
    description: 'Side-by-side comparison pages the agents generated.',
    unit: 'count',
    aggregation: 'sum',
    higherIsBetter: true,
  },
  'discovery-pages': {
    key: 'discovery-pages',
    label: 'Discovery pages created',
    caption: 'Pages generated',
    description: "Discovery pages the agents generated from a shopper's intent.",
    unit: 'count',
    aggregation: 'sum',
    higherIsBetter: true,
  },
  cancellations: {
    key: 'cancellations',
    label: 'Cancellations',
    caption: 'Cancelled orders',
    description: 'Agent-attributed orders cancelled before they shipped.',
    unit: 'count',
    aggregation: 'sum',
    higherIsBetter: false,
  },
  refunds: {
    key: 'refunds',
    label: 'Refunds',
    caption: 'Refunded orders',
    description: 'Agent-attributed orders refunded after delivery.',
    unit: 'count',
    aggregation: 'sum',
    higherIsBetter: false,
  },
};

export function isMetricKey(value: string): value is MetricKey {
  return (METRIC_KEYS as readonly string[]).includes(value);
}

/** The agent surface an order came through. */
export const REVENUE_SOURCES = ['conversations', 'catalogs', 'comparisons', 'discovery-pages'] as const;

export type RevenueSource = (typeof REVENUE_SOURCES)[number];

export const REVENUE_SOURCE_LABELS: Record<RevenueSource, string> = {
  conversations: 'Agent conversations',
  catalogs: 'Catalogs',
  comparisons: 'Comparison pages',
  'discovery-pages': 'Discovery pages',
};

/**
 * The revenue panel's figures, each a tab over its own chart: revenue, the
 * orders behind it, and the ratios that explain it.
 */
export const REVENUE_KPIS = ['revenue', 'orders', 'average-order-value', 'revenue-per-user', 'refund-rate'] as const;

export type RevenueKpi = (typeof REVENUE_KPIS)[number];

export type KpiUnit = 'currency' | 'currency-cents' | 'count' | 'percent';

export const REVENUE_KPI_DEFINITIONS: Record<RevenueKpi, { label: string; unit: KpiUnit; higherIsBetter: boolean }> = {
  revenue: { label: 'Revenue', unit: 'currency', higherIsBetter: true },
  orders: { label: 'Orders', unit: 'count', higherIsBetter: true },
  'average-order-value': { label: 'Avg. order value', unit: 'currency-cents', higherIsBetter: true },
  'revenue-per-user': { label: 'Revenue per user', unit: 'currency-cents', higherIsBetter: true },
  'refund-rate': { label: 'Refund rate', unit: 'percent', higherIsBetter: false },
};
