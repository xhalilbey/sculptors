/**
 * Is this user an active member of the organization a route names?
 *
 * defineRoute calls it only for explicit-organization routes, where the
 * organization comes from the request rather than from the session. It is
 * answered by findMembership from the membership mirror (both the
 * membership and the organization must be active). Session-organization
 * and resource routes never reach it: resolveSession has already matched
 * the session's organization against an active membership in the mirror,
 * and the role comes with that match.
 *
 * The mirror can lag WorkOS, so the role returned here is a first gate: a
 * handler that makes an owner's change in WorkOS confirms it there
 * (isOwnerInWorkOS in lib/workos/organizations).
 *
 * A malformed id or no active membership is a 403. A failed lookup is not:
 * findMembership throws and defineRoute answers 500, so a database outage
 * is no longer told "You do not have access to this organization". Until
 * 24 Sep 2026 this also took the session's organization and refused a
 * mismatch; only tests passed it, since a route that names an organization
 * means to name one other than the session's.
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
  userId: string
): Promise<OrganizationAccessResult> {
  const membership = await findMembership(userId, organizationId);

  if (!membership) {
    logger.warn('Organization access denied', { userId, organizationId });

    return DENIED;
  }

  return { authorized: true, role: isOwnerRole(membership.role) ? 'owner' : 'member' };
}
