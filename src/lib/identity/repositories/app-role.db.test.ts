import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import type { UserId } from '@/types/ids';
import { wrap, type IdentityDb } from '../internal/handle';
import { om, org, seedUser } from '../testing.test-utils';
import * as memberships from './memberships.repository';
import * as organizations from './organizations.repository';
import * as users from './users.repository';
import * as webhookEvents from './webhook-events.repository';

/**
 * Grants and policies decide what the app can run, and every other
 * repository test runs as the PGlite superuser, whom neither binds. Here
 * every exported repository function runs once as sculptors_app, the role
 * production connects as, so a revoked privilege the app still needs
 * (0007 took DELETE on the identity tables, which none of them uses) or a
 * policy that stops admitting a statement fails here, not on the first
 * request in production. Writes are read back as the superuser, because a
 * policy that filters a row out makes an UPDATE touch nothing without an
 * error.
 */

let t: TestDb;
/** Fixtures are written as the superuser; only the calls under test switch role. */
let fixtures: IdentityDb;
/** Signs in, is read, touched and updated. */
let member: UserId;
/** Is retired from their organization. */
let leaving: UserId;

const T0 = new Date('2026-09-01T00:00:00Z');
const T1 = new Date('2026-09-02T00:00:00Z');
const ORG = org('org_AppRole');
const ORG_GONE = org('org_AppRoleGone');

/** One repository call as sculptors_app, through a handle sealed the way services get one. */
function asApp<T>(fn: (db: IdentityDb) => Promise<T>): Promise<T> {
  return t.asAppRole((tx) => fn(wrap(tx)));
}

async function read(table: 'users' | 'organizations' | 'organization_memberships' | 'workos_webhook_events', id: string) {
  const result = await t.db.execute<Record<string, unknown>>(sql`select * from ${sql.identifier(table)} where id = ${id}`);

  return result.rows[0];
}

beforeAll(async () => {
  t = await createTestDb();
  fixtures = wrap(t.db);
  member = await seedUser(fixtures, { workosUserId: 'user_app_member' });
  leaving = await seedUser(fixtures, { workosUserId: 'user_app_leaving' });
  const removed = await seedUser(fixtures, { workosUserId: 'user_app_removed' });

  await organizations.upsertNames(fixtures, [
    { id: ORG, name: 'App role', workosUpdatedAt: T0 },
    { id: ORG_GONE, name: 'App role gone', workosUpdatedAt: T0 },
  ]);
  await memberships.upsertMany(fixtures, [
    { id: om('om_AppRoleMember'), organizationId: ORG, userId: member, workosUserId: 'user_app_member', role: 'member', status: 'active', workosUpdatedAt: T0 },
    { id: om('om_AppRoleLeaving'), organizationId: ORG, userId: leaving, workosUserId: 'user_app_leaving', role: 'member', status: 'active', workosUpdatedAt: T0 },
    { id: om('om_AppRoleRemoved'), organizationId: ORG, userId: removed, workosUserId: 'user_app_removed', role: 'member', status: 'active', workosUpdatedAt: T0 },
  ]);
  await webhookEvents.record(fixtures, { id: 'event_app_role_seeded', type: 'user.updated', payload: {} });
});

afterAll(async () => {
  await t.close();
});

describe('users, as the app role', () => {
  it('upsertFromWorkOS refreshes a returning user', async () => {
    const row = await asApp((db) =>
      users.upsertFromWorkOS(db, {
        workosUserId: 'user_app_member',
        email: 'member@example.com',
        firstName: null,
        lastName: null,
        avatarUrl: null,
        workosUpdatedAt: null,
      })
    );

    expect(row.id).toBe(member);
  });

  it('findByWorkOSUserId reads a user', async () => {
    await expect(asApp((db) => users.findByWorkOSUserId(db, 'user_app_member'))).resolves.toMatchObject({ id: member });
  });

  it('findIdByWorkOSUserId reads their id', async () => {
    await expect(asApp((db) => users.findIdByWorkOSUserId(db, 'user_app_member'))).resolves.toBe(member);
  });

  it('touchLastSeen records activity', async () => {
    const later = new Date(Date.now() + 60 * 60 * 1000);

    await asApp((db) => users.touchLastSeen(db, member, later));

    expect((await users.findByWorkOSUserId(fixtures, 'user_app_member'))?.lastSeenAt).toEqual(later);
  });

  it('updateProfileByWorkOSUserId applies a profile change', async () => {
    await asApp((db) => users.updateProfileByWorkOSUserId(db, 'user_app_member', { firstName: 'Ada' }, T1));

    expect(await read('users', member)).toMatchObject({ first_name: 'Ada' });
  });

  it('deactivateByWorkOSUserId marks a deleted user inactive', async () => {
    await asApp((db) => users.deactivateByWorkOSUserId(db, 'user_app_leaving', T1));

    expect(await read('users', leaving)).toMatchObject({ status: 'inactive' });
  });
});

