/**
 * The store's customers as the Customers page shows them, in the Products
 * page's make (owner's direction, 23 Sep 2026): who they are and where,
 * what they have bought and spent, and how much they have looked around.
 */

export const CUSTOMER_SEGMENTS = ['new', 'returning', 'vip'] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const SEGMENT_LABELS: Record<CustomerSegment, string> = { new: 'New', returning: 'Returning', vip: 'VIP' };

/** A customer's segment from their orders and spend: one order is new, a big spender is VIP. */
export function segmentOf(customer: Pick<Customer, 'orders' | 'spent'>, vipSpend: number): CustomerSegment {
  if (customer.orders <= 1) return 'new';

  return customer.spent >= vipSpend ? 'vip' : 'returning';
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  city: string;
  country: string;
  segment: CustomerSegment;
  orders: number;
  /** In the store's currency, over their lifetime. */
  spent: number;
  /** Product pages viewed over the last 30 days. */
  views: number;
  /** ISO instant of their last visit. */
  lastSeen: string;
}

export const CUSTOMER_SORTS = ['top-spenders', 'most-orders', 'most-views', 'recent'] as const;

export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  'top-spenders': 'Top spenders',
  'most-orders': 'Most orders',
  'most-views': 'Most views',
  recent: 'Recently active',
};

export interface CustomerFilters {
  query: string;
  segment: CustomerSegment | 'all';
  country: string | 'all';
  sort: CustomerSort;
}

export const DEFAULT_CUSTOMER_FILTERS: CustomerFilters = { query: '', segment: 'all', country: 'all', sort: 'top-spenders' };

export function filterCustomers(customers: readonly Customer[], filters: CustomerFilters): Customer[] {
  const query = filters.query.trim().toLowerCase();
  const kept = customers.filter(
    (customer) =>
      (query.length === 0 || customer.name.toLowerCase().includes(query) || customer.email.toLowerCase().includes(query)) &&
      (filters.segment === 'all' || customer.segment === filters.segment) &&
      (filters.country === 'all' || customer.country === filters.country)
  );
  const by: Record<CustomerSort, (a: Customer, b: Customer) => number> = {
    'top-spenders': (a, b) => b.spent - a.spent,
    'most-orders': (a, b) => b.orders - a.orders,
    'most-views': (a, b) => b.views - a.views,
    recent: (a, b) => b.lastSeen.localeCompare(a.lastSeen),
  };

  return kept.sort((a, b) => by[filters.sort](a, b) || a.name.localeCompare(b.name));
}
