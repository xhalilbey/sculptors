import { commerceSource, getCustomers, type CustomersResponse } from '@/features/commerce/server';
import { defineRoute } from '@/lib/api/define-route';

/** GET /api/customers -> the session's organization's customers, with their orders, spend and views. */
export const GET = defineRoute({
  envelope: 'success',
  authz: { kind: 'session-organization' },
  handler: async (_input, ctx) => {
    const list = await getCustomers(commerceSource, { organizationId: ctx.tenant.organizationId, now: new Date() });
    const body: CustomersResponse = { success: true, list };

    return body;
  },
});
