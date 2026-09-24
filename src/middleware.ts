import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/config/constants';
import { rateLimit, getIdentifier, RATE_LIMITS } from './lib/security/rate-limiter';
import { WORKOS_SESSION_COOKIE } from './lib/workos/constants';

const PUBLIC_PATHS = ['/', '/auth/login'];
const PUBLIC_PATH_PREFIXES = ['/api/auth/'];

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasWorkOSSession = Boolean(request.cookies.get(WORKOS_SESSION_COOKIE)?.value);

  if (pathname.startsWith('/auth/') && process.env.NODE_ENV !== 'development') {
    const identifier = getIdentifier(request);
    const rateLimitResult = rateLimit(identifier, pathname, 'LOGIN');

    if (!rateLimitResult.allowed) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': RATE_LIMITS.LOGIN.maxAttempts.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        },
      });
    }
  }

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const identifier = getIdentifier(request);
    const rateLimitResult = rateLimit(identifier, pathname, 'API_READ');

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': RATE_LIMITS.API_READ.maxAttempts.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      );
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
