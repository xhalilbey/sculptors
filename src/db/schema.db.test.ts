import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tenantPolicy } from '@/db/schema/_shared';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import { parseOrganizationId } from '@/types/ids';

/**
 * The access model lives in the migrations, so the migrations are what is
 * tested: they apply from zero, every table has RLS, every table has the
 * policy its kind requires, and the app role cannot reach the bookkeeping.
 */

let t: TestDb;

// Identity tables are read across organizations by design (the auth path
// lists a user's organizations); everything else with an organization_id is
// a tenant table and must be isolated.
const CONTROL_PLANE = ['users', 'organizations', 'organization_memberships', 'workos_webhook_events'];

beforeAll(async () => {
  t = await createTestDb();
});

afterAll(async () => {
  await t.close();
});

/** Drizzle wraps driver errors; the Postgres message is on `cause`. */
async function postgresError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause;

    return cause?.message ?? String(error);
  }

  return 'no error';
}

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await t.db.execute(query);

  return result.rows as T[];
}

describe('migrations', () => {
  it('apply from zero and record every journal entry', async () => {
    const applied = await rows<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    // Counted from the journal, so a new migration does not need this edited.
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as { entries: unknown[] };

    expect(journal.entries.length).toBeGreaterThan(0);
    expect(applied[0]?.n).toBe(journal.entries.length);
  });

  it('create exactly the identity tables in public', async () => {
    const tables = await rows<{ relname: string }>(sql`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by c.relname`);

    expect(tables.map((r) => r.relname).sort()).toEqual([...CONTROL_PLANE].sort());
  });

  it('carry the named constraints of the original bootstrap schema', async () => {
    const constraints = await rows<{ conname: string }>(sql`
      select conname from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public' and contype in ('c', 'u')`);
    const names = constraints.map((r) => r.conname);

    expect(names).toEqual(
      expect.arrayContaining([
        'users_workos_user_id_key',
        'users_status_check',
        'organizations_id_check',
        'organizations_name_check',
        'organizations_status_check',
        'organization_memberships_org_user_key',
        'organization_memberships_id_check',
        'organization_memberships_status_check',
      ])
    );

    const indexes = await rows<{ indexname: string }>(sql`select indexname from pg_indexes where schemaname = 'public'`);

    expect(indexes.map((r) => r.indexname)).toEqual(
      expect.arrayContaining([
        'users_email_lower_idx',
        'organization_memberships_user_idx',
        'organization_memberships_org_idx',
        'workos_webhook_events_unprocessed_idx',
      ])
    );
  });

  it('keys users by WorkOS id only: an email is not unique', async () => {
    const unique = await rows<{ indexname: string }>(
      sql`select indexname from pg_indexes where schemaname = 'public' and tablename = 'users' and indexdef like 'CREATE UNIQUE%'`
    );

    expect(unique.map((r) => r.indexname).sort()).toEqual(['users_pkey', 'users_workos_user_id_key']);
  });
});

