import { AuthenticationException, GenericServerException } from '@workos-inc/node';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticated, type signInMocks } from '@/test/sign-in-mocks';

/**
 * Password sign-in through lib/auth/sign-in: every answer WorkOS can give
 * maps to one response, and only a WorkOS refusal is the user's fault -- a
 * failure after WorkOS said yes is a 503, not "wrong password".
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

const { POST } = await import('./route');
const m = (() => {
  if (!mocks.current) throw new Error('lib/workos/auth mock did not load');

  return mocks.current;
})();

function post(body: unknown = { email: 'ada@example.com', password: 'correct horse' }) {
  return POST(
    new NextRequest('http://localhost:3000/api/auth/workos/password', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', 'user-agent': 'vitest' },
      body: JSON.stringify(body),
    })
  );
}

function authError(status: number, rawData: Record<string, unknown>) {
  return new AuthenticationException(status, { message: 'WorkOS says no', ...rawData } as ConstructorParameters<typeof AuthenticationException>[1], 'req_1');
}

beforeEach(() => {
  for (const fn of Object.values(m.userManagement)) fn.mockReset();
  m.buildSessionContext.mockReset();
  m.buildSessionContext.mockResolvedValue({ context: {}, refreshedSessionData: undefined });
});

describe('POST /api/auth/workos/password', () => {
  it('signs in and stores the session WorkOS sealed', async () => {
    m.userManagement.authenticateWithPassword.mockResolvedValue(authenticated('sealed-1', 'org_A'));

    const response = await post();

    expect(response.status).toBe(200);
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-1');
    expect(m.userManagement.authenticateWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        password: 'correct horse',
        clientId: 'client_test',
        userAgent: 'vitest',
        session: { sealSession: true, cookiePassword: 'x'.repeat(32) },
      })
    );
    expect(m.buildSessionContext).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org_A' }),
      { sessionData: 'sealed-1' }
    );
  });

  it('stores the session re-issued for an organization when WorkOS issued it unbound', async () => {
    m.userManagement.authenticateWithPassword.mockResolvedValue(authenticated('sealed-unbound'));
    m.buildSessionContext.mockResolvedValue({ context: {}, refreshedSessionData: 'sealed-bound' });

    const response = await post();

    expect(response.cookies.get('wos-session')?.value).toBe('sealed-bound');
  });

  it('finishes organization_selection_required with the first organization WorkOS lists', async () => {
    m.userManagement.authenticateWithPassword.mockRejectedValue(
      authError(403, {
        code: 'organization_selection_required',
        pending_authentication_token: 'pending_1',
        organizations: [
          { id: 'org_first', name: 'First' },
          { id: 'org_second', name: 'Second' },
        ],
      })
    );
    m.userManagement.authenticateWithOrganizationSelection.mockResolvedValue(authenticated('sealed-selected', 'org_first'));

    const response = await post();

    expect(response.status).toBe(200);
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-selected');
    expect(m.userManagement.authenticateWithOrganizationSelection).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org_first', pendingAuthenticationToken: 'pending_1', clientId: 'client_test' })
    );
  });

  it('answers 403 with the pending token when WorkOS wants the email verified', async () => {
    m.userManagement.authenticateWithPassword.mockRejectedValue(
      authError(403, { code: 'email_verification_required', pending_authentication_token: 'pending_2' })
    );

    const response = await post();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Enter the verification code sent to your email.',
      requiresEmailVerification: true,
      pendingAuthenticationToken: 'pending_2',
    });
    expect(response.cookies.get('wos-session')).toBeUndefined();
  });

  it('answers 401 for invalid credentials', async () => {
    m.userManagement.authenticateWithPassword.mockRejectedValue(
      new GenericServerException(400, 'Invalid credentials.', { code: 'invalid_credentials', message: 'Invalid credentials.' }, 'req_2')
    );

    const response = await post();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'Incorrect email or password' });
  });

  it.each([
    ['mfa_challenge', { code: 'mfa_challenge' }],
    ['mfa_enrollment', { code: 'mfa_enrollment' }],
    ['sso_required', { error: 'sso_required', error_description: 'Use SSO' }],
  ])('answers %s with the same generic 401', async (_case, rawData) => {
    m.userManagement.authenticateWithPassword.mockRejectedValue(authError(403, rawData));

    const response = await post();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: 'Incorrect email or password' });
  });

  it('answers 503, not 401, when the database fails after WorkOS said yes', async () => {
    m.userManagement.authenticateWithPassword.mockResolvedValue(authenticated());
    m.buildSessionContext.mockRejectedValue(new Error('connection refused'));

    const response = await post();

    expect(response.status).toBe(503);
    expect(response.cookies.get('wos-session')).toBeUndefined();
  });

  it('answers 503 when WorkOS itself fails', async () => {
    m.userManagement.authenticateWithPassword.mockRejectedValue(new GenericServerException(500, 'boom', {}, 'req_3'));

    expect((await post()).status).toBe(503);
  });

  it('answers 403 for an account outside the allowlist', async () => {
    m.userManagement.authenticateWithPassword.mockResolvedValue(authenticated());
    m.buildSessionContext.mockRejectedValue(new m.WorkOSAccountForbiddenError());

    const response = await post();

    expect(response.status).toBe(403);
    expect(response.cookies.get('wos-session')).toBeUndefined();
  });

  it('refuses a suspended user at sign-in, without a cookie', async () => {
    m.userManagement.authenticateWithPassword.mockResolvedValue(authenticated());
    m.buildSessionContext.mockRejectedValue(new m.AccountInactiveError());

    const response = await post();

    expect(response.status).toBe(403);
    expect(response.cookies.get('wos-session')).toBeUndefined();
  });

  it('answers 400 without calling WorkOS for a malformed body', async () => {
    const response = await post({ email: 'not-an-email', password: '' });

    expect(response.status).toBe(400);
    expect(m.userManagement.authenticateWithPassword).not.toHaveBeenCalled();
  });
});
