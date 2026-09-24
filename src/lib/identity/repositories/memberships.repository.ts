import 'server-only';

import { and, asc, eq, notInArray, sql } from 'drizzle-orm';
import {
  organizationMemberships,
  organizations,
  type MembershipRow,
  type NewMembershipRow,
  type OrganizationRow,
} from '@/db/schema';
import type { MembershipId, OrganizationId, UserId } from '@/types/ids';
import { unwrap, type IdentityDb } from '../internal/handle';
import { proposedIsNotOlder, storedIsNotNewer } from './mirror-order';

export type MirroredMembership = MembershipRow & { organization: OrganizationRow };

/**
 * A membership counts only when BOTH sides are active: an active membership
 * in a suspended or deleted organization is not something to list or to
 * authorise against.
 */
function activeFor(userId: UserId) {
  return and(
    eq(organizationMemberships.userId, userId),
    eq(organizationMemberships.status, 'active'),
    eq(organizations.status, 'active')
  );
}

function joined() {
  return {
    membership: organizationMemberships,
    organization: organizations,
  };
}

/** The user's active memberships with their organizations, oldest first. */
export async function listActiveForUser(handle: IdentityDb, userId: UserId): Promise<MirroredMembership[]> {
  const db = unwrap(handle);

  const rows = await db
    .select(joined())
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(activeFor(userId))
    .orderBy(asc(organizationMemberships.createdAt), asc(organizationMemberships.id));

  return rows.map((row) => ({ ...row.membership, organization: row.organization }));
}

export async function findActive(
  handle: IdentityDb,
  userId: UserId,
  organizationId: OrganizationId
): Promise<MirroredMembership | null> {
  const db = unwrap(handle);

  const [row] = await db
    .select(joined())
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
    .where(and(activeFor(userId), eq(organizationMemberships.organizationId, organizationId)))
    .limit(1);

  return row ? { ...row.membership, organization: row.organization } : null;
}

export type MembershipUpsert = Pick<
  NewMembershipRow,
  'id' | 'organizationId' | 'userId' | 'workosUserId' | 'role' | 'status'
> & {
  id: MembershipId;
  /** The WorkOS membership's updatedAt, or the deletion event's time. */
  workosUpdatedAt: Date;
};

/**
 * Upsert by WorkOS membership id; every mirrored field is refreshed, unless
 * the stored row came from a newer WorkOS state (mirror-order.ts).
 */
export async function upsertMany(handle: IdentityDb, rows: MembershipUpsert[]): Promise<void> {
  const db = unwrap(handle);

  if (rows.length === 0) return;

  await db
    .insert(organizationMemberships)
    .values(rows)
    .onConflictDoUpdate({
      target: organizationMemberships.id,
      set: {
        organizationId: sql`excluded.organization_id`,
        userId: sql`excluded.user_id`,
        workosUserId: sql`excluded.workos_user_id`,
        role: sql`excluded.role`,
        status: sql`excluded.status`,
        workosUpdatedAt: sql`excluded.workos_updated_at`,
      },
      where: proposedIsNotOlder('organization_memberships'),
    });
}

/**
 * Mark inactive every active membership of this user that WorkOS no longer
 * lists. Inactive rather than deleted, so the history of who was where
 * survives. An empty live list retires them all.
 *
 * `listedAt` is when the list was read from WorkOS. A membership written
 * from a newer WorkOS state than that (a webhook that landed while the list
 * was in flight) is not the list's to retire.
 */
export async function retireStale(
  handle: IdentityDb,
  userId: UserId,
  liveIds: MembershipId[],
  listedAt: Date
): Promise<void> {
  const db = unwrap(handle);

  await db
    .update(organizationMemberships)
    .set({ status: 'inactive', workosUpdatedAt: listedAt })
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, 'active'),
        liveIds.length > 0 ? notInArray(organizationMemberships.id, liveIds) : undefined,
        storedIsNotNewer(organizationMemberships.workosUpdatedAt, listedAt)
      )
    );
}

/** A user deleted in WorkOS at `at`: every membership newer-or-equal stamped stays as it is. */
export async function deactivateByWorkOSUserId(handle: IdentityDb, workosUserId: string, at: Date): Promise<void> {
  const db = unwrap(handle);

  await db
    .update(organizationMemberships)
    .set({ status: 'inactive', workosUpdatedAt: at })
    .where(
      and(
        eq(organizationMemberships.workosUserId, workosUserId),
        storedIsNotNewer(organizationMemberships.workosUpdatedAt, at)
      )
    );
}
