import 'server-only';

import { eq, sql } from 'drizzle-orm';
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
 *
 * Plan and region are not among them. The service used to pass constants
 * that restated the schema's defaults, for columns nothing reads; now a new
 * row takes the defaults and an existing one keeps what it has.
 */
export async function upsertCreated(
  handle: IdentityDb,
  row: {
    id: OrganizationId;
    name: string;
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
        createdBy: sql`excluded.created_by`,
      },
    });
}

/**
 * Soft delete: memberships and history survive, the organization stops being
 * listed. `at` is when WorkOS deleted it; the stamp makes a late 'updated'
 * event from before the deletion lose.
 *
 * An organization not mirrored yet gets a tombstone, named after its id like
 * a placeholder. This used to be a plain UPDATE, which wrote nothing for an
 * organization we had not seen, so a 'created' or 'updated' event delivered
 * after the deletion inserted it as active. A known organization only has
 * its status, deletion time and stamp written: its name, plan, region and
 * creator are left as they are.
 */
export async function markDeleted(handle: IdentityDb, id: OrganizationId, at: Date): Promise<void> {
  const db = unwrap(handle);

  await db
    .insert(organizations)
    .values({ id, name: mirroredName(id, id), status: 'deleted', deletedAt: at, workosUpdatedAt: at })
    .onConflictDoUpdate({
      target: organizations.id,
      set: {
        status: sql`excluded.status`,
        deletedAt: sql`excluded.deleted_at`,
        workosUpdatedAt: sql`excluded.workos_updated_at`,
      },
      where: proposedIsNotOlder('organizations'),
    });
}

export type OrganizationPatch = Partial<Pick<OrganizationRow, 'name' | 'onboardingCompletedAt'>>;

/**
 * Returns the updated row, or null when there is no such organization.
 * `workosUpdatedAt` is the WorkOS organization's updatedAt after a rename
 * made there, so an older webhook does not put the old name back.
 *
 * The rename keeps the same clock. A webhook carrying a newer WorkOS state
 * can land between WorkOS answering the rename and this write; the name
 * used to be written regardless, putting the older name back and moving the
 * stamp backwards. Now the name is written only when the stored state is
 * not newer, and the stamp only ever moves forward. The guard sits in SET,
 * not WHERE: onboarding is ours alone and is written either way, and the
 * row is still returned. A guard in WHERE would drop the onboarding write
 * too and return null, which the route reads as "no such organization".
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
    .set(workosUpdatedAt ? { ...patch, ...byWorkOSClock(patch.name, workosUpdatedAt) } : patch)
    .where(eq(organizations.id, id))
    .returning();

  return row ?? null;
}

/**
 * The WorkOS half of a rename WorkOS answered at `at`: the name only when
 * the stored state is not newer (mirror-order.ts), and the later stamp.
 */
function byWorkOSClock(name: string | undefined, at: Date) {
  // Bound through the column, as storedIsNotNewer binds its comparison.
  const workosUpdatedAt = sql`greatest(${organizations.workosUpdatedAt}, ${sql.param(at, organizations.workosUpdatedAt)})`;

  if (name === undefined) return { workosUpdatedAt };

  const applies = storedIsNotNewer(organizations.workosUpdatedAt, at);

  return { name: sql`case when ${applies} then ${name} else ${organizations.name} end`, workosUpdatedAt };
}
