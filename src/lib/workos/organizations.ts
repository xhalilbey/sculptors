import 'server-only';

import type { OrganizationMembership } from '@workos-inc/node';
import {
  identityDb,
  isOrganizationId,
  isUserId,
  membershipsRepository,
  organizationsRepository,
  parseMembershipId,
  parseOrganizationId,
  withIdentityTransaction,
  type MirroredMembership,
  type OrganizationPatch,
  type OrganizationRow,
  type UserId,
} from '@/lib/identity';
import { logger } from '@/lib/logger';
import { getWorkOSClient } from './client';

/**
 * Organizations, the way v2 means them.
 *
 * A WorkOS Organization IS the tenant. WorkOS holds the organizations and
 * who belongs to them; the tables here are a mirror of that, written on
 * sign-in from the user's own memberships and by webhook for changes made
 * elsewhere. The mirror is what the UI lists and what the app joins on; the
 * session -- issued by WorkOS for exactly one organization -- is what binds a
 * request to an organization.
 *
 * The mirror can lag WorkOS: it is refreshed at sign-in and by webhooks,
 * and a webhook that failed waits for WorkOS's next delivery. So
 * defineRoute's membership check (findMembership) is a first gate, not the
 * last word. A change we carry out in WorkOS with the server's API key,
 * where WorkOS cannot refuse on the user's behalf, asks WorkOS first
 * (isOwnerInWorkOS).
 *
 * WorkOS role slugs are kept as they are ('admin', 'member', or whatever the
 * environment defines). The one interpretation made here is that 'admin' is
 * the owner-equivalent, which is what WorkOS assigns the creator.
 */

export const OWNER_ROLE_SLUG = 'admin';

export type { MirroredMembership };

type WorkOSMembership = Pick<
  OrganizationMembership,
  'id' | 'organizationId' | 'organizationName' | 'userId' | 'status' | 'role' | 'updatedAt'
>;

/**
 * Every active membership WorkOS has for this user, across every page.
 * Authoritative: the sync retires what this does not list, so reading only
 * the first page (it used to) would retire every membership past the 100th.
 * No `limit` here: the SDK's autoPagination returns just the first page when
 * one is passed.
 */
export async function listWorkOSMemberships(workosUserId: string): Promise<WorkOSMembership[]> {
  const list = await getWorkOSClient().userManagement.listOrganizationMemberships({
    userId: workosUserId,
    statuses: ['active'],
  });

  return list.autoPagination();
}

/**
 * Bring the mirror up to date with what WorkOS says about one user, and
 * return the result. Rows for memberships WorkOS no longer lists are marked
 * inactive rather than deleted, so the history of who was where survives.
 *
 * One transaction: the organizations, the memberships, the retirement of
 * stale ones and the read-back either all happen or none do, so a failure
 * half way can no longer leave a user listed in an organization WorkOS
 * already removed them from.
 *
 * `listedAt` is when the list was requested from WorkOS. Every write is
 * ordered (identity/repositories/mirror-order.ts): a membership carries its
 * own WorkOS updatedAt, and the names and the retirements, which have no
 * WorkOS time of their own, carry `listedAt`. So a snapshot older than a
 * webhook that already landed changes nothing that webhook wrote.
 */
export async function syncMembershipsForUser(input: {
  userId: UserId;
  workosUserId: string;
  memberships: WorkOSMembership[];
  listedAt: Date;
}): Promise<MirroredMembership[]> {
  const { userId, workosUserId, memberships, listedAt } = input;

  try {
    const organizationRows = memberships.map((membership) => ({
      id: parseOrganizationId(membership.organizationId),
      name: membership.organizationName,
      workosUpdatedAt: listedAt,
    }));
    const membershipRows = memberships.map((membership) => ({
      id: parseMembershipId(membership.id),
      organizationId: parseOrganizationId(membership.organizationId),
      userId,
      workosUserId,
      role: membership.role.slug,
      status: membership.status,
      workosUpdatedAt: new Date(membership.updatedAt),
    }));

    return await withIdentityTransaction(async (tx) => {
      // Only name is refreshed from a membership record; plan, region and the
      // rest are ours and must not be overwritten by a sync.
      await organizationsRepository.upsertNames(tx, organizationRows);
      await membershipsRepository.upsertMany(tx, membershipRows);
      await membershipsRepository.retireStale(
        tx,
        userId,
        membershipRows.map((row) => row.id),
        listedAt
      );

      return membershipsRepository.listActiveForUser(tx, userId);
    });
  } catch (error) {
    logger.error('Failed to mirror memberships', { error, userId });
    throw new Error('Failed to load organizations');
  }
}

/** The user's active memberships from the mirror, with their organizations. */
export async function listMirroredMemberships(userId: UserId): Promise<MirroredMembership[]> {
  try {
    return await membershipsRepository.listActiveForUser(identityDb(), userId);
  } catch (error) {
    logger.error('Failed to list memberships', { error, userId });
    throw new Error('Failed to load organizations');
  }
}

