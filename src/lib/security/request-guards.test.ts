import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The same-origin (CSRF) guard that every state-changing route runs first:
 * defineRoute for every non-GET, and by hand in the pre-session auth routes
 * and logout. An Origin header, `null` included, decides alone; the Referer
 * counts only when there is no Origin, and a request with neither is refused.
 * The comparison is the full origin of NEXT_PUBLIC_APP_URL (scheme, host
 * and port). Loopback hosts pass on any port outside production and never in
 * it, and production with no app URL refuses everything and says why.
 *
 * Before 24 Sep 2026 an Origin of `null` fell through to the Referer, only
 * the host was compared, production fell back to admitting
 * http://localhost:3000, and none of it was tested. The guard reads the
 * environment on every call, so vi.stubEnv is enough.
 */

const APP = 'https://app.example';
const error = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error, info: vi.fn(), debug: vi.fn() },
}));

const { requireSameOrigin } = await import('./request-guards');

function guard(headers: Record<string, string>) {
  return requireSameOrigin(
    new NextRequest('http://localhost:3000/api/x', { method: 'POST', headers })
  );
}

beforeEach(() => {
  error.mockReset();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', APP);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('requireSameOrigin', () => {
  it.each([
    ['no origin and no referer', {}],
    ['a foreign origin', { origin: 'https://evil.example' }],
    ['a foreign origin with our referer', { origin: 'https://evil.example', referer: `${APP}/settings` }],
    ['an origin of null with our referer', { origin: 'null', referer: `${APP}/settings` }],
    ['an empty origin with our referer', { origin: '', referer: `${APP}/settings` }],
    ['an origin that is not a url', { origin: 'app.example' }],
    ['no origin and a foreign referer', { referer: 'https://evil.example/app.example' }],
    ['a host that only begins with localhost', { origin: 'http://localhost.evil.example' }],
  ])('refuses %s', async (_case, headers) => {
    const response = guard(headers);

    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: 'Invalid or missing origin' });
  });

  it.each([
    ['our origin', { origin: APP }],
    ['no origin and our referer', { referer: `${APP}/settings?tab=general` }],
    ['localhost on any port', { origin: 'http://localhost:4000' }],
    ['127.0.0.1 on any port', { origin: 'http://127.0.0.1:5173' }],
    ['the ipv6 loopback', { origin: 'http://[::1]:3002' }],
  ])('allows %s outside production', (_case, headers) => {
    expect(guard(headers)).toBeNull();
  });

  describe('in production', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it.each([
      ['our origin', { origin: APP }],
      ['no origin and our referer', { referer: `${APP}/settings` }],
    ])('allows %s', (_case, headers) => {
      expect(guard(headers)).toBeNull();
    });

    it('compares origins, so a configured url with a path still matches', () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', `${APP}/`);

      expect(guard({ origin: APP })).toBeNull();
    });

    it.each([
      ['our host over http', { origin: 'http://app.example' }],
      ['our host on another port', { origin: 'https://app.example:8443' }],
      ['localhost', { origin: 'http://localhost:3000' }],
      ['127.0.0.1', { origin: 'http://127.0.0.1:3000' }],
      ['our host over http as the referer', { referer: 'http://app.example/settings' }],
    ])('refuses %s', (_case, headers) => {
      expect(guard(headers)?.status).toBe(403);
    });

    it('refuses everything, and logs why, when NEXT_PUBLIC_APP_URL is unset', () => {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined);

      expect(guard({ origin: APP })?.status).toBe(403);
      expect(guard({ origin: 'http://localhost:3000' })?.status).toBe(403);
      expect(error).toHaveBeenCalledWith(
        'NEXT_PUBLIC_APP_URL is not set or not a URL; refusing state-changing requests',
        expect.objectContaining({ message: 'NEXT_PUBLIC_APP_URL must be set in production' })
      );
    });
  });
});
