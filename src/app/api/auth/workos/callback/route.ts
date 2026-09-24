import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/config/constants';
import { completeSignIn, signInContextFrom, signInOptions } from '@/lib/auth/sign-in';
import { logger } from '@/lib/logger';
import { getWorkOSClient, getWorkOSEnv, setWorkOSSessionCookie } from '@/lib/workos/auth';
import { clearWorkOSStateCookie, readWorkOSStateCookie } from '@/lib/workos/cookies';

/**
 * The AuthKit callback: check the state against the cookie the login route
 * set, exchange the code through completeSignIn (which also finishes an
 * organization selection and binds the session), and redirect.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const authError = requestUrl.searchParams.get('error');
  const { appUrl } = getWorkOSEnv();

  if (authError) {
    logger.warn('WorkOS callback returned an auth error');

    return NextResponse.redirect(new URL('/auth/login?error=workos_auth_failed', appUrl));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/auth/login?error=missing_code', appUrl));
  }

  const stateCookie = readWorkOSStateCookie(request);

  if (!stateCookie || stateCookie !== state) {
    logger.warn('WorkOS callback state mismatch');

    return NextResponse.redirect(new URL('/auth/login?error=invalid_state', appUrl));
  }

  const ctx = signInContextFrom(request.headers);
  const result = await completeSignIn(
    () => getWorkOSClient().userManagement.authenticateWithCode({ ...signInOptions(ctx), code }),
    ctx
  );

  if (result.kind === 'signed-in') {
    const response = NextResponse.redirect(new URL(DEFAULT_AUTHENTICATED_ROUTE, appUrl));

    setWorkOSSessionCookie(response, result.sealedSession);
    clearWorkOSStateCookie(response);

    return response;
  }

  logger.error('WorkOS callback failed', { outcome: result.kind });

  const response = NextResponse.redirect(
    new URL(result.kind === 'forbidden' ? '/auth/login?error=forbidden' : '/auth/login?error=callback_failed', appUrl)
  );

  clearWorkOSStateCookie(response);

  return response;
}