/**
 * Create an organization the right way round: in WorkOS first, with the
 * creator as its admin, and only then in the mirror. If the mirror write
 * fails the organization still exists in WorkOS and the next sign-in
 * repairs the mirror, which is the recoverable direction. The reverse --
 * a row here with no WorkOS organization behind it -- could never be
 * signed into and would have to be cleaned up by hand.
 */
export async function createOrganizationForUser(input: {
  name: string;
  userId: UserId;
  workosUserId: string;
}): Promise<{ organizationId: string; membershipId: string }> {
  const workos = getWorkOSClient();

  const organization = await workos.organizations.createOrganization({
    name: input.name,
    metadata: { created_by_workos_user_id: input.workosUserId },
  });

  const membership = await workos.userManagement.createOrganizationMembership({
    userId: input.workosUserId,
    organizationId: organization.id,
    roleSlug: OWNER_ROLE_SLUG,
  });

  try {
    const organizationId = parseOrganizationId(organization.id);

    await withIdentityTransaction(async (tx) => {
      await organizationsRepository.upsertCreated(tx, {
        id: organizationId,
        name: organization.name,
        createdBy: input.userId,
        workosUpdatedAt: new Date(organization.updatedAt),
      });
      await membershipsRepository.upsertMany(tx, [
        {
          id: parseMembershipId(membership.id),
          organizationId,
          userId: input.userId,
          workosUserId: input.workosUserId,
          role: membership.role.slug,
          status: membership.status,
          workosUpdatedAt: new Date(membership.updatedAt),
        },
      ]);
    });
  } catch (error) {
    logger.error('Organization created in WorkOS but not mirrored', {
      error,
      organizationId: organization.id,
      membershipId: membership.id,
    });
  }

  return { organizationId: organization.id, membershipId: membership.id };
}

/**
 * Change an organization. The name lives in WorkOS and is mirrored here, so
 * a rename goes to WorkOS first and the mirror second -- the same direction
 * as creation, for the same reason: if the second write fails the next
 * sign-in repairs it. Onboarding is ours alone.
 *
 * Returns the mirrored row, or null when the mirror has no such organization.
 */
export async function updateOrganization(
  organizationId: string,
  patch: OrganizationPatch
): Promise<OrganizationRow | null> {
  const id = parseOrganizationId(organizationId);
  let workosUpdatedAt: Date | undefined;

  if (patch.name) {
    const renamed = await getWorkOSClient().organizations.updateOrganization({ organization: id, name: patch.name });

    workosUpdatedAt = new Date(renamed.updatedAt);
  }

  return organizationsRepository.update(identityDb(), id, patch, workosUpdatedAt);
}

/**
 * Is this user an active member of this organization? Answered from the
 * mirror. defineRoute asks it, through ensureOrganizationAccess, on the
 * routes that name an organization (explicit-organization), which is sound
 * only where something fresher also decides: the organization switch is
 * made by WorkOS, which refuses an organization the user is not in, and an
 * owner's change is re-checked with isOwnerInWorkOS. A route that acts on
 * the mirror's role alone inherits its staleness.
 *
 * A malformed id is "no membership", answered without a query. A failed
 * lookup is not: it throws, so defineRoute answers 500 and logs an error.
 * Until 24 Sep 2026 the failure was caught here and answered null, which
 * told a member "You do not have access to this organization" (a 403)
 * whenever this lookup failed after the session had resolved (a dropped
 * connection or a timeout). A database that is down altogether already
 * failed earlier, in resolveSession, and was a 500. A caller that can do
 * without the row catches around its own call (POST /api/organizations).
 */
export async function findMembership(
  userId: string,
  organizationId: string
): Promise<MirroredMembership | null> {
  if (!isOrganizationId(organizationId) || !isUserId(userId)) return null;

  return membershipsRepository.findActive(identityDb(), userId, organizationId);
}

/**
 * Is this user an active owner of this organization, according to WorkOS
 * itself? For changes the server makes with its own API key: an admin who
 * was demoted or removed in WorkOS may still be an owner in the mirror until
 * their next sign-in or a webhook that was applied.
 */
export async function isOwnerInWorkOS(workosUserId: string, organizationId: string): Promise<boolean> {
  const page = await getWorkOSClient().userManagement.listOrganizationMemberships({
    userId: workosUserId,
    organizationId,
    statuses: ['active'],
    limit: 10,
  });

  return page.data.some(
    (membership) =>
      membership.organizationId === organizationId &&
      membership.userId === workosUserId &&
      membership.status === 'active' &&
      isOwnerRole(membership.role.slug)
  );
}

export function isOwnerRole(roleSlug: string) {
  return roleSlug === OWNER_ROLE_SLUG;
}