describe('organizations, as the app role', () => {
  it('upsertNames renames an organization', async () => {
    await asApp((db) => organizations.upsertNames(db, [{ id: ORG, name: 'App role renamed', workosUpdatedAt: T1 }]));

    expect(await read('organizations', ORG)).toMatchObject({ name: 'App role renamed' });
  });

  it('insertIfMissing adds a placeholder', async () => {
    await asApp((db) => organizations.insertIfMissing(db, { id: org('org_AppRolePlaceholder'), name: 'Placeholder' }));

    expect(await read('organizations', 'org_AppRolePlaceholder')).toMatchObject({ name: 'Placeholder' });
  });

  it('upsertCreated mirrors a new organization', async () => {
    await asApp((db) =>
      organizations.upsertCreated(db, {
        id: org('org_AppRoleCreated'),
        name: 'Created',
        createdBy: member,
        workosUpdatedAt: T0,
      })
    );

    expect(await read('organizations', 'org_AppRoleCreated')).toMatchObject({ name: 'Created', created_by: member });
  });

  it('markDeleted marks an organization deleted', async () => {
    await asApp((db) => organizations.markDeleted(db, ORG_GONE, T1));

    expect(await read('organizations', ORG_GONE)).toMatchObject({ status: 'deleted' });
  });

  it('update changes an organization', async () => {
    await expect(asApp((db) => organizations.update(db, ORG, { name: 'App role updated' }))).resolves.toMatchObject({
      id: ORG,
      name: 'App role updated',
    });
  });
});

describe('memberships, as the app role', () => {
  it('listActiveForUser lists the active memberships', async () => {
    const listed = await asApp((db) => memberships.listActiveForUser(db, member));

    expect(listed.map((row) => row.id)).toEqual(['om_AppRoleMember']);
  });

  it('findActive finds one membership', async () => {
    await expect(asApp((db) => memberships.findActive(db, member, ORG))).resolves.toMatchObject({ id: 'om_AppRoleMember' });
  });

  it('upsertMany refreshes a membership', async () => {
    await asApp((db) =>
      memberships.upsertMany(db, [
        { id: om('om_AppRoleMember'), organizationId: ORG, userId: member, workosUserId: 'user_app_member', role: 'admin', status: 'active', workosUpdatedAt: T1 },
      ])
    );

    expect(await read('organization_memberships', 'om_AppRoleMember')).toMatchObject({ role: 'admin' });
  });

  it('retireStale retires a membership WorkOS no longer lists', async () => {
    await asApp((db) => memberships.retireStale(db, leaving, [], T1));

    expect(await read('organization_memberships', 'om_AppRoleLeaving')).toMatchObject({ status: 'inactive' });
  });

  it('deactivateByWorkOSUserId retires every membership of a deleted user', async () => {
    await asApp((db) => memberships.deactivateByWorkOSUserId(db, 'user_app_removed', T1));

    expect(await read('organization_memberships', 'om_AppRoleRemoved')).toMatchObject({ status: 'inactive' });
  });
});

describe('webhookEvents, as the app role', () => {
  // The second call reads xmax to tell a retry from an insert, so it also
  // proves that system column is readable by the app role.
  it('record inserts an event, then counts its retry', async () => {
    const event = { id: 'event_app_role', type: 'organization.updated', payload: { id: 'org_AppRole' } };

    await expect(asApp((db) => webhookEvents.record(db, event))).resolves.toBe('recorded');
    await expect(asApp((db) => webhookEvents.record(db, event))).resolves.toBe('retry');
  });

  it('markFailed keeps why an attempt failed', async () => {
    await asApp((db) => webhookEvents.markFailed(db, 'event_app_role_seeded', 'boom'));

    expect(await read('workos_webhook_events', 'event_app_role_seeded')).toMatchObject({ error: 'boom' });
  });

  it('markProcessed stamps the event', async () => {
    await asApp((db) => webhookEvents.markProcessed(db, 'event_app_role_seeded', T1));

    expect((await read('workos_webhook_events', 'event_app_role_seeded'))?.processed_at).not.toBeNull();
  });
});
