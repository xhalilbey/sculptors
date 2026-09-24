import { getJson } from '@/lib/clients/api-error';
import {
  customersResponseSchema,
  ordersResponseSchema,
  productsResponseSchema,
  type CustomerListDto,
  type OrderBoardDto,
  type ProductListDto,
} from './schemas';

/** Browser calls to the store's data. Every answer is parsed with its wire schema. */

export async function fetchProducts(signal?: AbortSignal): Promise<ProductListDto> {
  return productsResponseSchema.parse(await getJson('/api/products', 'Failed to load products', signal)).list;
}

export async function fetchCustomers(signal?: AbortSignal): Promise<CustomerListDto> {
  return customersResponseSchema.parse(await getJson('/api/customers', 'Failed to load customers', signal)).list;
}

export async function fetchOrders(signal?: AbortSignal): Promise<OrderBoardDto> {
  return ordersResponseSchema.parse(await getJson('/api/orders', 'Failed to load orders', signal)).board;
}
