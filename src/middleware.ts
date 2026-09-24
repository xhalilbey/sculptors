import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/config/constants';
import {
  rateLimit,
  getIdentifier,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
} from './lib/security/rate-limiter';
import { requireSameOrigin } from './lib/security/request-guards';
import { WORKOS_SESSION_COOKIE } from './lib/workos/constants';

const PUBLIC_PATHS = ['/', '/auth/login'];
const PUBLIC_PATH_PREFIXES = ['/api/auth/'];

/*
 * The credential submissions: a password, an emailed code, a reset request.
 * They share one budget per address (RATE_LIMITS.AUTH_SUBMIT), so spreading
 * guesses across the three routes buys nothing. The login GET and the
 * callback are one AuthKit round trip, WorkOS retries the webhook, and me
 * and logout carry no credential, so none of them is here.
 */
const AUTH_SUBMIT_PATHS = new Set([
  '/api/auth/workos/password',
  '/api/auth/workos/email-verification',
  '/api/auth/workos/password-reset',
]);

/*
 * An allowlist: a page added under (dashboard) without a line here renders
 * its shell for anyone, which is how /orders once leaked its shell. It lists
 * every (dashboard) page directory on disk -- check with
 * `ls src/app/(dashboard)` when adding one.
 */
const PROTECTED_PATH_PREFIXES = [
  '/dashboard',
  '/products',
  '/customers',
  '/orders',
  '/agent-center',
  '/pipelines',
  '/integrations',
  '/settings',
  '/api',
];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/*
 * The middleware sees the path as sent, but a production build routes
 * `/api/auth/workos/%70assword` and `/api/auth/workos%2Fpassword` to the
 * password handler too (Next's filesystem check also tries the decoded
 * path), so the credential budget matches on the decoded form. A path that
 * does not decode matches no route.
 */
function isAuthSubmitPath(pathname: string) {
  try {
    return AUTH_SUBMIT_PATHS.has(decodeURIComponent(pathname));
  } catch {
    return false;
  }
}

/**
 * A 429 carrying the window's reset time, in the envelope its caller reads.
 * Never stored, like the 401 below: defineRoute marks its own answers
 * `private, no-store`, and these are answered before any route runs.
 */
function tooManyRequests(
  result: RateLimitResult,
  limit: RateLimitConfig,
  body: Record<string, unknown>
): NextResponse {
  return NextResponse.json(body, {
    status: 429,
    headers: {
      'Cache-Control': 'no-store',
      'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
      'X-RateLimit-Limit': limit.maxAttempts.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': result.resetTime.toString(),
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasWorkOSSession = Boolean(request.cookies.get(WORKOS_SESSION_COOKIE)?.value);

  /*
   * Before 24 Sep a 5-per-15-minutes budget ran on every /auth/* page view,
   * where no credential is checked (six loads of the login page were a
   * 429), while these POSTs went unthrottled. The key is one constant, so
   * the three routes spend one bucket per address. The body is JSON in the
   * routes' own envelope, because the login page reads response.json() and
   * toasts `error`; a text body would toast a JSON parse error.
   *
   * Only a post the route's own requireSameOrigin would let through is
   * counted. The route answers any other with a 403 before WorkOS sees it,
   * so it tests no credential. As first written, the budget was spent before
   * that check, so ten cross-site form posts from any page the victim had open
   * locked their address (and everyone behind the same NAT) out of sign-in
   * for 15 minutes. The route stays the one that refuses them.
   */
  if (
    request.method === 'POST' &&
    isAuthSubmitPath(pathname) &&
    process.env.NODE_ENV !== 'development' &&
    requireSameOrigin(request) === null
  ) {
    const rateLimitResult = rateLimit(getIdentifier(request), 'auth-submit', 'AUTH_SUBMIT');

    if (!rateLimitResult.allowed) {
      return tooManyRequests(rateLimitResult, RATE_LIMITS.AUTH_SUBMIT, {
        success: false,
        error: 'Too many attempts. Please wait a few minutes and try again.',
      });
    }
  }

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const identifier = getIdentifier(request);
    const rateLimitResult = rateLimit(identifier, pathname, 'API_READ');

    if (!rateLimitResult.allowed) {
      return tooManyRequests(rateLimitResult, RATE_LIMITS.API_READ, {
        error: 'Too many requests',
      });
    }
  }

  if (pathname === '/' && hasWorkOSSession) {
    return NextResponse.redirect(new URL(DEFAULT_AUTHENTICATED_ROUTE, request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (isProtectedPath(pathname) && !hasWorkOSSession) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Images skip the middleware, but not under /api: `PATCH
    // /api/organizations/x.png` is a route call, and skipping here skipped
    // its rate limit (the route still checked origin and session itself).
    '/((?!_next/static|_next/image|favicon.ico|(?!api/).*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
