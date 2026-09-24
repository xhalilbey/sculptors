import { WorkOS } from '@workos-inc/node';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import type * as Identity from '@/lib/identity';
import { wrap, type IdentityDb } from '@/lib/identity/internal/handle';
import { parseUserId } from '@/types/ids';

/**
 * syncMembershipsForUser against the real schema. The property that matters
 * most is new with Neon: the sync is one transaction, so a failure leaves
 * the mirror as it was rather than half updated.
 */

let t: TestDb;

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('./client', () => ({ getWorkOSClient: vi.fn() }));
vi.mock('@/lib/identity', async (importOriginal) => {
  const actual = await importOriginal<typeof Identity>();

  return {
    ...actual,
    identityDb: () => wrap(t.db),
    withIdentityTransaction: <T>(fn: (tx: IdentityDb) => Promise<T>) => t.db.transaction((tx) => fn(wrap(tx))),
  };
});

const { syncMembershipsForUser, findMembership, listWorkOSMemberships } = await import('./organizations');
const { getWorkOSClient } = await import('./client');

const LISTED_AT = new Date('2026-09-01T00:00:00Z');
const USER = parseUserId('00000000-0000-4000-8000-0000000000b1');

function workos(id: string, organizationId: string, organizationName = organizationId, updatedAt = '2026-09-01T00:00:00.000Z') {
  return {
    id,
    organizationId,
    organizationName,
    userId: 'user_sync',
    status: 'active' as const,
    role: { slug: 'member' },
    updatedAt,
  };
}

beforeAll(async () => {
  t = await createTestDb();
  await t.db.execute(sql`insert into users (id, workos_user_id, email) values (${USER}, 'user_sync', 'sync@example.com')`);
});

afterAll(async () => {
  await t.close();
});

