import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import {
  clearWorkOSSessionCookie,
  setWorkOSSessionCookie,
  WORKOS_SESSION_COOKIE,
} from '@/lib/workos/auth';
import { toOrganizationDto, toSessionUserDto } from '@/lib/workos/dto';

/**
 * GET /api/auth/me -- what the browser knows about its session. Read-only
 * (lib/auth/session.ts): it never creates the user, syncs memberships or
 * creates an organization; sign-in did that.
 *
 * The cookie is cleared only when it can never work again (it does not
 * unseal, or WorkOS refused its refresh token). A WorkOS or database outage
 * is a 503 that keeps the cookie: signing everyone out because a dependency
 * blinked is how a transient error becomes an incident.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  let session: Awaited<ReturnType<typeof resolveSession>>;

  try {
    session = await resolveSession(request.cookies.get(WORKOS_SESSION_COOKIE)?.value, { refresh: true });
  } catch (error) {
    logger.error('Session could not be resolved', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });

    return NextResponse.json(
      { authenticated: false, error: 'The session service is unavailable. Please try again.' },
      { status: 503, headers: NO_STORE }
    );
  }

  switch (session.kind) {
    case 'ok': {
      const response = NextResponse.json(
        {
          authenticated: true,
          user: toSessionUserDto(session.user),
          organization: toOrganizationDto(session.organization, { role: session.role, isActive: true }),
        },
        { headers: NO_STORE }
      );

      if (session.refreshedSessionData) {
        setWorkOSSessionCookie(response, session.refreshedSessionData);
      }

      return response;
    }

    case 'inactive':
    case 'forbidden':
      return NextResponse.json(
        {
          authenticated: false,
          error: session.kind === 'inactive' ? 'Account is not active.' : 'This WorkOS account is not allowed to sign in to Sculptors.',
          errorCode: session.kind,
        },
        { status: 403, headers: NO_STORE }
      );

    case 'expired': {
      const response = NextResponse.json(
        { authenticated: false, error: 'Session expired. Please sign in again.', errorCode: 'invalid_session' },
        { status: 401, headers: NO_STORE }
      );

      if (session.cookieInvalid) {
        clearWorkOSSessionCookie(response);
      }

      return response;
    }

    case 'unbound':
    case 'none':
      return NextResponse.json(
        { authenticated: false, error: 'Unauthorized. Please log in.', errorCode: 'unauthorized' },
        { status: 401, headers: NO_STORE }
      );
  }
}
