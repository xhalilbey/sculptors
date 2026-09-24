import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import { wrap, type IdentityDb } from '../internal/handle';
import { org, seedUser } from '../testing.test-utils';
import * as organizations from './organizations.repository';

let t: TestDb;
/** The PGlite handle, sealed the way services hand it to repositories. */
let db: IdentityDb;
/** Every write here comes from the same WorkOS moment unless a test says otherwise. */
const T0 = new Date('2026-09-01T00:00:00Z');

beforeAll(async () => {
  t = await createTestDb();
  db = wrap(t.db);
});

afterAll(async () => {
  await t.close();
});

async function read(id: string) {
  const result = await t.db.execute<Record<string, unknown>>(sql`select * from organizations where id = ${id}`);

  return result.rows[0];
}

describe('organizations.upsertNames', () => {
  it('inserts with defaults and, on conflict, refreshes only the name', async () => {
    await organizations.upsertNames(db, [{ id: org('org_sync'), name: 'First', workosUpdatedAt: T0 }]);
    expect(await read('org_sync')).toMatchObject({ name: 'First', plan: 'free', region: 'eu-central-1', status: 'active', slug: '' });

    await t.db.execute(sql`update organizations set plan = 'pro', status = 'suspended' where id = 'org_sync'`);
    await organizations.upsertNames(db, [{ id: org('org_sync'), name: 'Renamed', workosUpdatedAt: T0 }]);

    expect(await read('org_sync')).toMatchObject({ name: 'Renamed', plan: 'pro', status: 'suspended' });
  });

  it('does nothing for an empty list', async () => {
    await expect(organizations.upsertNames(db, [])).resolves.toBeUndefined();
  });
});

describe('organizations.insertIfMissing', () => {
  it('never overwrites an existing row', async () => {
    await organizations.upsertNames(db, [{ id: org('org_keep'), name: 'Real name', workosUpdatedAt: T0 }]);
    await organizations.insertIfMissing(db, { id: org('org_keep'), name: 'org_keep' });
    await organizations.insertIfMissing(db, { id: org('org_placeholder'), name: 'org_placeholder' });

    expect((await read('org_keep'))?.name).toBe('Real name');
    expect((await read('org_placeholder'))?.name).toBe('org_placeholder');
  });
});

describe('organizations.upsertCreated', () => {
  it('owns and refreshes every field it sets', async () => {
    const creator = await seedUser(db);

    await organizations.upsertNames(db, [{ id: org('org_created'), name: 'From sync', workosUpdatedAt: T0 }]);
    await organizations.upsertCreated(db, {
      id: org('org_created'),
      name: 'Acme',
      plan: 'free',
      region: 'eu-central-1',
      createdBy: creator,
      workosUpdatedAt: T0,
    });

    expect(await read('org_created')).toMatchObject({ name: 'Acme', created_by: creator });
  });
});

describe('organizations.markDeleted and update', () => {
  it('soft deletes', async () => {
    await organizations.upsertNames(db, [{ id: org('org_del'), name: 'Doomed', workosUpdatedAt: T0 }]);
    await organizations.markDeleted(db, org('org_del'), T0);

    const row = await read('org_del');

    expect(row?.status).toBe('deleted');
    expect(row?.deleted_at).not.toBeNull();
  });

  it('returns the updated row, or null when there is none', async () => {
    await organizations.upsertNames(db, [{ id: org('org_upd'), name: 'Before', workosUpdatedAt: T0 }]);

    const at = new Date('2026-09-23T10:00:00.000Z');
    const updated = await organizations.update(db, org('org_upd'), {
      name: 'After',
      onboardingCompletedAt: at,
    });

    expect(updated).toMatchObject({ id: 'org_upd', name: 'After' });
    expect(updated?.onboardingCompletedAt?.toISOString()).toBe(at.toISOString());
    expect(await organizations.update(db, org('org_missing'), { name: 'X' })).toBeNull();
  });

  it('lets the database refuse what the checks forbid', async () => {
    await expect(organizations.upsertNames(db, [{ id: org('org_long'), name: 'x'.repeat(101), workosUpdatedAt: T0 }])).rejects.toThrow();
  });
});
