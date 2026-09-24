import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as DbClient from '@/db/client';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import { parseOrganizationId } from '@/types/ids';

/**
 * A resource check runs inside withTenant: the transaction it is handed has
 * app.organization_id set to the tenant defineRoute authorized, which is
 * what every tenant table's RLS policy compares against.
 */

let t: TestDb;

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof DbClient>()),
  getDb: () => t.db,
}));

const { defineResourceCheck, runResourceCheck } = await import('./resource-check');

beforeAll(async () => {
  t = await createTestDb();
});

afterAll(async () => {
  await t.close();
});

describe('runResourceCheck', () => {
  it('runs the check in a transaction bound to the tenant', async () => {
    const seen: string[] = [];
    const check = defineResourceCheck<{ id: string }>(async (tenant, input) => {
      const { rows } = await tenant.tx.execute<{ setting: string }>(
        sql`select current_setting('app.organization_id', true) as setting`
      );

      seen.push(rows[0]?.setting ?? '');

      return input.id === 'visible';
    });

    expect(await runResourceCheck(check, { id: 'visible' }, parseOrganizationId('org_TENANT'))).toBe(true);
    expect(await runResourceCheck(check, { id: 'hidden' }, parseOrganizationId('org_OTHER'))).toBe(false);
    expect(seen).toEqual(['org_TENANT', 'org_OTHER']);
  });

  it('leaves no tenant setting behind once the check is done', async () => {
    await runResourceCheck(defineResourceCheck(async () => true), {}, parseOrganizationId('org_TENANT'));

    const { rows } = await t.db.execute<{ setting: string | null }>(
      sql`select nullif(current_setting('app.organization_id', true), '') as setting`
    );

    expect(rows[0]?.setting ?? null).toBeNull();
  });
});
