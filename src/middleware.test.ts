import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The credential budget: POSTs to the password, email-code and
 * password-reset routes share ten attempts per address per 15 minutes, and
 * the eleventh is a 429 in the routes' own { success, error } envelope, which
 * the login page toasts. Page views, the webhook and the AuthKit round trip
 * spend none of it. Before 24 Sep the budget ran on /auth/* page views
 * instead, and these POSTs were not throttled at all.
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

function request(path: string, method = 'POST', address = ADDRESS) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: 'http://localhost:3000', 'x-forwarded-for': address },
  });
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
