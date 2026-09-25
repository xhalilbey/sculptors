import { sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import type * as Identity from '@/lib/identity';
import { wrap, type IdentityDb } from '@/lib/identity/internal/handle';
import type * as Organizations from '@/lib/workos/organizations';

/**
 * Per-request session resolution against the real mirror (PGlite), with
 * WorkOS's session cookie mocked. What must hold: it writes nothing but a
 * throttled last_seen_at, it never lists memberships in WorkOS or creates an
 * organization, and a suspended user stays out. A session bound to an
 * organization the user has left is rebound from the newest seal it holds,
 * and a user the mirror has never seen is not let in. At sign-in, an account
 * outside the allowlist is refused before anything is written, a session
 * issued for another organization is bound to one the user is in (one
 * already bound to theirs is kept as issued), and the name a first
 * organization is created with fits the 100 code points a name may have.
 */

let t: TestDb;

const authenticate = vi.fn();
const refresh = vi.fn();
// Spied, so a test can say which seal each refresh started from.
const loadSealedSession = vi.fn((_options: { sessionData: string }) => ({ authenticate, refresh }));
/** The sealed session each loadSealedSession call opened, in order. */
const opened = () => loadSealedSession.mock.calls.map(([options]) => options.sessionData);

// Every repository function, spied, so the test can say which ran.
const writes = vi.hoisted(() => ({ called: [] as string[] }));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/client', () => ({
  getWorkOSClient: () => ({ userManagement: { loadSealedSession } }),
  getWorkOSEnv: () => ({ cookiePassword: 'x'.repeat(32), clientId: 'client_test', appUrl: 'http://localhost:3000' }),
}));
vi.mock('@/lib/identity', async (importOriginal) => {
  const actual = await importOriginal<typeof Identity>();
  const spied = <T extends Record<string, unknown>>(name: string, repository: T): T =>
    Object.fromEntries(
      Object.entries(repository).map(([key, value]) => [
        key,
        typeof value === 'function'
          ? (...args: unknown[]) => {
              writes.called.push(`${name}.${key}`);

              return (value as (...a: unknown[]) => unknown)(...args);
            }
          : value,
      ])
    ) as T;

  return {
    ...actual,
    usersRepository: spied('users', actual.usersRepository),
    membershipsRepository: spied('memberships', actual.membershipsRepository),
    organizationsRepository: spied('organizations', actual.organizationsRepository),
    identityDb: () => wrap(t.db),
    withIdentityTransaction: <T>(fn: (tx: IdentityDb) => Promise<T>) => t.db.transaction((tx) => fn(wrap(tx))),
    withIdentityReadTransaction: <T>(fn: (tx: IdentityDb) => Promise<T>) =>
      t.db.transaction((tx) => fn(wrap(tx)), { accessMode: 'read only' }),
  };
});
vi.mock('@/lib/workos/organizations', async (importOriginal) => {
  const actual = await importOriginal<typeof Organizations>();

  return {
    ...actual,
    listWorkOSMemberships: vi.fn(actual.listWorkOSMemberships),
    createOrganizationForUser: vi.fn(actual.createOrganizationForUser),
    syncMembershipsForUser: vi.fn(actual.syncMembershipsForUser),
  };
});

const { resolveSession } = await import('./session');
const { defineRoute } = await import('@/lib/api/define-route');
const organizations = await import('@/lib/workos/organizations');

const USER = '00000000-0000-4000-8000-0000000000d1';
const READS = ['users.findByWorkOSUserId', 'memberships.listActiveForUser', 'memberships.findActive'];

beforeAll(async () => {
  t = await createTestDb();
  await t.db.execute(sql`insert into users (id, workos_user_id, email, first_name, last_seen_at)
    values (${USER}, 'user_req', 'req@example.com', 'Req', now())`);
  await t.db.execute(sql`insert into organizations (id, name) values ('org_REQ', 'Req Org')`);
  await t.db.execute(sql`insert into organization_memberships (id, organization_id, user_id, workos_user_id, role)
    values ('om_REQ', 'org_REQ', ${USER}, 'user_req', 'admin')`);
});

afterAll(async () => {
  await t.close();
});

beforeEach(() => {
  vi.stubEnv('SCULPTORS_ALLOWED_WORKOS_USER_IDS', 'user_req');
  authenticate.mockReset();
  refresh.mockReset();
  // restoreMocks puts back vi.spyOn only; a vi.fn keeps its calls otherwise.
  loadSealedSession.mockClear();
  vi.mocked(organizations.listWorkOSMemberships).mockClear();
  vi.mocked(organizations.createOrganizationForUser).mockClear();
  writes.called = [];
  authenticate.mockResolvedValue({ authenticated: true, user: { id: 'user_req' }, organizationId: 'org_REQ' });
});

