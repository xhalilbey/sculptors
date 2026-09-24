import 'server-only';

import { isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/**
 * Ordering for mirror writes, by WorkOS's clock.
 *
 * Each mirrored row keeps `workos_updated_at`: the updatedAt (or, for a
 * deletion, the event time) of the WorkOS object it was last written from.
 * A write carrying an OLDER time is ignored, so a membership deleted at t2
 * is not revived by an 'updated' event from t1 delivered late, and a
 * sign-in's snapshot does not undo a newer webhook. An equal time applies
 * (a retried event converges), and a row never stamped accepts anything.
 */

type MirrorTable = 'users' | 'organizations' | 'organization_memberships';

/**
 * The columns a write takes from WorkOS only when it is not older, as the
 * database spells them. Written out rather than read from a PgColumn: with
 * `casing: 'snake_case'` a column's `.name` is its camelCase key, so
 * `excluded.${column.name}` would name a column that does not exist.
 */
type MirroredColumn = 'email' | 'first_name' | 'last_name' | 'avatar_url' | 'name';

// Table and column names come from the unions above, never from input, so
// sql.raw is safe. The column used to be any string, which left that to review.
const notOlder = (table: MirrorTable) =>
  `(excluded.workos_updated_at >= ${table}.workos_updated_at or ${table}.workos_updated_at is null)`;

/** For `on conflict do update ... where`: the proposed row is not older than the stored one. */
export function proposedIsNotOlder(table: MirrorTable): SQL {
  return sql.raw(notOlder(table));
}

/** For an UPDATE: the stored row is not newer than `at`. */
export function storedIsNotNewer(column: PgColumn, at: Date): SQL | undefined {
  return or(isNull(column), lte(column, at));
}

/** For a column in `on conflict do update set`: the proposed value only when it is not older. */
export function fromProposedIfNotOlder(table: MirrorTable, column: MirroredColumn): SQL {
  return sql.raw(`case when ${notOlder(table)} then excluded.${column} else ${table}.${column} end`);
}

/** The later of the stored and proposed stamps (greatest() ignores nulls). */
export function laterStamp(table: MirrorTable): SQL {
  return sql.raw(`greatest(${table}.workos_updated_at, excluded.workos_updated_at)`);
}
