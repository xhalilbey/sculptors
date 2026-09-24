import 'server-only';

import type { DbExecutor } from '@/db/client';

/**
 * The handle services pass to identity repositories: the pool or an open
 * transaction, sealed so that only a repository can use it.
 *
 * Services (lib/workos, lib/auth, lib/security) hold an IdentityDb so that
 * several repository calls can share one transaction. Before this it was
 * the Drizzle executor itself, so `identityDb().execute(sql`...`)` or
 * `.select()` compiled anywhere the barrel was imported, and the "only
 * repositories query" rule rested on review. Now the type has no methods,
 * the value is an empty frozen object, and the executor is reachable only
 * through unwrap(), which ESLint lets nothing outside src/lib/identity and
 * tests import.
 */

declare const brand: unique symbol;

export type IdentityDb = { readonly [brand]: true };

const executors = new WeakMap<IdentityDb, DbExecutor>();

export function wrap(db: DbExecutor): IdentityDb {
  // The cast is the seal itself: an empty object typed as the brand, with
  // the executor kept beside it rather than on it.
  const handle = Object.freeze({}) as IdentityDb;

  executors.set(handle, db);

  return handle;
}

export function unwrap(handle: IdentityDb): DbExecutor {
  const db = executors.get(handle);

  if (!db) {
    throw new TypeError('Not an identity handle: use identityDb() or withIdentityTransaction()');
  }

  return db;
}