describe('resolveSession', () => {
  it('resolves user, organization and role from the mirror, reading only', async () => {
    const session = await resolveSession('sealed', { refresh: true });

    expect(session).toMatchObject({
      kind: 'ok',
      user: { id: USER, workosUserId: 'user_req', status: 'active' },
      organization: { id: 'org_REQ', role: 'owner' },
      role: 'owner',
    });
    // last_seen_at was set just now, so even the throttled write is skipped
    // in the database; the only repository calls besides reads are that one.
    expect(writes.called.filter((call) => !READS.includes(call))).toEqual(['users.touchLastSeen']);
  });

  it('keeps a suspended user out, and writes nothing', async () => {
    await t.db.execute(sql`update users set status = 'suspended' where id = ${USER}`);

    try {
      expect(await resolveSession('sealed', { refresh: true })).toEqual({ kind: 'inactive' });
      expect(writes.called.filter((call) => !READS.includes(call))).toEqual([]);
      expect((await t.db.execute(sql`select status from users where id = ${USER}`)).rows[0]).toEqual({ status: 'suspended' });
    } finally {
      await t.db.execute(sql`update users set status = 'active' where id = ${USER}`);
    }
  });

  it('does not refresh an expired token when the caller cannot store the result', async () => {
    authenticate.mockResolvedValue({ authenticated: false, reason: 'invalid_jwt' });

    expect(await resolveSession('sealed', { refresh: false })).toEqual({ kind: 'expired', cookieInvalid: false });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes an expired token for a route handler and hands back the new cookie', async () => {
    authenticate.mockResolvedValue({ authenticated: false, reason: 'invalid_jwt' });
    refresh.mockResolvedValue({ authenticated: true, sealedSession: 'sealed-new', user: { id: 'user_req' }, organizationId: 'org_REQ' });

    expect(await resolveSession('sealed', { refresh: true })).toMatchObject({ kind: 'ok', refreshedSessionData: 'sealed-new' });
  });

  it('marks a cookie that does not unseal, or whose refresh WorkOS refused, as invalid', async () => {
    authenticate.mockResolvedValue({ authenticated: false, reason: 'invalid_session_cookie' });
    expect(await resolveSession('garbage', { refresh: true })).toEqual({ kind: 'expired', cookieInvalid: true });

    authenticate.mockResolvedValue({ authenticated: false, reason: 'invalid_jwt' });
    refresh.mockResolvedValue({ authenticated: false, reason: 'invalid_grant' });
    expect(await resolveSession('sealed', { refresh: true })).toEqual({ kind: 'expired', cookieInvalid: true });
  });

  it('lets a transient WorkOS failure propagate instead of answering "signed out"', async () => {
    authenticate.mockRejectedValue(new Error('fetch failed'));

    await expect(resolveSession('sealed', { refresh: true })).rejects.toThrow('fetch failed');
  });

  it('refuses an account outside the allowlist', async () => {
    vi.stubEnv('SCULPTORS_ALLOWED_WORKOS_USER_IDS', 'user_someone_else');

    expect(await resolveSession('sealed', { refresh: true })).toEqual({ kind: 'forbidden' });
  });

  it('does not rebind an unbound session unless the caller can store the cookie', async () => {
    authenticate.mockResolvedValue({ authenticated: true, user: { id: 'user_req' }, organizationId: 'org_LEFT' });

    expect(await resolveSession('sealed', { refresh: false })).toEqual({ kind: 'unbound' });
  });
});

