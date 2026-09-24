import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { organizations as organizationsTable } from '@/db/schema';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import { wrap, type IdentityDb } from '../internal/handle';
import { org, seedUser } from '../testing.test-utils';
import * as organizations from './organizations.repository';

let t: TestDb;
/** The PGlite handle, sealed the way services hand it to repositories. */
let db: IdentityDb;
/** Every write here comes from the same WorkOS moment unless a test says otherwise. */
const T0 = new Date('2026-09-01T00:00:00Z');
/** Two later WorkOS moments, for writes that land out of order. */
const T1 = new Date('2026-09-02T00:00:00Z');
const T2 = new Date('2026-09-03T00:00:00Z');

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

/** The stored row as Drizzle maps it, so its WorkOS times read back as Dates. */
async function stored(id: string) {
  const [row] = await t.db.select().from(organizationsTable).where(eq(organizationsTable.id, org(id)));

  return row;
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

  it('stores a WorkOS name the table could not hold as the nearest name it can', async () => {
    await organizations.upsertNames(db, [
      { id: org('org_nul'), name: 'Acme\u{0} Ltd', workosUpdatedAt: T0 },
      { id: org('org_150'), name: '\u{1F600}'.repeat(150), workosUpdatedAt: T0 },
    ]);

    expect((await read('org_nul'))?.name).toBe('Acme Ltd');
    expect((await read('org_150'))?.name).toBe('\u{1F600}'.repeat(100));
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

  it('names the row after its id when the name is empty', async () => {
    await organizations.insertIfMissing(db, { id: org('org_unnamed'), name: '' });

    expect((await read('org_unnamed'))?.name).toBe('org_unnamed');
  });
});

describe('organizations.upsertCreated', () => {
  it('owns and refreshes every field it sets', async () => {
    const creator = await seedUser(db);

    await organizations.upsertNames(db, [{ id: org('org_created'), name: 'From sync', workosUpdatedAt: T0 }]);
    await organizations.upsertCreated(db, {
      id: org('org_created'),
      name: 'Acme',
      createdBy: creator,
      workosUpdatedAt: T0,
    });

    expect(await read('org_created')).toMatchObject({ name: 'Acme', created_by: creator });
  });

  it('leaves plan and region to the schema defaults and keeps stored ones', async () => {
    const creator = await seedUser(db);
    const created = { id: org('org_planned'), name: 'Planned', createdBy: creator, workosUpdatedAt: T0 };

    await organizations.upsertCreated(db, created);
    expect(await read('org_planned')).toMatchObject({ plan: 'free', region: 'eu-central-1' });

    await t.db.execute(sql`update organizations set plan = 'pro', region = 'us-east-1' where id = 'org_planned'`);
    await organizations.upsertCreated(db, created);

    expect(await read('org_planned')).toMatchObject({ plan: 'pro', region: 'us-east-1' });
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

  it('writes only the deletion over a known organization', async () => {
    const creator = await seedUser(db);

    await organizations.upsertCreated(db, {
      id: org('org_known'),
      name: 'Known',
      createdBy: creator,
      workosUpdatedAt: T0,
    });
    // Not the defaults, so a deletion that reset them would show.
    await t.db.execute(sql`update organizations set plan = 'pro', region = 'us-east-1' where id = 'org_known'`);
    await organizations.markDeleted(db, org('org_known'), T1);

    expect(await stored('org_known')).toMatchObject({
      name: 'Known',
      plan: 'pro',
      region: 'us-east-1',
      createdBy: creator,
      status: 'deleted',
      deletedAt: T1,
      workosUpdatedAt: T1,
    });
  });

  it('ignores a deletion older than the stored state', async () => {
    await organizations.upsertNames(db, [{ id: org('org_newer'), name: 'Newer', workosUpdatedAt: T2 }]);
    await organizations.markDeleted(db, org('org_newer'), T1);

    expect(await stored('org_newer')).toMatchObject({ status: 'active', deletedAt: null, workosUpdatedAt: T2 });
  });

  it('leaves a tombstone for an organization deleted before it was seen', async () => {
    await organizations.markDeleted(db, org('org_unseen'), T2);
    // The 'created' event WorkOS sent at t1, delivered after the deletion.
    await organizations.upsertNames(db, [{ id: org('org_unseen'), name: 'Late', workosUpdatedAt: T1 }]);

    expect(await stored('org_unseen')).toMatchObject({
      name: 'org_unseen',
      status: 'deleted',
      deletedAt: T2,
      workosUpdatedAt: T2,
    });
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

  it('renames and moves the stamp forward with a rename no older than the stored state', async () => {
    await organizations.upsertNames(db, [{ id: org('org_fresh'), name: 'Y', workosUpdatedAt: T1 }]);

    await expect(organizations.update(db, org('org_fresh'), { name: 'X' }, T2)).resolves.toMatchObject({
      name: 'X',
      workosUpdatedAt: T2,
    });
  });

  it('keeps a newer name when an older rename lands', async () => {
    // A webhook mirrored WorkOS's state at t2 before the rename WorkOS
    // answered at t1 was written here.
    await organizations.upsertNames(db, [{ id: org('org_stale'), name: 'Y', workosUpdatedAt: T2 }]);

    await expect(organizations.update(db, org('org_stale'), { name: 'X' }, T1)).resolves.toMatchObject({
      name: 'Y',
      workosUpdatedAt: T2,
    });
    expect(await stored('org_stale')).toMatchObject({ name: 'Y', workosUpdatedAt: T2 });
  });

  it('still writes onboarding with a stale rename', async () => {
    await organizations.upsertNames(db, [{ id: org('org_staleOnboarding'), name: 'Y', workosUpdatedAt: T2 }]);

    const at = new Date('2026-09-23T10:00:00.000Z');
    const updated = await organizations.update(
      db,
      org('org_staleOnboarding'),
      { name: 'X', onboardingCompletedAt: at },
      T1
    );

    expect(updated).toMatchObject({ name: 'Y', workosUpdatedAt: T2, onboardingCompletedAt: at });
  });

  it('lets the database refuse what the checks forbid', async () => {
    // A rename is validated by its route (organizationNameSchema), so update
    // writes the name as given and the CHECK is the last word.
    await organizations.upsertNames(db, [{ id: org('org_long'), name: 'Short', workosUpdatedAt: T0 }]);

    await expect(organizations.update(db, org('org_long'), { name: 'x'.repeat(101) })).rejects.toThrow();
  });
});
