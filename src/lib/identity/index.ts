import 'server-only';

import { getDb } from '@/db/client';
import { wrap, type IdentityDb } from './internal/handle';

/**
 * Identity persistence: the WorkOS mirror (users, organizations, memberships)
 * and the webhook log. This is control-plane data, read across organizations
 * by design, so it does not go through withTenant.
 *
 * Services in lib/workos and lib/auth, and defineRoute (lib/api) for the id
 * guards, import this barrel and nothing deeper; the ESLint boundary keeps
 * drizzle-orm, pg and src/db out of everything else. A service holds an
 * `IdentityDb` only to hand it back to a repository, which is what lets
 * several writes share one transaction. The handle is opaque
 * (internal/handle.ts): a service cannot run a query with it.
 *
 * Past `IdentityDb`, which names the handle these functions return, the
 * barrel exports only what those callers import. A type only a repository
 * and its tests use is imported from the repository itself.
 */

export type { IdentityDb };

/** The pool, as a handle a repository accepts. */
export function identityDb(): IdentityDb {
  return wrap(getDb());
}

/** Run several repository calls as one unit of work. No network I/O inside. */
export function withIdentityTransaction<T>(fn: (tx: IdentityDb) => Promise<T>): Promise<T> {
  return getDb().transaction((tx) => fn(wrap(tx)));
}

/**
 * Several reads that must agree with each other (a user's status and their
 * memberships), as one READ ONLY transaction: the database refuses a write
 * inside it, which is what makes the per-request path provably read-only.
 */
export function withIdentityReadTransaction<T>(fn: (tx: IdentityDb) => Promise<T>): Promise<T> {
  return getDb().transaction((tx) => fn(wrap(tx)), { accessMode: 'read only' });
}

export * as usersRepository from './repositories/users.repository';
export * as organizationsRepository from './repositories/organizations.repository';
export * as membershipsRepository from './repositories/memberships.repository';
export * as webhookEventsRepository from './repositories/webhook-events.repository';
export { databaseFailureNote } from './database-error';

export type { MirroredMembership } from './repositories/memberships.repository';
export type { OrganizationPatch } from './repositories/organizations.repository';
export type { OrganizationRow, UserRow } from '@/db/schema';
export {
  isMembershipId,
  isOrganizationId,
  isUserId,
  parseMembershipId,
  parseOrganizationId,
  parseUserId,
  type OrganizationId,
  type UserId,
} from '@/types/ids';
