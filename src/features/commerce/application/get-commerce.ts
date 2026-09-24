import type { OrganizationId } from '@/types/ids';
import type { Customer } from '../domain/customers';
import type { Order } from '../domain/orders';
import type { Product } from '../domain/products';
import type { CommerceSource, CommerceSourceKind } from './ports';

/** How many of the latest orders the tracking board follows. */
export const ORDER_LIMIT = 48;

/** The currency the store sells in; the demo's is dollars. */
const CURRENCY = 'USD';

export interface ProductList {
  source: CommerceSourceKind;
  currency: string;
  products: Product[];
}

export interface CustomerList {
  source: CommerceSourceKind;
  currency: string;
  customers: Customer[];
}

export interface OrderBoard {
  source: CommerceSourceKind;
  currency: string;
  /** When the board was read, to the second: the page says how fresh it is. */
  checkedAt: string;
  orders: Order[];
}

export async function getProducts(source: CommerceSource, input: { organizationId: OrganizationId }): Promise<ProductList> {
  return { source: source.kind, currency: CURRENCY, products: await source.products(input) };
}

export async function getCustomers(
  source: CommerceSource,
  input: { organizationId: OrganizationId; now: Date }
): Promise<CustomerList> {
  return { source: source.kind, currency: CURRENCY, customers: await source.customers(input) };
}

export async function getOrders(source: CommerceSource, input: { organizationId: OrganizationId; now: Date }): Promise<OrderBoard> {
  return {
    source: source.kind,
    currency: CURRENCY,
    checkedAt: `${input.now.toISOString().slice(0, 19)}Z`,
    orders: await source.orders({ ...input, limit: ORDER_LIMIT }),
  };
}
