import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';
import { organizationIdSchema } from '@/lib/validations';
import { refreshSessionForOrganization, setWorkOSSessionCookie } from '@/lib/workos/auth';

/**
 * POST /api/organizations/[id]/select -- switch the session to another
 * organization.
 *
 * Two checks, in order. The mirror says whether the caller is a member
 * (defineRoute's explicit-organization authorization), which is enough to
 * refuse quickly and without an API call. Then WorkOS re-issues the session
 * for that organization, and WorkOS will refuse an organization the user is
 * not in regardless of what the mirror said. The client never chooses a
 * tenant; it asks, and the identity provider decides.
 */

const params = z.object({ id: organizationIdSchema });

export const POST = defineRoute({
  envelope: 'success',
  authz: { kind: 'explicit-organization', organizationId: (input) => input.params.id },
  params,
  handler: async (_input, ctx) => {
    try {
      const refreshed = await refreshSessionForOrganization(ctx.sessionData, ctx.tenant.organizationId);
      const response = NextResponse.json({ success: true, organizationId: refreshed.organizationId });

      setWorkOSSessionCookie(response, refreshed.sealedSession);

      return response;
    } catch (error) {
      logger.warn('WorkOS refused organization switch', {
        organizationId: ctx.tenant.organizationId,
        userId: ctx.user.id,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });

      return NextResponse.json(
        { success: false, error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }
  },
});
