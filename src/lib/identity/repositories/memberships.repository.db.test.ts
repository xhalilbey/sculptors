import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import type { UserId } from '@/types/ids';
import { wrap, type IdentityDb } from '../internal/handle';
import { backdate, om, org, seedUser } from '../testing.test-utils';
import * as memberships from './memberships.repository';
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

async function member(userId: UserId, workosUserId: string, membershipId: string, organizationId: string, extra: Partial<memberships.MembershipUpsert> = {}) {
  await organizations.upsertNames(db, [{ id: org(organizationId), name: organizationId, workosUpdatedAt: T0 }]);
  await memberships.upsertMany(db, [
    { id: om(membershipId), organizationId: org(organizationId), userId, workosUserId, role: 'member', status: 'active', workosUpdatedAt: T0, ...extra },
  ]);
}

async function statusOf(id: string) {
  const result = await t.db.execute<{ status: string }>(sql`select status from organization_memberships where id = ${id}`);

  return result.rows[0]?.status;
}

describe('memberships.listActiveForUser', () => {
  it('lists active memberships of active organizations, oldest first, with the organization', async () => {
    const user = await seedUser(db, { workosUserId: 'user_list' });

    await member(user, 'user_list', 'om_new', 'org_new');
    await member(user, 'user_list', 'om_old', 'org_old');
    await backdate(t.db, 'organization_memberships', 'om_old', 3);
    await member(user, 'user_list', 'om_inactive', 'org_inactive', { status: 'inactive' });
    await member(user, 'user_list', 'om_pending', 'org_pending', { status: 'pending' });
    await member(user, 'user_list', 'om_susp', 'org_susp');
    await member(user, 'user_list', 'om_gone', 'org_gone');
    await t.db.execute(sql`update organizations set status = 'suspended' where id = 'org_susp'`);
    await organizations.markDeleted(db, org('org_gone'), T0);

    const listed = await memberships.listActiveForUser(db, user);

    expect(listed.map((m) => m.id)).toEqual(['om_old', 'om_new']);
    expect(listed[0]?.organization).toMatchObject({ id: 'org_old', name: 'org_old', status: 'active' });
    expect(listed[0]?.createdAt).toBeInstanceOf(Date);
  });
});

describe('memberships.findActive', () => {
  it('finds only an active membership in an active organization', async () => {
    const user = await seedUser(db, { workosUserId: 'user_find' });
    const stranger = await seedUser(db, { workosUserId: 'user_stranger' });

    await member(user, 'user_find', 'om_find', 'org_find', { role: 'admin' });
    await member(user, 'user_find', 'om_findsusp', 'org_findsusp');
    await t.db.execute(sql`update organizations set status = 'suspended' where id = 'org_findsusp'`);

    expect(await memberships.findActive(db, user, org('org_find'))).toMatchObject({
      id: 'om_find',
      role: 'admin',
      organization: { id: 'org_find' },
    });
    expect(await memberships.findActive(db, user, org('org_findsusp'))).toBeNull();
    expect(await memberships.findActive(db, stranger, org('org_find'))).toBeNull();
  });
});