describe('resolveSession rebinding', () => {
  it('rebinds a session for an organization the user left to one they are in', async () => {
    authenticate.mockResolvedValue({ authenticated: true, user: { id: 'user_req' }, organizationId: 'org_LEFT' });
    refresh.mockResolvedValue({ authenticated: true, sealedSession: 'sealed-rebound', organizationId: 'org_REQ' });

    expect(await resolveSession('sealed', { refresh: true })).toMatchObject({
      kind: 'ok',
      organization: { id: 'org_REQ' },
      refreshedSessionData: 'sealed-rebound',
    });
    expect(refresh.mock.calls).toEqual([[{ organizationId: 'org_REQ' }]]);
  });

  it('rebinds from the seal a refresh just issued, not the spent one in the cookie', async () => {
    authenticate.mockResolvedValue({ authenticated: false, reason: 'invalid_jwt' });
    refresh
      .mockResolvedValueOnce({ authenticated: true, sealedSession: 'sealed-1', user: { id: 'user_req' }, organizationId: 'org_LEFT' })
      .mockResolvedValueOnce({ authenticated: true, sealedSession: 'sealed-2', organizationId: 'org_REQ' });

    expect(await resolveSession('sealed', { refresh: true })).toMatchObject({
      kind: 'ok',
      organization: { id: 'org_REQ' },
      refreshedSessionData: 'sealed-2',
    });
    expect(opened()).toEqual(['sealed', 'sealed-1']);
    expect(refresh.mock.calls).toEqual([[], [{ organizationId: 'org_REQ' }]]);
  });

  it('fails rather than answer for an organization WorkOS would not bind', async () => {
    authenticate.mockResolvedValue({ authenticated: true, user: { id: 'user_req' }, organizationId: 'org_LEFT' });
    refresh.mockResolvedValue({ authenticated: false });

    await expect(resolveSession('sealed', { refresh: true })).rejects.toThrow('WorkOS refused to switch organization');
  });

  it('does not let in an allowlisted user the mirror has never seen, and creates no row', async () => {
    vi.stubEnv('SCULPTORS_ALLOWED_WORKOS_USER_IDS', 'user_req,user_unknown');
    authenticate.mockResolvedValue({ authenticated: true, user: { id: 'user_unknown' }, organizationId: 'org_REQ' });

    expect(await resolveSession('sealed', { refresh: true })).toEqual({ kind: 'expired', cookieInvalid: false });
    expect(writes.called).toEqual(['users.findByWorkOSUserId']);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('a GET through defineRoute', () => {
  it('never lists memberships in WorkOS, syncs them or creates an organization', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const response = await defineRoute({ authz: { kind: 'session-organization' }, handler })(
      new NextRequest('http://localhost:3000/api/x', { headers: { cookie: 'wos-session=sealed' } })
    );

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(organizations.listWorkOSMemberships).not.toHaveBeenCalled();
    expect(organizations.syncMembershipsForUser).not.toHaveBeenCalled();
    expect(organizations.createOrganizationForUser).not.toHaveBeenCalled();
    expect(writes.called.filter((call) => !READS.includes(call))).toEqual(['users.touchLastSeen']);
  });

  it('answers 403 for a suspended user', async () => {
    await t.db.execute(sql`update users set status = 'suspended' where id = ${USER}`);

    try {
      const handler = vi.fn();
      const response = await defineRoute({ authz: { kind: 'session-organization' }, handler })(
        new NextRequest('http://localhost:3000/api/x', { headers: { cookie: 'wos-session=sealed' } })
      );

      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    } finally {
      await t.db.execute(sql`update users set status = 'active' where id = ${USER}`);
    }
  });
});

describe('sign-in for a suspended user', () => {
  it('is refused before any WorkOS listing or organization creation, and stays suspended', async () => {
    const { AccountInactiveError, establishSignInSession } = await import('@/lib/workos/auth');

    await t.db.execute(sql`update users set status = 'suspended' where id = ${USER}`);

    try {
      await expect(
        establishSignInSession(
          { id: 'user_req', email: 'req@example.com', updatedAt: '2026-09-23T00:00:00.000Z' },
          { organizationId: null, sessionData: 'sealed' }
        )
      ).rejects.toBeInstanceOf(AccountInactiveError);
      expect(organizations.listWorkOSMemberships).not.toHaveBeenCalled();
      expect(organizations.createOrganizationForUser).not.toHaveBeenCalled();
      expect((await t.db.execute(sql`select status from users where id = ${USER}`)).rows[0]).toEqual({ status: 'suspended' });
    } finally {
      await t.db.execute(sql`update users set status = 'active' where id = ${USER}`);
    }
  });
});

describe('sign-in session binding', () => {
  const STRANGER = { id: 'user_stranger', email: 'stranger@example.com', updatedAt: '2026-09-24T00:00:00.000Z' };

  beforeEach(() => {
    // Only the list decides here: an owner id left in the environment would widen it.
    vi.stubEnv('SCULPTORS_OWNER_WORKOS_USER_ID', undefined);
  });

  it('refuses an account outside the allowlist before writing anything', async () => {
    const { establishSignInSession, WorkOSAccountForbiddenError } = await import('@/lib/workos/auth');

    vi.stubEnv('SCULPTORS_ALLOWED_WORKOS_USER_IDS', 'user_other');

    await expect(
      establishSignInSession(STRANGER, { organizationId: null, sessionData: 'sealed' })
    ).rejects.toBeInstanceOf(WorkOSAccountForbiddenError);
    expect(writes.called).toEqual([]);
    expect(organizations.listWorkOSMemberships).not.toHaveBeenCalled();
    expect(organizations.createOrganizationForUser).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect((await t.db.execute(sql`select id from users where workos_user_id = 'user_stranger'`)).rows).toEqual([]);
  });

  it('binds a session issued for another organization to one the user is in', async () => {
    const { establishSignInSession } = await import('@/lib/workos/auth');

    vi.mocked(organizations.listWorkOSMemberships).mockResolvedValueOnce([
      {
        id: 'om_REQ',
        organizationId: 'org_REQ',
        organizationName: 'Req Org',
        userId: 'user_req',
        status: 'active',
        role: { slug: 'admin' },
        updatedAt: '2026-09-24T00:00:00.000Z',
      },
    ]);
    refresh.mockResolvedValue({ authenticated: true, sealedSession: 'sealed-rebound', organizationId: 'org_REQ', role: 'admin' });

    const established = await establishSignInSession(
      { id: 'user_req', email: 'req@example.com', firstName: 'Req', updatedAt: '2026-09-24T00:00:00.000Z' },
      { organizationId: 'org_OTHER', sessionData: 'sealed' }
    );

    expect(established.refreshedSessionData).toBe('sealed-rebound');
    expect(opened()).toEqual(['sealed']);
    expect(refresh.mock.calls).toEqual([[{ organizationId: 'org_REQ' }]]);
    expect(organizations.createOrganizationForUser).not.toHaveBeenCalled();
  });

  it('keeps a session already bound to an organization the user is in, without asking workos again', async () => {
    const { establishSignInSession } = await import('@/lib/workos/auth');

    vi.mocked(organizations.listWorkOSMemberships).mockResolvedValueOnce([
      {
        id: 'om_REQ',
        organizationId: 'org_REQ',
        organizationName: 'Req Org',
        userId: 'user_req',
        status: 'active',
        role: { slug: 'admin' },
        updatedAt: '2026-09-24T00:00:00.000Z',
      },
    ]);

    const established = await establishSignInSession(
      { id: 'user_req', email: 'req@example.com', firstName: 'Req', updatedAt: '2026-09-24T00:00:00.000Z' },
      { organizationId: 'org_REQ', sessionData: 'sealed' }
    );

    expect(established).toEqual({});
    expect(loadSealedSession).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('answers a completed sign-in outside the allowlist as forbidden', async () => {
    const { completeSignIn } = await import('@/lib/auth/sign-in');
    const authenticateAtWorkOS = vi.fn().mockResolvedValue({
      user: STRANGER,
      accessToken: 'access',
      refreshToken: 'refresh',
      sealedSession: 'sealed-stranger',
    });

    expect(await completeSignIn(authenticateAtWorkOS, { ipAddress: null, userAgent: null })).toEqual({ kind: 'forbidden' });
    expect(writes.called).toEqual([]);
  });
});

describe('sign-in for a user with no organization yet', () => {
  const SUFFIX = "'s Organization";

  /**
   * Signs a new user in with no WorkOS memberships and returns the name the
   * first organization would be created with. The creation is refused, so
   * WorkOS is never called.
   */
  async function firstOrganizationName(user: { id: string; firstName: string; lastName?: string }): Promise<string> {
    const { establishSignInSession } = await import('@/lib/workos/auth');

    vi.stubEnv('SCULPTORS_ALLOWED_WORKOS_USER_IDS', user.id);
    vi.mocked(organizations.listWorkOSMemberships).mockResolvedValueOnce([]);
    vi.mocked(organizations.createOrganizationForUser).mockRejectedValueOnce(new Error('not created in this test'));

    await expect(
      establishSignInSession(
        { ...user, email: `${user.id}@example.com`, updatedAt: '2026-09-23T00:00:00.000Z' },
        { organizationId: null, sessionData: 'sealed' }
      )
    ).rejects.toThrow('not created in this test');

    return vi.mocked(organizations.createOrganizationForUser).mock.lastCall?.[0].name ?? '';
  }

  it('cuts a long display name by code points, so the name WorkOS gets is exactly 100', async () => {
    // 120 emoji are 240 UTF-16 units: a cut by units would split a pair.
    const name = await firstOrganizationName({ id: 'user_long_emoji', firstName: '\u{1F600}'.repeat(120) });

    expect(name).toBe(`${'\u{1F600}'.repeat(100 - SUFFIX.length)}${SUFFIX}`);
    expect(Array.from(name)).toHaveLength(100);
  });

  it('leaves no space before the suffix when the cut falls just after one', async () => {
    const name = await firstOrganizationName({ id: 'user_long_space', firstName: 'x'.repeat(84), lastName: 'Long'.repeat(10) });

    expect(name).toBe(`${'x'.repeat(84)}${SUFFIX}`);
  });
});
