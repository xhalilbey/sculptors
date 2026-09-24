/**
 * Is this user an active member of this organization?
 *
 * defineRoute calls it for every authenticated route, answered from the
 * membership mirror (both the membership and the organization must be
 * active). The mirror can lag WorkOS, so the role returned here is a first
 * gate: a handler that makes an owner's change in WorkOS confirms it there
 * (isOwnerInWorkOS in lib/workos/organizations).
 *
 * `sessionOrganizationId` is the organization the session context resolved
 * as active. When a caller passes it, it must name the same organization it
 * asks about: a caller that disagrees with itself is a bug worth refusing,
 * not something to settle by picking one.
 *
 * Fails closed: findMembership answers null for a malformed id or a failed
 * lookup, which is a 403 here.
 */

import 'server-only';

import { logger } from '@/lib/logger';
import { findMembership, isOwnerRole } from '@/lib/workos/organizations';

export type OrganizationAccessResult =
  | { authorized: true; role: 'owner' | 'member' }
  | { authorized: false; status: number; error: string };

const DENIED: OrganizationAccessResult = {
  authorized: false,
  status: 403,
  error: 'You do not have access to this organization',
};

export async function ensureOrganizationAccess(
  organizationId: string,
  userId: string,
  sessionOrganizationId?: string | null
): Promise<OrganizationAccessResult> {
  if (sessionOrganizationId && sessionOrganizationId !== organizationId) {
    logger.warn('Organization and session organization disagree', {
      userId,
      organizationId,
      sessionOrganizationId,
    });

    return DENIED;
  }

  const membership = await findMembership(userId, organizationId);

  if (!membership) {
    logger.warn('Organization access denied', { userId, organizationId });

    return DENIED;
  }

  return { authorized: true, role: isOwnerRole(membership.role) ? 'owner' : 'member' };
}
