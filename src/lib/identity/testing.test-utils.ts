import { sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { parseMembershipId, parseOrganizationId, type UserId } from '@/types/ids';
import type { IdentityDb } from './internal/handle';
import * as users from './repositories/users.repository';

/** Fixtures shared by the identity repository tests. Test-only; never imported by app code. */

export const org = parseOrganizationId;
export const om = parseMembershipId;

let sequence = 0;

export async function seedUser(db: IdentityDb, overrides: Partial<users.WorkOSProfile> = {}): Promise<UserId> {
  sequence += 1;

  const row = await users.upsertFromWorkOS(db, {
    workosUserId: `user_${sequence}`,
    email: `person${sequence}@example.com`,
    firstName: null,
    lastName: null,
    avatarUrl: null,
    workosUpdatedAt: null,
    ...overrides,
  });

  return row.id;
}

/** Backdate a row so ordering and refresh assertions do not depend on clock resolution. */
export async function backdate(db: Db, table: 'users' | 'organizations' | 'organization_memberships', id: string, days: number) {
  await db.execute(
    sql`update ${sql.identifier(table)} set created_at = now() - make_interval(days => ${days}) where id = ${id}`
  );
}
