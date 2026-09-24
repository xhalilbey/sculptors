import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db, Tx } from '@/db/client';
import { withTenant, type TenantDb } from '@/db/tenant';
import type { OrganizationId } from '@/types/ids';

/**
 * An in-process Postgres (PGlite, same major as Neon) with the REAL migration
 * set applied, so every test run also proves the migrations apply from zero.
 *
 * PGlite connects as a superuser, which ignores RLS. `asAppRole` and
 * `asTenant` switch to sculptors_app inside the transaction, which is what
 * makes the policies observable in tests.
 */
export async function createTestDb() {
  const client = new PGlite();
  const pgliteDb = drizzle({ client, casing: 'snake_case' });

  // On Neon the role exists before any migration (db/bootstrap-roles.sql);
  // 0000's policies and 0002's grants reference it.
  await pgliteDb.execute(sql`create role sculptors_app nologin nosuperuser nobypassrls`);
  await migrate(pgliteDb, {
    migrationsFolder: 'drizzle',
    migrationsSchema: 'drizzle',
    migrationsTable: '__drizzle_migrations',
  });

  // The query builder is the same across drivers; only the result HKT type
  // differs. Repositories are typed against the node-postgres flavour.
  const db = pgliteDb as unknown as Db;

  // The same handle, except that every transaction opens as sculptors_app.
  // withTenant takes it as its `db`, so the production code under test is
  // unchanged: the role switch lives here, not behind an option on the
  // tenant boundary.
  const appRoleDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== 'transaction') return Reflect.get(target, property, receiver);

      const transaction: Db['transaction'] = (fn, config) =>
        target.transaction(async (tx) => {
          await tx.execute(sql`set local role sculptors_app`);

          return fn(tx);
        }, config);

      return transaction;
    },
  });

  const asTenant = <T>(organizationId: OrganizationId, fn: (tenant: TenantDb) => Promise<T>) =>
    withTenant(organizationId, fn, { db: appRoleDb });

  const asAppRole = <T>(fn: (tx: Tx) => Promise<T>) => appRoleDb.transaction(fn);

  return { db, client, asTenant, asAppRole, close: () => client.close() };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
