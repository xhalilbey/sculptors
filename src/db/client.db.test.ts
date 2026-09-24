import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertDatabaseRole } from '@/db/client';
import { createTestDb, type TestDb } from '@/db/testing/pglite';

/**
 * The startup check is the only thing standing between a wrong DATABASE_URL
 * and every RLS policy silently not applying. Each way a role can escape RLS
 * must make it refuse; the plain app role must pass.
 */

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
  await t.db.execute(sql`create role table_owner nologin`);
  await t.db.execute(sql`create table public.role_probe (id int)`);
  await t.db.execute(sql`alter table public.role_probe owner to table_owner`);
});

afterAll(async () => {
  await t.close();
});

describe('assertDatabaseRole', () => {
  it('refuses a superuser (PGlite connects as one)', async () => {
    await expect(assertDatabaseRole(t.db)).rejects.toThrow(/SUPERUSER/);
  });

  it('accepts the plain app role', async () => {
    await expect(t.asAppRole((tx) => assertDatabaseRole(tx))).resolves.toBeUndefined();
  });

  it('refuses the app role once it holds a table owner through membership', async () => {
    await t.db.execute(sql`grant table_owner to sculptors_app`);

    try {
      await expect(t.asAppRole((tx) => assertDatabaseRole(tx))).rejects.toThrow(
        /member of another role.*owns \(or holds the owner of\) a table/
      );
    } finally {
      await t.db.execute(sql`revoke table_owner from sculptors_app`);
    }
  });

  it('refuses the app role when it owns a table itself', async () => {
    await t.db.execute(sql`alter table public.role_probe owner to sculptors_app`);

    try {
      await expect(t.asAppRole((tx) => assertDatabaseRole(tx))).rejects.toThrow(/owns/);
    } finally {
      await t.db.execute(sql`alter table public.role_probe owner to table_owner`);
    }
  });

  it('refuses a role with BYPASSRLS', async () => {
    await t.db.execute(sql`alter role sculptors_app bypassrls`);

    try {
      await expect(t.asAppRole((tx) => assertDatabaseRole(tx))).rejects.toThrow(/BYPASSRLS/);
    } finally {
      await t.db.execute(sql`alter role sculptors_app nobypassrls`);
    }
  });
});
