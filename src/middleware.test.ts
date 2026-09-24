import { readdirSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/config/constants';

/**
 * The credential budget: POSTs to the password, email-code and
 * password-reset routes share ten attempts per address per 15 minutes, and
 * the eleventh is a 429 in the routes' own { success, error } envelope, which
 * the login page toasts. Page views, the webhook, the AuthKit round trip and
 * posts from another origin (which the route refuses with a 403) spend none
 * of it. Before 24 Sep the budget ran on /auth/* page views
 * instead, and these POSTs were not throttled at all. The middleware's own
 * refusals, the 429 and the 401 of an API call without a session, are
 * marked no-store.
 *
 * The page allowlist is read from disk: every directory under
 * src/app/(dashboard) must send a visitor without a session to the login
 * page, because a directory missing from PROTECTED_PATH_PREFIXES renders its
 * shell for anyone (the /orders shell once did). A visitor with a session
 * who opens / goes to the dashboard. An API call past the budget of 100
 * per address per minute is a 429. The matcher is pinned apart, in
 * src/middleware-matcher.test.ts, because Next's testing helper patches the
 * console of the file that imports it.
 *
 * The limiter's store is module-global, so each test imports a fresh
 * middleware. NODE_ENV is 'test' here, so the limiter is active, as in
 * production; only development skips it.
 */

const NOW = new Date('2026-09-24T12:00:00Z');
const ADDRESS = '203.0.113.9';

async function loadMiddleware() {
  vi.resetModules();

  const { middleware } = await import('./middleware');

  return middleware;
}

function request(
  path: string,
  method = 'POST',
  address = ADDRESS,
  origin: string | null = 'http://localhost:3000'
) {
  const headers: Record<string, string> = { 'x-forwarded-for': address };

  if (origin !== null) {
    headers.origin = origin;
  }

  return new NextRequest(`http://localhost:3000${path}`, { method, headers });
}

async function spend(
  middleware: Awaited<ReturnType<typeof loadMiddleware>>,
  path: string,
  times: number,
  method = 'POST'
) {
  const statuses: number[] = [];

  for (let i = 0; i < times; i += 1) {
    statuses.push((await middleware(request(path, method))).status);
  }

  return statuses;
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('middleware credential budget', () => {
  it('lets ten credential posts through and answers the eleventh with a 429 the login page can read', async () => {
    const middleware = await loadMiddleware();

    expect(await spend(middleware, '/api/auth/workos/password', 10)).not.toContain(429);

    const response = await middleware(request('/api/auth/workos/password'));

    expect(response.status).toBe(429);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      success: false,
      error: 'Too many attempts. Please wait a few minutes and try again.',
    });
    expect(response.headers.get('retry-after')).toBe('900');
    expect(response.headers.get('x-ratelimit-limit')).toBe('10');
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('counts the password, email-code and reset routes against one budget', async () => {
    const middleware = await loadMiddleware();

    expect(await spend(middleware, '/api/auth/workos/password', 6)).not.toContain(429);
    expect(await spend(middleware, '/api/auth/workos/password-reset', 4)).not.toContain(429);

    const response = await middleware(request('/api/auth/workos/email-verification'));

    expect(response.status).toBe(429);
  });

  it('keeps a separate budget for each address', async () => {
    const middleware = await loadMiddleware();

    await spend(middleware, '/api/auth/workos/password', 10);

    expect((await middleware(request('/api/auth/workos/password'))).status).toBe(429);
    expect(
      (await middleware(request('/api/auth/workos/password', 'POST', '198.51.100.7'))).status
    ).not.toBe(429);
  });

  it('matches a percent-encoded credential path, which Next still routes to the handler', async () => {
    const middleware = await loadMiddleware();

    await spend(middleware, '/api/auth/workos/password', 10);

    for (const path of ['/api/auth/workos/%70assword', '/api/auth/workos%2Fpassword']) {
      const encoded = request(path);

      expect(encoded.nextUrl.pathname).toBe(path);
      expect((await middleware(encoded)).status).toBe(429);
    }
  });

  it('spends nothing on a post the route refuses for its origin', async () => {
    const middleware = await loadMiddleware();
    const path = '/api/auth/workos/password';

    for (let i = 0; i < 10; i += 1) {
      const foreign = await middleware(request(path, 'POST', ADDRESS, 'https://evil.example'));

      expect(foreign.status).not.toBe(429);
    }

    expect((await middleware(request(path, 'POST', ADDRESS, null))).status).not.toBe(429);
    expect(await spend(middleware, path, 10)).not.toContain(429);
    expect((await middleware(request(path))).status).toBe(429);
  });

  it('never spends the budget on page views', async () => {
    const middleware = await loadMiddleware();

    expect(await spend(middleware, '/auth/login', 20, 'GET')).not.toContain(429);
    expect(await spend(middleware, '/api/auth/workos/password', 10)).not.toContain(429);
  });

  it('leaves the webhook and the AuthKit round trip out of the budget', async () => {
    const middleware = await loadMiddleware();

    await spend(middleware, '/api/auth/workos/password', 11);

    expect(await spend(middleware, '/api/auth/workos/webhook', 20)).not.toContain(429);
    expect(await spend(middleware, '/api/auth/workos/login', 3, 'GET')).not.toContain(429);
    expect(await spend(middleware, '/api/auth/workos/callback', 3, 'GET')).not.toContain(429);
  });

  it('is off in development, as before', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const middleware = await loadMiddleware();

    expect(await spend(middleware, '/api/auth/workos/password', 11)).not.toContain(429);
  });
});

describe('middleware refusals', () => {
  it('answers an API call without a session with a 401 that is never stored', async () => {
    const middleware = await loadMiddleware();

    const response = await middleware(request('/api/organizations', 'GET'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('middleware page allowlist', () => {
  it('protects every dashboard directory', async () => {
    const middleware = await loadMiddleware();
    const directories = readdirSync('src/app/(dashboard)', { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    expect(directories).toContain('orders');

    for (const directory of directories) {
      const response = await middleware(request(`/${directory}`, 'GET'));

      expect(response.status, directory).toBe(307);
      expect(response.headers.get('location'), directory).toBe('http://localhost:3000/auth/login');
    }
  });

  it('sends a visitor with a session from the landing page to the dashboard', async () => {
    const middleware = await loadMiddleware();

    const response = await middleware(
      new NextRequest('http://localhost:3000/', { headers: { cookie: 'wos-session=sealed' } })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `http://localhost:3000${DEFAULT_AUTHENTICATED_ROUTE}`
    );
  });

  it('lets a visitor without a session see the landing page', async () => {
    const middleware = await loadMiddleware();

    const response = await middleware(request('/', 'GET'));

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('middleware API budget', () => {
  it('answers the 101st API call from one address within a minute with a 429', async () => {
    const middleware = await loadMiddleware();

    expect(await spend(middleware, '/api/products', 100, 'GET')).not.toContain(429);

    const response = await middleware(request('/api/products', 'GET'));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'Too many requests' });
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
