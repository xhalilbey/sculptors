import type { OrganizationId } from '@/types/ids';
import type { Customer } from '../domain/customers';
import type { Order } from '../domain/orders';
import type { Product } from '../domain/products';

/** 'demo' until the store's own data arrives through its syncs. */
export type CommerceSourceKind = 'demo' | 'live';

/**
 * Where the store's products, customers and orders come from. The use cases
 * take it as an argument, so the demo generator and, later, the synced data
 * are interchangeable behind it.
 */
export interface CommerceSource {
  readonly kind: CommerceSourceKind;
  products(query: { organizationId: OrganizationId }): Promise<Product[]>;
  customers(query: { organizationId: OrganizationId; now: Date }): Promise<Customer[]>;
  /** The most recent orders, newest first, each as it stands at `now`. */
  orders(query: { organizationId: OrganizationId; now: Date; limit: number }): Promise<Order[]>;
}
