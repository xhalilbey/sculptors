import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';
import { organizationNameSchema } from '@/lib/validations';
import { refreshSessionForOrganization, setWorkOSSessionCookie } from '@/lib/workos/auth';
import { toOrganizationDto, toOrganizationListDto } from '@/lib/workos/dto';
import { createOrganizationForUser, findMembership } from '@/lib/workos/organizations';

/**
 * GET  /api/organizations  -> the caller's organizations, in switcher order,
 *                             the session's one marked isActive
 * POST /api/organizations  -> create one and switch the session into it
 */

export const GET = defineRoute({
  envelope: 'success',
  authz: { kind: 'session-organization' },
  handler: async (_input, ctx) =>
    NextResponse.json(
      {
        success: true,
        organizations: toOrganizationListDto(ctx.organizations, ctx.organization.id),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    ),
});

// Strict: a field this route does not know is a 400, not silently dropped.
const createBody = z.strictObject({ name: organizationNameSchema });

export const POST = defineRoute({
  envelope: 'success',
  authz: { kind: 'session-organization' },
  body: createBody,
  handler: async ({ body }, ctx) => {
    try {
      const { organizationId } = await createOrganizationForUser({
        name: body.name,
        userId: ctx.tenant.userId,
        workosUserId: ctx.user.workosUserId,
      });

      // Switch the session into the new organization.
      const refreshed = await refreshSessionForOrganization(ctx.sessionData, organizationId);

      // The mirror row carries the timestamps later lists will show. If the
      // mirror write failed (createOrganizationForUser logs it and the next
      // sign-in repairs it), the organization still exists and the session
      // is in it, so the answer is built from what was created.
      const mirrored = await findMembership(ctx.user.id, organizationId);
      const organization = mirrored
        ? toOrganizationDto(mirrored.organization, { role: 'owner', isActive: true })
        : toOrganizationDto(
            {
              id: organizationId,
              name: body.name,
              onboardingCompletedAt: null,
              createdAt: new Date(),
            },
            { role: 'owner', isActive: true }
          );
      const response = NextResponse.json({ success: true, organization }, { status: 201 });

      setWorkOSSessionCookie(response, refreshed.sealedSession);

      return response;
    } catch (error) {
      logger.error('Failed to create organization', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
        userId: ctx.user.id,
      });

      return NextResponse.json({ success: false, error: 'Failed to create organization' }, { status: 500 });
    }
  },
});
