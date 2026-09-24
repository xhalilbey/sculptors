import { NextResponse, type NextRequest } from 'next/server';
import { appUrl } from '@/lib/app-url';
import { logger } from '@/lib/logger';

/**
 * Loopback hosts, admitted on any port and scheme outside production only.
 * Seeding them unconditionally once meant a production deployment accepted
 * `http://localhost:3000` as a same-origin caller -- browsers set Origin
 * themselves, so this was not browser-exploitable, but it removed the guard
 * for every non-browser client and made the allowlist decorative.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The one refusal, whichever check failed. */
const refuse = (): NextResponse =>
  NextResponse.json({ error: 'Invalid or missing origin' }, { status: 403 });

/**
 * Whether an Origin (or a Referer's origin) is this app's: the scheme, host
 * and port of the configured app URL (lib/app-url.ts). Until 24 Sep 2026 only
 * the host was compared, so `http://` passed for an `https://` app. The
 * literal `null` a browser sends for an opaque origin (a sandboxed frame, a
 * `data:` page, some cross-origin redirects) is never ours.
 */
const isAllowedOrigin = (value: string): boolean => {
  if (value === 'null') return false;

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (process.env.NODE_ENV !== 'production' && LOOPBACK.has(url.hostname)) {
    return true;
  }

  let expected: string;

  try {
    expected = new URL(appUrl()).origin;
  } catch (error) {
    logger.error(
      'NEXT_PUBLIC_APP_URL is not set or not a URL; refusing state-changing requests',
      error
    );

    return false;
  }

  return url.origin === expected;
};

/**
 * Enforces same-origin requests for state-changing API routes to mitigate CSRF.
 * Returns a NextResponse when validation fails, or null when the request is allowed.
 *
 * An Origin header, `null` included, decides alone; the Referer is read only
 * when there is no Origin at all, and a request with neither is refused.
 * Before 24 Sep 2026 an Origin of `null` fell through to the Referer, so a
 * request the browser marked as coming from an opaque origin was judged by
 * the page address it also sent.
 */
export const requireSameOrigin = (
  request: NextRequest
): NextResponse | null => {
  const origin = request.headers.get('origin');

  if (origin !== null) {
    return isAllowedOrigin(origin) ? null : refuse();
  }

  const referer = request.headers.get('referer');

  if (referer !== null) {
    return isAllowedOrigin(referer) ? null : refuse();
  }

  return refuse();
};
