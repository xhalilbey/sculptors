import 'server-only';

import { logger } from '@/lib/logger';
import { getWorkOSClient, getWorkOSEnv } from './client';

/**
 * How long logout waits for WorkOS to revoke the session before it signs
 * the browser out anyway.
 */
const REVOKE_TIMEOUT_MS = 3000;

class RevokeTimeoutError extends Error {
  constructor() {
    super('WorkOS did not answer the session revocation in time');
    this.name = 'RevokeTimeoutError';
  }
}

async function withinTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new RevokeTimeoutError()), ms);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** The `sid` claim of an access token, read without verifying the token. */
function sessionIdOf(accessToken: unknown): string | null {
  if (typeof accessToken !== 'string') {
    return null;
  }

  const [, payload] = accessToken.split('.');

  if (!payload) {
    return null;
  }

  const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

  if (typeof claims !== 'object' || claims === null || !('sid' in claims)) {
    return null;
  }

  return typeof claims.sid === 'string' && claims.sid !== '' ? claims.sid : null;
}

/**
 * End the WorkOS session a sealed cookie belongs to, so its refresh token
 * stops working. Logout used to clear only the browser's cookie: a copy of
 * it taken before then (it lives up to 30 days, WORKOS_SESSION_MAX_AGE)
 * went on refreshing, because WorkOS still held the session as live.
 *
 * The session id is the `sid` claim of the access token inside the seal.
 * Unsealing is local, and the seal is authenticated with our cookie
 * password, so what it holds is what WorkOS gave us; the token's signature
 * and expiry are not checked because an expired access token still names
 * its session, and an expired one is the usual state when logout follows a
 * 401. That is also why this does not go through the SDK's
 * CookieSession.authenticate or getLogoutUrl: both refuse an expired token.
 *
 * Best effort, and never a reason for logout to fail or wait: no cookie, a
 * seal that does not open, a token without a session id, a WorkOS error
 * and a WorkOS that has not answered within REVOKE_TIMEOUT_MS all end here
 * without a revocation, and the caller clears the cookie regardless. A
 * failure is logged by its error type only, never the cookie or the token.
 *
 * It does not send the browser to WorkOS's hosted logout URL, which would
 * also end the AuthKit browser session: that needs a sign-out redirect
 * registered in every WorkOS environment, and until one is, WorkOS answers
 * with its own error page. See "Log out ends the session at WorkOS" in
 * docs/DECISIONS.md.
 */
export async function endWorkOSSession(sessionData: string | undefined): Promise<void> {
  if (!sessionData) {
    return;
  }

  try {
    const { cookiePassword } = getWorkOSEnv();
    const { userManagement } = getWorkOSClient();
    const unsealed = await userManagement.getSessionFromCookie({ sessionData, cookiePassword });
    const sessionId = sessionIdOf(unsealed?.accessToken);

    if (!sessionId) {
      return;
    }

    await withinTimeout(userManagement.revokeSession({ sessionId }), REVOKE_TIMEOUT_MS);
  } catch (error) {
    logger.warn('Could not end the WorkOS session at logout', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}
