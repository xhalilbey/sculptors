import { describe, expect, it } from 'vitest';
import { DEFAULT_CUSTOMER_FILTERS, filterCustomers, segmentOf, type Customer } from './customers';
import { DEFAULT_ORDER_FILTERS, filterOrders, stageOf, type Order } from './orders';
import { conversionOf, DEFAULT_PRODUCT_FILTERS, filterProducts, stockLevel, type Product } from './products';

function product(overrides: Partial<Product> & Pick<Product, 'id' | 'name'>): Product {
  return { sku: 'HOM-1000', category: 'home', shape: 'mug', price: 20, stock: 50, sold: 10, views: 100, ...overrides };
}

const PRODUCTS = [
  product({ id: 'a', name: 'Stoneware Mug', sold: 40, views: 400, price: 24 }),
  product({ id: 'b', name: 'Field Watch', category: 'accessories', sku: 'ACC-2000', sold: 5, views: 900, price: 189, stock: 3 }),
  product({ id: 'c', name: 'Pocket Speaker', category: 'tech', sold: 20, views: 100, price: 79, stock: 0 }),
];

describe('products', () => {
  it('reads stock as in stock, low at twelve or fewer, and out at none', () => {
    expect([stockLevel(13), stockLevel(12), stockLevel(1), stockLevel(0)]).toEqual(['in-stock', 'low', 'low', 'out']);
    expect(conversionOf({ sold: 5, views: 0 })).toBe(0);
  });

  it('finds by name or SKU, narrows by category and stock, and sorts', () => {
    const ids = (filters: Partial<typeof DEFAULT_PRODUCT_FILTERS>) =>
      filterProducts(PRODUCTS, { ...DEFAULT_PRODUCT_FILTERS, ...filters }).map((each) => each.id);

    expect(ids({})).toEqual(['a', 'c', 'b']);
    expect(ids({ query: 'acc-2' })).toEqual(['b']);
    expect(ids({ category: 'tech' })).toEqual(['c']);
    expect(ids({ stock: 'low' })).toEqual(['b']);
    expect(ids({ sort: 'most-viewed' })).toEqual(['b', 'a', 'c']);
    expect(ids({ sort: 'price-low' })).toEqual(['a', 'c', 'b']);
    expect(ids({ sort: 'conversion' })).toEqual(['c', 'a', 'b']);
  });
});

describe('customers', () => {
  const customer = (overrides: Partial<Customer> & Pick<Customer, 'id' | 'name'>): Customer => ({
    email: 'x@example.com',
    city: 'Berlin',
    country: 'Germany',
    segment: 'returning',
    orders: 3,
    spent: 300,
    views: 50,
    lastSeen: '2026-09-20T10:00:00.000Z',
    ...overrides,
  });
  const CUSTOMERS = [
    customer({ id: 'a', name: 'Lena Müller', spent: 2400, segment: 'vip', orders: 12 }),
    customer({ id: 'b', name: 'Elif Yılmaz', country: 'Türkiye', city: 'Istanbul', segment: 'new', orders: 1, spent: 90, lastSeen: '2026-09-23T08:00:00.000Z' }),
  ];

  it('calls one order new, a big spender VIP, and the rest returning', () => {
    expect(segmentOf({ orders: 1, spent: 5000 }, 1500)).toBe('new');
    expect(segmentOf({ orders: 4, spent: 1500 }, 1500)).toBe('vip');
    expect(segmentOf({ orders: 4, spent: 400 }, 1500)).toBe('returning');
  });

  it('finds by name or email and narrows by segment and country', () => {
    const ids = (filters: Partial<typeof DEFAULT_CUSTOMER_FILTERS>) =>
      filterCustomers(CUSTOMERS, { ...DEFAULT_CUSTOMER_FILTERS, ...filters }).map((each) => each.id);

    expect(ids({})).toEqual(['a', 'b']);
    expect(ids({ query: 'elif' })).toEqual(['b']);
    expect(ids({ segment: 'vip' })).toEqual(['a']);
    expect(ids({ country: 'Türkiye' })).toEqual(['b']);
    expect(ids({ sort: 'recent' })).toEqual(['b', 'a']);
  });
});

describe('orders', () => {
  const order = (id: string, stages: Order['reached']): Order => ({
    id,
    customer: { name: 'Lena Müller', city: 'Berlin', country: 'Germany' },
    items: 1,
    total: 20,
    carrier: 'DHL Express',
    tracking: `JD01${id}`,
    from: 'Amsterdam',
    reached: stages,
    eta: '2026-09-24T06:00:00.000Z',
  });
  const ORDERS = [
    order('SC-1', [{ stage: 'placed', at: '2026-09-23T10:00:00.000Z' }]),
    order('SC-2', [
      { stage: 'placed', at: '2026-09-22T10:00:00.000Z' },
      { stage: 'packed', at: '2026-09-22T10:30:00.000Z' },
      { stage: 'shipped', at: '2026-09-22T12:30:00.000Z' },
      { stage: 'out-for-delivery', at: '2026-09-22T17:30:00.000Z' },
      { stage: 'delivered', at: '2026-09-22T20:30:00.000Z' },
    ]),
  ];

  it('stands at its last reached step, and "on the way" is everything not delivered', () => {
    expect(ORDERS.map(stageOf)).toEqual(['placed', 'delivered']);
    expect(filterOrders(ORDERS, DEFAULT_ORDER_FILTERS).map((each) => each.id)).toEqual(['SC-1']);
    expect(filterOrders(ORDERS, { query: '', stage: 'delivered' }).map((each) => each.id)).toEqual(['SC-2']);
    expect(filterOrders(ORDERS, { query: 'jd01sc-2', stage: 'all' }).map((each) => each.id)).toEqual(['SC-2']);
  });
});
