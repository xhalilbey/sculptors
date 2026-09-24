import { NextResponse, type NextRequest } from 'next/server';

const configuredAppHost = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ).host;
  } catch {
    return null;
  }
})();

// Loopback hosts belong to development only. Seeding them unconditionally
// meant a production deployment accepted `http://localhost:3000` as a
// same-origin caller -- browsers set Origin themselves, so this was not
// browser-exploitable, but it removed the guard for every non-browser client
// and made the allowlist decorative.
const allowedHosts = new Set<string>([
  ...(configuredAppHost ? [configuredAppHost] : []),
  ...(process.env.NODE_ENV === 'production'
    ? []
    : [
      'localhost:3000',
      'localhost:3001',
      'localhost:3002',
      '127.0.0.1:3000',
      '127.0.0.1:3001',
      '127.0.0.1:3002',
    ]),
]);

const parseOriginHost = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
};

/**
 * Check if host is a localhost variant (any port)
 */
const isLocalhost = (host: string): boolean => {
  const hostname = host.split(':')[0];

  return hostname === 'localhost' || hostname === '127.0.0.1';
};

/**
 * Enforces same-origin requests for state-changing API routes to mitigate CSRF.
 * Returns a NextResponse when validation fails, or null when the request is allowed.
 */
export const requireSameOrigin = (
  request: NextRequest
): NextResponse | null => {
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  const headerHost = parseOriginHost(originHeader) ?? parseOriginHost(refererHeader);

  // In development, allow any localhost port
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!headerHost) {
    return NextResponse.json(
      { error: 'Invalid or missing origin' },
      { status: 403 }
    );
  }

  // Allow if host is in allowed list OR if in development and it's localhost
  if (allowedHosts.has(headerHost) || (isDevelopment && isLocalhost(headerHost))) {
    return null;
  }

  return NextResponse.json(
    { error: 'Invalid or missing origin' },
    { status: 403 }
  );
};
