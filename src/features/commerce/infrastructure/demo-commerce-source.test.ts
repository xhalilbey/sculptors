import { describe, expect, it } from 'vitest';
import type { OrganizationId } from '@/types/ids';
import { ORDER_STAGES } from '../domain/orders';
import { createDemoCommerceSource } from './demo-commerce-source';

const source = createDemoCommerceSource();
const STORE = 'org_01DEMOSTORE' as OrganizationId;
const OTHER = 'org_01OTHERSTORE' as OrganizationId;
const NOW = new Date('2026-09-23T15:00:00Z');

describe('the demo commerce source', () => {
  it('gives a store the same catalog and customers every time, and another store different ones', async () => {
    expect(await source.products({ organizationId: STORE })).toEqual(await source.products({ organizationId: STORE }));
    expect(await source.products({ organizationId: STORE })).not.toEqual(await source.products({ organizationId: OTHER }));
    expect(await source.customers({ organizationId: STORE, now: NOW })).toEqual(await source.customers({ organizationId: STORE, now: NOW }));
  });

  it('never sells more than was viewed, and keeps a VIP a spender', async () => {
    const products = await source.products({ organizationId: STORE });
    const customers = await source.customers({ organizationId: STORE, now: NOW });

    expect(products).toHaveLength(36);
    expect(products.every((each) => each.sold <= each.views && each.price > 0 && each.stock >= 0)).toBe(true);
    expect(customers.filter((each) => each.segment === 'vip').every((each) => each.spent >= 1500 && each.orders > 1)).toBe(true);
  });

  it('lists the latest orders newest first, each walking its steps in order and none ahead of the clock', async () => {
    const orders = await source.orders({ organizationId: STORE, now: NOW, limit: 48 });
    const customers = new Set((await source.customers({ organizationId: STORE, now: NOW })).map((each) => each.name));
    const placed = orders.map((order) => order.reached[0]?.at ?? '');

    expect(orders).toHaveLength(48);
    expect(placed).toEqual([...placed].sort().reverse());

    for (const order of orders) {
      const times = order.reached.map((step) => step.at);

      expect(order.reached.map((step) => step.stage)).toEqual(ORDER_STAGES.slice(0, order.reached.length));
      expect(times).toEqual([...times].sort());
      expect(times.every((at) => Date.parse(at) <= NOW.getTime())).toBe(true);
      expect(customers.has(order.customer.name)).toBe(true);
    }
  });

  it('moves the orders on as the clock does', async () => {
    const earlier = await source.orders({ organizationId: STORE, now: NOW, limit: 48 });
    const later = await source.orders({ organizationId: STORE, now: new Date(NOW.getTime() + 3 * 3_600_000), limit: 48 });
    const delivered = (list: typeof earlier) => list.filter((each) => each.reached.at(-1)?.stage === 'delivered').length;

    expect(later[0]?.id).not.toBe(earlier[0]?.id);
    expect(delivered(later.filter((each) => earlier.some((before) => before.id === each.id)))).toBeGreaterThanOrEqual(
      delivered(earlier.filter((each) => later.some((after) => after.id === each.id)))
    );
  });
});
