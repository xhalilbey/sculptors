import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import { parseOrganizationId } from '@/types/ids';

/**
 * withTenant is the only way a request gets a tenant. What it must guarantee
 * is that the setting exists inside the unit of work and nowhere after it,
 * because the next transaction on that pooled backend belongs to someone else.
 */

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
});

afterAll(async () => {
  await t.close();
});

async function currentOrganization(): Promise<string | null> {
  const result = await t.db.execute<{ org: string | null }>(
    sql`select current_setting('app.organization_id', true) as org`
  );

  return result.rows[0]?.org ?? null;
}

describe('withTenant', () => {
  it('sets app.organization_id for the unit of work, as the app role', async () => {
    const seen = await t.asTenant(parseOrganizationId('org_A1'), async (tenant) => {
      const result = await tenant.tx.execute<{ org: string; role: string }>(
        sql`select current_setting('app.organization_id', true) as org, current_user as role`
      );

      return result.rows[0];
    });

    expect(seen).toEqual({ org: 'org_A1', role: 'sculptors_app' });
  });

  it('leaves nothing behind for the next transaction on the same connection', async () => {
    await t.asTenant(parseOrganizationId('org_A1'), async () => undefined);

    // Unset or '' -- either way the tenant predicate compares false.
    expect(['', null]).toContain(await currentOrganization());
  });

  it('rolls the setting back with a failed unit of work', async () => {
    await expect(
      t.asTenant(parseOrganizationId('org_A1'), async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(['', null]).toContain(await currentOrganization());
  });
});
