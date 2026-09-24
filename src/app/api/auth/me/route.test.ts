import { NextRequest, type NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allKeys, ORGANIZATION_DTO_KEYS, RETIRED_KEYS, okSession, sessionOrganization, USER_ID } from '@/test/session-fixtures';

/**
 * /api/auth/me is what the browser knows about the session. Its body is the
 * wire contract (types/api): exactly the DTO keys, and none of what the v1
 * shape carried -- the WorkOS block, user_metadata, tenant aliases, counts.
 */

const resolveSession = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/auth/session', () => ({ resolveSession }));
vi.mock('@/lib/workos/auth', () => ({
  WORKOS_SESSION_COOKIE: 'wos-session',
  setWorkOSSessionCookie: (response: NextResponse, value: string) => response.cookies.set('wos-session', value),
  clearWorkOSSessionCookie: (response: NextResponse) => response.cookies.set('wos-session', ''),
}));

const { GET } = await import('./route');

const request = () => new NextRequest('http://localhost:3000/api/auth/me', { headers: { cookie: 'wos-session=sealed' } });

beforeEach(() => {
  resolveSession.mockReset();
});

describe('GET /api/auth/me', () => {
  it('answers with the session user and active organization DTOs, nothing else', async () => {
    resolveSession.mockResolvedValue(okSession([sessionOrganization('org_A', { isDefault: true, role: 'member' })]));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['authenticated', 'organization', 'user']);
    expect(body.user).toEqual({
      id: USER_ID,
      email: 'ada@example.com',
      displayName: 'Ada Lovelace',
      avatarUrl: null,
    });
    expect(Object.keys(body.organization).sort()).toEqual(ORGANIZATION_DTO_KEYS);
    expect(body.organization).toMatchObject({
      id: 'org_A',
      role: 'member',
      isActive: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      onboardingCompletedAt: '2026-09-02T00:00:00.000Z',
    });
    for (const key of RETIRED_KEYS) expect(allKeys(body)).not.toContain(key);
  });

  it('falls back to the email local part for a user without a name', async () => {
    const session = okSession();

    session.user = { ...session.user, firstName: null, lastName: null };
    resolveSession.mockResolvedValue(session);

    const body = await (await GET(request())).json();

    expect(body.user.displayName).toBe('ada');
  });

  it('answers 403 for a suspended user, and the provider treats that as signed out', async () => {
    resolveSession.mockResolvedValue({ kind: 'inactive' });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(response.cookies.get('wos-session')).toBeUndefined();
  });

  it('keeps the cookie through a transient WorkOS or database failure', async () => {
    resolveSession.mockRejectedValue(new Error('fetch failed'));

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(response.cookies.get('wos-session')).toBeUndefined();
  });

  it('keeps a cookie that only needs a refresh, and clears one that can never work', async () => {
    resolveSession.mockResolvedValueOnce({ kind: 'expired', cookieInvalid: false });
    expect((await GET(request())).cookies.get('wos-session')).toBeUndefined();

    resolveSession.mockResolvedValueOnce({ kind: 'expired', cookieInvalid: true });
    const cleared = await GET(request());

    expect(cleared.status).toBe(401);
    expect(cleared.cookies.get('wos-session')?.value).toBe('');
  });

  it('stores a session WorkOS re-issued while resolving', async () => {
    resolveSession.mockResolvedValue({ ...okSession(), refreshedSessionData: 'sealed-new' });

    expect((await GET(request())).cookies.get('wos-session')?.value).toBe('sealed-new');
  });
});
