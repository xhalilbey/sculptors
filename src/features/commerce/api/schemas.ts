import { z } from 'zod';
import { CUSTOMER_SEGMENTS } from '../domain/customers';
import { ORDER_STAGES } from '../domain/orders';
import { PRODUCT_CATEGORIES, PRODUCT_SHAPES } from '../domain/products';

/**
 * Products, customers and orders on the wire. The browser client parses each
 * response with these; a test parses what the use cases build, so the two
 * cannot drift.
 */

const source = z.enum(['demo', 'live']);
const instant = z.iso.datetime();

export const productSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  category: z.enum(PRODUCT_CATEGORIES),
  shape: z.enum(PRODUCT_SHAPES),
  price: z.number(),
  stock: z.number().int(),
  sold: z.number().int(),
  views: z.number().int(),
});

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  city: z.string(),
  country: z.string(),
  segment: z.enum(CUSTOMER_SEGMENTS),
  orders: z.number().int(),
  spent: z.number(),
  views: z.number().int(),
  lastSeen: instant,
});

export const orderSchema = z.object({
  id: z.string(),
  customer: z.object({ name: z.string(), city: z.string(), country: z.string() }),
  items: z.number().int(),
  total: z.number(),
  carrier: z.string(),
  tracking: z.string(),
  from: z.string(),
  reached: z.array(z.object({ stage: z.enum(ORDER_STAGES), at: instant })),
  eta: instant,
});

export const productListSchema = z.object({ source, currency: z.string(), products: z.array(productSchema) });
export const customerListSchema = z.object({ source, currency: z.string(), customers: z.array(customerSchema) });
export const orderBoardSchema = z.object({
  source,
  currency: z.string(),
  checkedAt: z.iso.datetime(),
  orders: z.array(orderSchema),
});

export const productsResponseSchema = z.object({ success: z.literal(true), list: productListSchema });
export const customersResponseSchema = z.object({ success: z.literal(true), list: customerListSchema });
export const ordersResponseSchema = z.object({ success: z.literal(true), board: orderBoardSchema });

export type ProductListDto = z.infer<typeof productListSchema>;
export type CustomerListDto = z.infer<typeof customerListSchema>;
export type OrderBoardDto = z.infer<typeof orderBoardSchema>;
export type ProductsResponse = z.infer<typeof productsResponseSchema>;
export type CustomersResponse = z.infer<typeof customersResponseSchema>;
export type OrdersResponse = z.infer<typeof ordersResponseSchema>;
