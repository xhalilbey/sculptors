import { AuthenticationException } from '@workos-inc/node';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticated, type signInMocks } from '@/test/sign-in-mocks';

/**
 * The AuthKit callback. The state check is the CSRF guard of the whole
 * OAuth flow: without a matching cookie nothing is exchanged.
 */

const mocks = vi.hoisted(() => ({ current: undefined as ReturnType<typeof signInMocks> | undefined }));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/auth', async () => {
  const { signInMocks: create } = await import('@/test/sign-in-mocks');

  mocks.current = create();

  return mocks.current.module;
});

const { GET } = await import('./route');
const m = (() => {
  if (!mocks.current) throw new Error('lib/workos/auth mock did not load');

  return mocks.current;
})();

function callback(query: string, stateCookie?: string) {
  return GET(
    new NextRequest(`http://localhost:3000/api/auth/workos/callback?${query}`, {
      headers: stateCookie ? { cookie: `wos-state=${stateCookie}` } : {},
    })
  );
}

beforeEach(() => {
  for (const fn of Object.values(m.userManagement)) fn.mockReset();
  m.buildSessionContext.mockReset();
  m.buildSessionContext.mockResolvedValue({ context: {}, refreshedSessionData: undefined });
});

describe('GET /api/auth/workos/callback', () => {
  it('refuses a state that does not match the cookie, without exchanging the code', async () => {
    const response = await callback('code=c1&state=attacker', 'mine');

    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/login?error=invalid_state');
    expect(m.userManagement.authenticateWithCode).not.toHaveBeenCalled();
  });

  it('refuses a callback with no state cookie at all', async () => {
    const response = await callback('code=c1&state=s1');

    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/login?error=invalid_state');
    expect(m.userManagement.authenticateWithCode).not.toHaveBeenCalled();
  });

  it('exchanges the code, stores the session, clears the state and enters the app', async () => {
    m.userManagement.authenticateWithCode.mockResolvedValue(authenticated('sealed-cb', 'org_A'));

    const response = await callback('code=c1&state=s1', 's1');

    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-cb');
    expect(response.cookies.get('wos-state')?.value).toBe('');
    expect(m.userManagement.authenticateWithCode).toHaveBeenCalledWith(expect.objectContaining({ code: 'c1' }));
  });

  it('completes an organization selection with the first organization listed', async () => {
    m.userManagement.authenticateWithCode.mockRejectedValue(
      new AuthenticationException(
        403,
        {
          code: 'organization_selection_required',
          message: 'Pick one',
          pending_authentication_token: 'pending_cb',
          organizations: [{ id: 'org_first', name: 'First' }],
        },
        'req_1'
      )
    );
    m.userManagement.authenticateWithOrganizationSelection.mockResolvedValue(authenticated('sealed-org', 'org_first'));

    const response = await callback('code=c1&state=s1', 's1');

    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-org');
  });

  it('sends a refused account back to the login with its own error', async () => {
    m.userManagement.authenticateWithCode.mockResolvedValue(authenticated());
    m.buildSessionContext.mockRejectedValue(new m.WorkOSAccountForbiddenError());

    const response = await callback('code=c1&state=s1', 's1');

    expect(response.headers.get('location')).toBe('http://localhost:3000/auth/login?error=forbidden');
    expect(response.cookies.get('wos-session')).toBeUndefined();
  });
});
