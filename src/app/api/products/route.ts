import { NextResponse } from 'next/server';
import { commerceSource, getProducts, type ProductsResponse } from '@/features/commerce/server';
import { defineRoute } from '@/lib/api/define-route';

/** GET /api/products -> the session's organization's products, with their sales and views. */
export const GET = defineRoute({
  envelope: 'success',
  authz: { kind: 'session-organization' },
  handler: async (_input, ctx) => {
    const list = await getProducts(commerceSource, { organizationId: ctx.tenant.organizationId });
    const body: ProductsResponse = { success: true, list };

    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  },
});