describe('memberships.upsertMany', () => {
  it('upserts by organization and user, refreshing every mirrored field', async () => {
    const user = await seedUser(db, { workosUserId: 'user_up' });

    await member(user, 'user_up', 'om_up', 'org_up');
    await memberships.upsertMany(db, [
      { id: om('om_up'), organizationId: org('org_up'), userId: user, workosUserId: 'user_up', role: 'admin', status: 'pending', workosUpdatedAt: T0 },
    ]);

    const result = await t.db.execute<{ role: string; status: string; n: number }>(
      sql`select role, status, (select count(*)::int from organization_memberships where user_id = ${user}) n from organization_memberships where id = 'om_up'`
    );

    expect(result.rows[0]).toEqual({ role: 'admin', status: 'pending', n: 1 });
  });

  // WorkOS gives a member who is removed and added again a new om_ id. The
  // pair (organization, user) is the row's key, so the new id takes the row
  // over instead of colliding with organization_memberships_org_user_key.
  const T1 = new Date('2026-09-02T00:00:00Z');
  const T2 = new Date('2026-09-04T00:00:00Z');

  async function rowsFor(user: UserId) {
    const result = await t.db.execute<{ id: string; status: string }>(
      sql`select id, status from organization_memberships where user_id = ${user} and organization_id = 'org_readd'`
    );

    return result.rows;
  }

  it('takes the new WorkOS id when a member is removed and re-added', async () => {
    const user = await seedUser(db, { workosUserId: 'user_readd' });

    await member(user, 'user_readd', 'om_readdold', 'org_readd', { status: 'inactive', workosUpdatedAt: T1 });
    await memberships.upsertMany(db, [
      { id: om('om_readdnew'), organizationId: org('org_readd'), userId: user, workosUserId: 'user_readd', role: 'member', status: 'active', workosUpdatedAt: T2 },
    ]);

    expect(await rowsFor(user)).toEqual([{ id: 'om_readdnew', status: 'active' }]);
  });

  it('refuses a late event for the old id', async () => {
    const user = await seedUser(db, { workosUserId: 'user_late' });

    await member(user, 'user_late', 'om_lateold', 'org_readd', { status: 'inactive', workosUpdatedAt: T1 });
    await memberships.upsertMany(db, [
      { id: om('om_latenew'), organizationId: org('org_readd'), userId: user, workosUserId: 'user_late', role: 'member', status: 'active', workosUpdatedAt: T2 },
    ]);
    // Between the removal and the re-add, so older than the row's state.
    await memberships.upsertMany(db, [
      { id: om('om_lateold'), organizationId: org('org_readd'), userId: user, workosUserId: 'user_late', role: 'member', status: 'inactive', workosUpdatedAt: new Date('2026-09-03T00:00:00Z') },
    ]);

    expect(await rowsFor(user)).toEqual([{ id: 'om_latenew', status: 'active' }]);
  });
});

describe('memberships.retireStale', () => {
  it('retires active memberships not in the live list, and only this user\'s', async () => {
    const user = await seedUser(db, { workosUserId: 'user_stale' });
    const other = await seedUser(db, { workosUserId: 'user_other' });

    await member(user, 'user_stale', 'om_live', 'org_live');
    await member(user, 'user_stale', 'om_stale', 'org_stale');
    await member(other, 'user_other', 'om_other', 'org_stale');

    await memberships.retireStale(db, user, [om('om_live')], T0);

    expect(await statusOf('om_live')).toBe('active');
    expect(await statusOf('om_stale')).toBe('inactive');
    expect(await statusOf('om_other')).toBe('active');
  });

  it('retires every active membership when the live list is empty', async () => {
    const user = await seedUser(db, { workosUserId: 'user_empty' });

    await member(user, 'user_empty', 'om_e1', 'org_e1');
    await member(user, 'user_empty', 'om_e2', 'org_e2');

    await memberships.retireStale(db, user, [], T0);

    expect(await statusOf('om_e1')).toBe('inactive');
    expect(await statusOf('om_e2')).toBe('inactive');
  });
});

describe('memberships.deactivateByWorkOSUserId', () => {
  it('deactivates every membership of that WorkOS user', async () => {
    const user = await seedUser(db, { workosUserId: 'user_bye' });

    await member(user, 'user_bye', 'om_bye1', 'org_bye1');
    await member(user, 'user_bye', 'om_bye2', 'org_bye2', { status: 'pending' });

    await memberships.deactivateByWorkOSUserId(db, 'user_bye', T0);

    expect(await statusOf('om_bye1')).toBe('inactive');
    expect(await statusOf('om_bye2')).toBe('inactive');
  });
});
