import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireSameOrigin } from '@/lib/security/request-guards';
import { getWorkOSEnv, WORKOS_SESSION_COOKIE } from '@/lib/workos/auth';

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: WORKOS_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Logout is reached by top-level navigation (`window.location.*`) from seven
 * call sites, so it has to stay a GET that redirects — POST-only would break
 * all of them, and `requireSameOrigin` is unreliable here because browsers do
 * not send `Origin` on top-level GET navigations.
 *
 * The attack this guards against is a drive-by forced logout: an off-site
 * `<img src="/api/auth/logout">` or `fetch()`. Those are subresource requests,
 * so `Sec-Fetch-Mode` is `no-cors`/`cors` rather than `navigate`. Browsers too
 * old to send `Sec-Fetch-*` fall through and are allowed — an acceptable
 * trade-off for a nuisance-level issue.
 */
function isNavigationRequest(request: NextRequest): boolean {
  const mode = request.headers.get('sec-fetch-mode');

  return mode === null || mode === 'navigate';
}

export async function GET(request: NextRequest) {
  if (!isNavigationRequest(request)) {
    return NextResponse.json(
      { error: 'Logout must be a top-level navigation' },
      { status: 403 }
    );
  }

  const { appUrl } = getWorkOSEnv();
  const brandingUrl = new URL('/', appUrl).toString();
  const response = NextResponse.redirect(brandingUrl);

  clearSessionCookie(response);

  return response;
}

export async function POST(request: NextRequest) {
  const originError = requireSameOrigin(request);

  if (originError) {
    return originError;
  }

  const { appUrl } = getWorkOSEnv();
  const brandingUrl = new URL('/', appUrl).toString();
  const response = NextResponse.redirect(brandingUrl);

  clearSessionCookie(response);

  return response;
}
