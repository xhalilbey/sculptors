import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import { organizations, type OrganizationRow } from '@/db/schema';
import type { OrganizationId, UserId } from '@/types/ids';
import { unwrap, type IdentityDb } from '../internal/handle';
import { fromProposedIfNotOlder, laterStamp, proposedIsNotOlder, storedIsNotNewer } from './mirror-order';

/** The CHECK on organizations.name: char_length, in code points. */
const NAME_LIMIT = 100;

/**
 * A name as this table can hold it. WorkOS accepts names this table cannot
 * hold -- a NUL, which Postgres text refuses, or more than 100 code points,
 * which the CHECK refuses -- whether they come from its dashboard, its API
 * or a default we generated. One such name used to fail every sign-in sync
 * and every webhook retry for its members. Control characters are dropped,
 * the rest is cut to the first 100 code points, and a name left empty
 * becomes the id, like a placeholder's. WorkOS keeps the full name; the
 * mirror is only a copy of it.
 */
function mirroredName(name: string, id: OrganizationId): string {
  const cleaned = name.replace(/\p{Cc}/gu, '').trim();

  return Array.from(cleaned || id)
    .slice(0, NAME_LIMIT)
    .join('');
}

/**
 * Mirror organization names from WorkOS. Only `name` is refreshed on
 * conflict: plan, region, onboarding and status are ours and a
 * sync must never overwrite them. A name from an older WorkOS state than
 * the stored one is ignored (mirror-order.ts).
 */
export async function upsertNames(
  handle: IdentityDb,
  rows: { id: OrganizationId; name: string; workosUpdatedAt: Date }[]
): Promise<void> {
  const db = unwrap(handle);

  if (rows.length === 0) return;

  await db
    .insert(organizations)
    .values(rows.map(row => ({ ...row, name: mirroredName(row.name, row.id) })))
    .onConflictDoUpdate({
      target: organizations.id,
      set: { name: sql`excluded.name`, workosUpdatedAt: sql`excluded.workos_updated_at` },
      where: proposedIsNotOlder('organizations'),
    });
}

/**
 * Make sure a row exists for a foreign key, without touching one that does.
 * A membership webhook can arrive before we have seen its organization. The
 * placeholder carries no WorkOS time, so any organization event overwrites
 * its name.
 */
export async function insertIfMissing(handle: IdentityDb, row: { id: OrganizationId; name: string }): Promise<void> {
  const db = unwrap(handle);

  await db
    .insert(organizations)
    .values({ ...row, name: mirroredName(row.name, row.id) })
    .onConflictDoNothing({ target: organizations.id });
}

/**
 * Mirror an organization this app just created in WorkOS. Unlike a sync,
 * creation owns every field it sets, so all of them are refreshed.
 */
export async function upsertCreated(
  handle: IdentityDb,
  row: {
    id: OrganizationId;
    name: string;
    plan: string;
    region: string;
    createdBy: UserId;
    /** The created WorkOS organization's updatedAt. */
    workosUpdatedAt: Date;
  }
): Promise<void> {
  const db = unwrap(handle);

  await db
    .insert(organizations)
    .values({ ...row, name: mirroredName(row.name, row.id) })
    .onConflictDoUpdate({
      target: organizations.id,
      set: {
        // A webhook about this organization can land before this write;
        // the name is the one field WorkOS may already have changed since.
        name: fromProposedIfNotOlder('organizations', 'name'),
        workosUpdatedAt: laterStamp('organizations'),
        plan: sql`excluded.plan`,
        region: sql`excluded.region`,
        createdBy: sql`excluded.created_by`,
      },
    });
}

/**
 * Soft delete: memberships and history survive, the organization stops being
 * listed. `at` is when WorkOS deleted it; the stamp makes a late 'updated'
 * event from before the deletion lose.
 */
export async function markDeleted(handle: IdentityDb, id: OrganizationId, at: Date): Promise<void> {
  const db = unwrap(handle);

  await db
    .update(organizations)
    .set({ status: 'deleted', deletedAt: at, workosUpdatedAt: at })
    .where(and(eq(organizations.id, id), storedIsNotNewer(organizations.workosUpdatedAt, at)));
}

export type OrganizationPatch = Partial<Pick<OrganizationRow, 'name' | 'onboardingCompletedAt'>>;

/**
 * Returns the updated row, or null when there is no such organization.
 * `workosUpdatedAt` is the WorkOS organization's updatedAt after a rename
 * made there, so an older webhook does not put the old name back.
 */
export async function update(
  handle: IdentityDb,
  id: OrganizationId,
  patch: OrganizationPatch,
  workosUpdatedAt?: Date
): Promise<OrganizationRow | null> {
  const db = unwrap(handle);

  if (Object.keys(patch).length === 0) {
    throw new RangeError('Organization update needs at least one field');
  }

  const [row] = await db
    .update(organizations)
    .set(workosUpdatedAt ? { ...patch, workosUpdatedAt } : patch)
    .where(eq(organizations.id, id))
    .returning();

  return row ?? null;
}
