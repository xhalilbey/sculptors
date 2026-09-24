import { NextRequest, type NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { okSession, USER_ID } from '@/test/session-fixtures';

/**
 * Switching organization is the only way the active tenant changes: WorkOS
 * re-issues the sealed session for the named organization, and refuses one
 * the user is not in. The tests pin that the switch starts from the seal
 * this request authenticated with, that the answer and the cookie are
 * WorkOS's re-issued ones, and that a refusal is a 403 which leaves the
 * browser on the session it had. Origin and membership refusals are
 * defineRoute's and are pinned in define-route.test.ts.
 */

const resolveSession = vi.fn();
const ensureOrganizationAccess = vi.fn();
const refreshSessionForOrganization = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/auth', () => ({
  WORKOS_SESSION_COOKIE: 'wos-session',
  refreshSessionForOrganization,
  setWorkOSSessionCookie: (response: NextResponse, value: string) =>
    response.cookies.set({ name: 'wos-session', value, httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 60 }),
}));
vi.mock('@/lib/auth/ensure-organization-access', () => ({ ensureOrganizationAccess }));
vi.mock('@/lib/auth/session', () => ({ resolveSession }));

const { POST } = await import('./route');

function select(id = 'org_B') {
  return POST(
    new NextRequest(`http://localhost:3000/api/organizations/${id}/select`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', cookie: 'wos-session=sealed' },
    }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => {
  for (const mock of [resolveSession, ensureOrganizationAccess, refreshSessionForOrganization]) {
    mock.mockReset();
  }
  resolveSession.mockResolvedValue(okSession());
  ensureOrganizationAccess.mockResolvedValue({ authorized: true, role: 'member' });
  refreshSessionForOrganization.mockResolvedValue({ sealedSession: 'sealed-org-B', organizationId: 'org_B', role: 'member' });
});

describe('POST /api/organizations/[id]/select', () => {
  it('switches the session into the organization WorkOS re-issued it for', async () => {
    const response = await select();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, organizationId: 'org_B' });
    expect(ensureOrganizationAccess).toHaveBeenCalledWith('org_B', USER_ID);
    expect(refreshSessionForOrganization).toHaveBeenCalledWith('sealed', 'org_B');
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-org-B');
  });

  it('answers 403 and keeps the old session when WorkOS refuses', async () => {
    refreshSessionForOrganization.mockRejectedValue(new Error('WorkOS refused to switch organization'));

    const response = await select();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error: 'You do not have access to this organization' });
    // No Set-Cookie at all, so the browser keeps the session it sent.
    expect(response.cookies.get('wos-session')).toBeUndefined();
  });

  it('switches from the seal refreshed during authentication', async () => {
    resolveSession.mockResolvedValue({ ...okSession(), refreshedSessionData: 'sealed-refreshed' });

    const response = await select();

    expect(response.status).toBe(200);
    // The cookie's refresh token was spent re-issuing 'sealed-refreshed'.
    expect(refreshSessionForOrganization).toHaveBeenCalledWith('sealed-refreshed', 'org_B');
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-org-B');
  });
});
