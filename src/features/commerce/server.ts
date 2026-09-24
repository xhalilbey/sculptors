import 'server-only';

import type { CommerceSource } from './application/ports';
import { createDemoCommerceSource } from './infrastructure/demo-commerce-source';

/** The commerce slice's server surface: what /api/products, /api/customers and /api/orders need. */

export { getCustomers, getOrders, getProducts } from './application/get-commerce';
export type { CustomersResponse, OrdersResponse, ProductsResponse } from './api/schemas';

/**
 * Where the store's data comes from. Demo until its syncs bring the real
 * catalog, customers and orders; a live source replaces it here and nothing
 * else changes (every answer says which one answered, in its `source`).
 */
export const commerceSource: CommerceSource = createDemoCommerceSource();