describe('row level security', () => {
  it('is enabled on every table in public', async () => {
    const off = await rows<{ relname: string }>(sql`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);

    expect(off).toEqual([]);
  });

  // Permissive policies are OR'ed. One extra policy `TO public` (which the
  // app role is part of) or `using (true)` on a tenant table would open the
  // rows no matter how tight the intended one is, so the invariants are about
  // EVERY policy, not about the presence of the right one.
  it('grants every policy to the app role and nobody else', async () => {
    const policies = await rows<{ tablename: string; policyname: string; roles: string }>(sql`
      select tablename, policyname, roles::text as roles from pg_policies where schemaname = 'public'`);

    expect(policies.length).toBeGreaterThan(0);

    for (const policy of policies) {
      expect(policy.roles, `${policy.tablename}.${policy.policyname}`).toBe('{sculptors_app}');
    }
  });

  it('gives every control-plane table its explicit app-role policy', async () => {
    const policies = await rows<{ policyname: string }>(sql`
      select policyname from pg_policies where schemaname = 'public'`);

    for (const table of CONTROL_PLANE) {
      expect(policies.map((p) => p.policyname), table).toContain(`${table}_app_all`);
    }
  });

  it('isolates every other table with an organization_id by app.organization_id, in every policy', async () => {
    const tenantTables = await rows<{ table_name: string }>(sql`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'organization_id'`);
    const policies = await rows<{ tablename: string; policyname: string; qual: string | null; with_check: string | null }>(sql`
      select tablename, policyname, qual, with_check from pg_policies where schemaname = 'public'`);

    for (const { table_name: table } of tenantTables) {
      if (CONTROL_PLANE.includes(table)) continue;

      const own = policies.filter((p) => p.tablename === table);

      expect(own.length, `${table} has no tenant isolation policy`).toBeGreaterThan(0);

      for (const policy of own) {
        expect(policy.qual ?? '', `${table}.${policy.policyname} using`).toContain('app.organization_id');
        expect(policy.with_check ?? '', `${table}.${policy.policyname} with check`).toContain('app.organization_id');
      }
    }
  });
});

// No tenant table exists yet, so the migrations never exercise tenantPolicy's
// predicate. A throwaway table with that exact policy does, as the app role.
describe('tenantPolicy', () => {
  const orgA = parseOrganizationId('org_PolicyA');
  const orgB = parseOrganizationId('org_PolicyB');

  const count = (result: { rows: unknown[] }) => result.rows.length;

  beforeAll(async () => {
    const policy = tenantPolicy('tenant_probe');
    const dialect = new PgDialect({ casing: 'snake_case' });

    if (!policy.using || !policy.withCheck) throw new Error('tenantPolicy must define USING and WITH CHECK');

    const using = dialect.sqlToQuery(policy.using).sql;
    const withCheck = dialect.sqlToQuery(policy.withCheck).sql;

    await t.db.execute(sql`create table public.tenant_probe (id int primary key, organization_id text not null)`);
    await t.db.execute(sql`alter table public.tenant_probe enable row level security`);
    await t.db.execute(
      sql.raw(`create policy tenant_probe_tenant_isolation on public.tenant_probe as permissive for all
        to sculptors_app using (${using}) with check (${withCheck})`)
    );
    await t.db.execute(sql`insert into public.tenant_probe values (1, ${orgA}), (2, ${orgB})`);
  });

  afterAll(async () => {
    await t.db.execute(sql`drop table public.tenant_probe`);
  });

  it('shows a tenant only its own rows', async () => {
    const seen = await t.asTenant(orgA, (tenant) => tenant.tx.execute(sql`select id from public.tenant_probe`));

    expect(seen.rows).toEqual([{ id: 1 }]);
  });

  it('shows nothing when no tenant, or an empty one, is set', async () => {
    expect(count(await t.asAppRole((tx) => tx.execute(sql`select id from public.tenant_probe`)))).toBe(0);
    expect(
      count(
        await t.asAppRole(async (tx) => {
          await tx.execute(sql`select set_config('app.organization_id', '', true)`);

          return tx.execute(sql`select id from public.tenant_probe`);
        })
      )
    ).toBe(0);
  });

  it("refuses to write a row into another tenant or move one there", async () => {
    expect(
      await postgresError(
        t.asTenant(orgA, (tenant) => tenant.tx.execute(sql`insert into public.tenant_probe values (3, ${orgB})`))
      )
    ).toMatch(/row-level security/);
    expect(
      await postgresError(
        t.asTenant(orgA, (tenant) =>
          tenant.tx.execute(sql`update public.tenant_probe set organization_id = ${orgB} where id = 1`)
        )
      )
    ).toMatch(/row-level security/);
  });

  it("cannot touch another tenant's rows", async () => {
    const touched = await t.asTenant(orgA, async (tenant) => {
      const updated = await tenant.tx.execute(sql`update public.tenant_probe set id = id where organization_id = ${orgB}`);
      const deleted = await tenant.tx.execute(sql`delete from public.tenant_probe where organization_id = ${orgB}`);

      return [updated.rowCount, deleted.rowCount];
    });

    expect(touched).toEqual([0, 0]);

    const all = await rows<{ id: number }>(sql`select id from public.tenant_probe order by id`);

    expect(all).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe('the app role', () => {
  it('can use the identity tables', async () => {
    await expect(t.asAppRole((tx) => tx.execute(sql`select count(*) from public.users`))).resolves.toBeDefined();
  });

  it('cannot read the migration bookkeeping', async () => {
    expect(
      await postgresError(t.asAppRole((tx) => tx.execute(sql`select * from drizzle.__drizzle_migrations`)))
    ).toMatch(/permission denied for schema drizzle/);
  });

  it('cannot change the schema', async () => {
    expect(
      await postgresError(t.asAppRole((tx) => tx.execute(sql`create table public.intruder (id int)`)))
    ).toMatch(/permission denied for schema public/);
  });
});

describe('updated_at', () => {
  it('moves on update without the caller setting it', async () => {
    await t.db.execute(sql`insert into users (id, workos_user_id, email, updated_at)
      values ('00000000-0000-4000-8000-000000000001', 'user_trigger', 'trigger@example.com', now() - interval '1 day')`);
    await t.db.execute(sql`update users set first_name = 'T' where workos_user_id = 'user_trigger'`);

    const [row] = await rows<{ fresh: boolean }>(
      sql`select updated_at > now() - interval '1 minute' as fresh from users where workos_user_id = 'user_trigger'`
    );

    expect(row?.fresh).toBe(true);
  });
});