describe('syncMembershipsForUser', () => {
  it('mirrors what WorkOS lists and retires what it no longer lists', async () => {
    let listed = await syncMembershipsForUser({
      userId: USER,
      workosUserId: 'user_sync',
      listedAt: LISTED_AT,
      memberships: [workos('om_S1', 'org_S1', 'One'), workos('om_S2', 'org_S2', 'Two')],
    });

    expect(listed.map((m) => m.organization.name).sort()).toEqual(['One', 'Two']);

    listed = await syncMembershipsForUser({
      userId: USER,
      workosUserId: 'user_sync',
      listedAt: LISTED_AT,
      memberships: [workos('om_S2', 'org_S2', 'Two renamed')],
    });

    expect(listed.map((m) => [m.id, m.organization.name])).toEqual([['om_S2', 'Two renamed']]);
    expect(await findMembership(USER, 'org_S1')).toBeNull();
  });

  it('changes nothing when any part of the sync fails', async () => {
    const before = (await t.db.execute(sql`select id, status from organization_memberships order by id`)).rows;

    await expect(
      syncMembershipsForUser({
        userId: USER,
        workosUserId: 'user_sync',
        listedAt: LISTED_AT,
        // A name the CHECK constraint refuses fails the organizations step;
        // the retirement of om_S2 that would follow must not happen either.
        memberships: [workos('om_S3', 'org_S3', 'x'.repeat(101))],
      })
    ).rejects.toThrow('Failed to load organizations');

    expect((await t.db.execute(sql`select id, status from organization_memberships order by id`)).rows).toEqual(before);
  });

  it('does not revive a membership deleted after the snapshot it syncs', async () => {
    const deletedAt = new Date('2026-09-10T00:00:00Z');

    await syncMembershipsForUser({
      userId: USER,
      workosUserId: 'user_sync',
      listedAt: LISTED_AT,
      memberships: [workos('om_S4', 'org_S4')],
    });
    // A webhook deactivated it at deletedAt.
    await t.db.execute(sql`update organization_memberships set status = 'inactive', workos_updated_at = ${deletedAt.toISOString()} where id = 'om_S4'`);

    // A sign-in whose list still carries the membership as of Sep 1.
    const listed = await syncMembershipsForUser({
      userId: USER,
      workosUserId: 'user_sync',
      listedAt: new Date('2026-09-05T00:00:00Z'),
      memberships: [workos('om_S4', 'org_S4', 'org_S4', '2026-09-01T00:00:00.000Z')],
    });

    expect(listed.map((m) => m.id)).not.toContain('om_S4');
    expect((await t.db.execute(sql`select status from organization_memberships where id = 'om_S4'`)).rows[0]).toEqual({
      status: 'inactive',
    });
  });

  it('does not retire a membership written from a state newer than its list', async () => {
    await t.db.execute(sql`insert into organizations (id, name) values ('org_S5', 'Five') on conflict do nothing`);
    // A webhook mirrored this membership after the list below was taken.
    await t.db.execute(sql`insert into organization_memberships (id, organization_id, user_id, workos_user_id, status, workos_updated_at)
      values ('om_S5', 'org_S5', ${USER}, 'user_sync', 'active', '2026-09-20T00:00:00Z')`);

    const listed = await syncMembershipsForUser({
      userId: USER,
      workosUserId: 'user_sync',
      listedAt: new Date('2026-09-19T00:00:00Z'),
      memberships: [],
    });

    expect(listed.map((m) => m.id)).toContain('om_S5');
  });

  it('lists every page of WorkOS memberships, so the sync retires nothing on page 2', async () => {
    const wire = (id: string, organizationId: string) => ({
      object: 'organization_membership',
      id,
      organization_id: organizationId,
      organization_name: organizationId,
      user_id: 'user_sync',
      status: 'active',
      role: { slug: 'member' },
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    });
    const requested: string[] = [];
    // The real SDK over a fake transport: page 1 points at page 2 by cursor.
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : String(input));

      requested.push(url.search);

      const after = url.searchParams.get('after');
      const body = after
        ? { object: 'list', data: [wire('om_P2', 'org_P2')], list_metadata: { before: 'om_P1', after: null } }
        : { object: 'list', data: [wire('om_P1', 'org_P1')], list_metadata: { before: null, after: 'om_P1' } };

      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    vi.mocked(getWorkOSClient).mockReturnValue(new WorkOS('sk_test_dummy', { clientId: 'client_test', fetchFn }));

    const live = await listWorkOSMemberships('user_sync');

    expect(live.map((m) => m.id)).toEqual(['om_P1', 'om_P2']);
    expect(requested.some((search) => search.includes('after=om_P1'))).toBe(true);

    const listed = await syncMembershipsForUser({
      userId: USER,
      workosUserId: 'user_sync',
      listedAt: new Date('2026-09-21T00:00:00Z'),
      memberships: live,
    });

    expect(listed.map((m) => m.id)).toEqual(expect.arrayContaining(['om_P1', 'om_P2']));
  });

  it('mirrors a membership WorkOS re-created with a new id', async () => {
    await t.db.execute(sql`insert into organizations (id, name) values ('org_S6', 'Six') on conflict do nothing`);
    // The member was removed (om_S6old deactivated), then added again, and
    // WorkOS gave the new membership a new id. The sign-in sync used to fail
    // here on the (organization, user) key, so the user could not sign in.
    await t.db.execute(sql`insert into organization_memberships (id, organization_id, user_id, workos_user_id, status, workos_updated_at)
      values ('om_S6old', 'org_S6', ${USER}, 'user_sync', 'inactive', '2026-09-22T00:00:00Z')`);

    const listed = await syncMembershipsForUser({
      userId: USER,
      workosUserId: 'user_sync',
      listedAt: new Date('2026-09-22T13:00:00Z'),
      memberships: [workos('om_S6new', 'org_S6', 'Six', '2026-09-22T12:00:00.000Z')],
    });

    expect(listed.map((m) => m.id)).toEqual(['om_S6new']);
    expect((await t.db.execute(sql`select id, status from organization_memberships where organization_id = 'org_S6'`)).rows).toEqual([
      { id: 'om_S6new', status: 'active' },
    ]);
  });

  it('answers null for malformed ids instead of querying', async () => {
    expect(await findMembership(USER, "org_S2' or '1'='1")).toBeNull();
    expect(await findMembership('not-a-uuid', 'org_S2')).toBeNull();
  });
});
