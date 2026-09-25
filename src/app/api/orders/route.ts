import { commerceSource, getOrders, type OrdersResponse } from '@/features/commerce/server';
import { defineRoute } from '@/lib/api/define-route';

/** GET /api/orders -> the session's organization's latest orders, each where it is on its way now. */
export const GET = defineRoute({
  envelope: 'success',
  authz: { kind: 'session-organization' },
  handler: async (_input, ctx) => {
    const board = await getOrders(commerceSource, { organizationId: ctx.tenant.organizationId, now: new Date() });
    const body: OrdersResponse = { success: true, board };

    return body;
  },
});
