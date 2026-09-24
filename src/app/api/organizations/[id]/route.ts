import { NextResponse } from 'next/server';
import { z } from 'zod';
import { defineRoute } from '@/lib/api/define-route';
import { logger } from '@/lib/logger';
import { organizationIdSchema } from '@/lib/validations';
import { toOrganizationDto } from '@/lib/workos/dto';
import { isOwnerInWorkOS, updateOrganization } from '@/lib/workos/organizations';

/**
 * PATCH /api/organizations/[id] -- rename, or mark onboarding complete.
 * Owners only.
 *
 * The name lives in WorkOS and is mirrored here, so a rename goes to WorkOS
 * first and the mirror second (updateOrganization). The onboarding flag is
 * ours alone.
 *
 * Owner rights are checked twice. defineRoute's role comes from the mirror,
 * which can lag WorkOS; the rename is then made with the server's API key,
 * so WorkOS would not refuse it for us. WorkOS is asked directly before any
 * change, so an admin demoted or removed there loses these rights at once,
 * not at their next sign-in.
 */

const params = z.object({ id: organizationIdSchema });

// Strict: a field this route does not know is a 400, not silently dropped.
const body = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, 'Organization name must be between 1 and 100 characters')
    .max(100, 'Organization name must be between 1 and 100 characters')
    .optional(),
  completeOnboarding: z.boolean().optional(),
});

export const PATCH = defineRoute({
  envelope: 'success',
  authz: { kind: 'explicit-organization', organizationId: (input) => input.params.id },
  params,
  body,
  handler: async ({ params: { id }, body: input }, ctx) => {
    if (ctx.tenant.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Only an owner can change the organization' },
        { status: 403 }
      );
    }

    const patch = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.completeOnboarding === true && { onboardingCompletedAt: new Date() }),
    };

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    // Outside the try below: a WorkOS failure here is a 500 from defineRoute,
    // never a silent pass.
    if (!(await isOwnerInWorkOS(ctx.user.workosUserId, id))) {
      logger.warn('Mirror says owner, WorkOS does not; refusing organization change', {
        userId: ctx.user.id,
        organizationId: id,
      });

      return NextResponse.json(
        { success: false, error: 'Only an owner can change the organization' },
        { status: 403 }
      );
    }

    try {
      const row = await updateOrganization(id, patch);

      if (!row) {
        throw new Error('Organization not found after update');
      }

      return NextResponse.json({
        success: true,
        organization: toOrganizationDto(row, {
          role: ctx.tenant.role,
          isActive: row.id === ctx.organization.id,
        }),
      });
    } catch (error) {
      logger.error('Failed to update organization', {
        organizationId: id,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });

      return NextResponse.json({ success: false, error: 'Failed to update organization' }, { status: 500 });
    }
  },
});
