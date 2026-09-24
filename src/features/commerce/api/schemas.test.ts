import { describe, expect, it } from 'vitest';
import type { OrganizationId } from '@/types/ids';
import { getCustomers, getOrders, getProducts } from '../application/get-commerce';
import { createDemoCommerceSource } from '../infrastructure/demo-commerce-source';
import { customerListSchema, orderBoardSchema, productListSchema } from './schemas';

const source = createDemoCommerceSource();
const organizationId = 'org_01SCHEMA' as OrganizationId;
const now = new Date('2026-09-23T15:00:00Z');

describe('the commerce wire schemas', () => {
  // z.object drops keys it does not know, so equality also catches a field
  // a use case gained that the schema (and so the client) never saw.
  it('describe products, customers and orders exactly as the use cases build them', async () => {
    const products = await getProducts(source, { organizationId });
    const customers = await getCustomers(source, { organizationId, now });
    const orders = await getOrders(source, { organizationId, now });

    expect(productListSchema.parse(products)).toEqual(products);
    expect(customerListSchema.parse(customers)).toEqual(customers);
    expect(orderBoardSchema.parse(orders)).toEqual(orders);
  });
});
