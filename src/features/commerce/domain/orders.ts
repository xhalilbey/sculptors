/**
 * Orders as the Orders page tracks them, live (owner's direction, 23 Sep
 * 2026): each on its way from the warehouse to the customer through five
 * steps, drawn as a dotted line of stops.
 */

export const ORDER_STAGES = ['placed', 'packed', 'shipped', 'out-for-delivery', 'delivered'] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

export const STAGE_LABELS: Record<OrderStage, string> = {
  placed: 'Ordered',
  packed: 'Packed',
  shipped: 'Shipped',
  'out-for-delivery': 'Out for delivery',
  delivered: 'Delivered',
};

export interface Order {
  id: string;
  customer: { name: string; city: string; country: string };
  items: number;
  total: number;
  carrier: string;
  tracking: string;
  from: string;
  /** ISO instants of the steps reached so far, in order; the next ones are only planned. */
  reached: Array<{ stage: OrderStage; at: string }>;
  /** When it is expected at the door. */
  eta: string;
}

export function stageOf(order: Pick<Order, 'reached'>): OrderStage {
  return order.reached.at(-1)?.stage ?? 'placed';
}

export type StageFilter = OrderStage | 'all' | 'active';

export interface OrderFilters {
  query: string;
  stage: StageFilter;
}

export const DEFAULT_ORDER_FILTERS: OrderFilters = { query: '', stage: 'active' };

export function filterOrders(orders: readonly Order[], filters: OrderFilters): Order[] {
  const query = filters.query.trim().toLowerCase();

  return orders.filter((order) => {
    const stage = stageOf(order);

    return (
      (query.length === 0 ||
        order.id.toLowerCase().includes(query) ||
        order.customer.name.toLowerCase().includes(query) ||
        order.tracking.toLowerCase().includes(query)) &&
      (filters.stage === 'all' || (filters.stage === 'active' ? stage !== 'delivered' : stage === filters.stage))
    );
  });
}
