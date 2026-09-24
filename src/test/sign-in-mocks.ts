import type { NextResponse } from 'next/server';
import { vi } from 'vitest';

/**
 * The session layer (lib/workos/auth) as the sign-in routes see it, with the
 * WorkOS client's authenticate calls as spies. The routes and
 * lib/auth/sign-in run for real; WorkOS answers are the SDK's own exception
 * classes, so `.code` and the pending token are parsed the way production
 * parses them.
 */
export function signInMocks() {
  const userManagement = {
    authenticateWithPassword: vi.fn(),
    authenticateWithEmailVerification: vi.fn(),
    authenticateWithCode: vi.fn(),
    authenticateWithOrganizationSelection: vi.fn(),
  };
  const establishSignInSession = vi.fn();

  class WorkOSAccountForbiddenError extends Error {}
  class AccountInactiveError extends Error {}

  return {
    userManagement,
    establishSignInSession,
    WorkOSAccountForbiddenError,
    AccountInactiveError,
    module: {
      getWorkOSClient: () => ({ userManagement }),
      getWorkOSEnv: () => ({ clientId: 'client_test', cookiePassword: 'x'.repeat(32), appUrl: 'http://localhost:3000' }),
      establishSignInSession,
      WorkOSAccountForbiddenError,
      AccountInactiveError,
      setWorkOSSessionCookie: (response: NextResponse, value: string) =>
        response.cookies.set({ name: 'wos-session', value, httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 60 }),
    },
  };
}

/** A WorkOS AuthenticationResponse with a sealed session. */
export function authenticated(sealedSession = 'sealed-from-workos', organizationId?: string) {
  return {
    user: { id: 'user_w1', email: 'ada@example.com', firstName: 'Ada', lastName: null, profilePictureUrl: null, updatedAt: '2026-09-01T00:00:00.000Z' },
    organizationId,
    accessToken: 'access',
    refreshToken: 'refresh',
    sealedSession,
  };
}
