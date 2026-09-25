import { NextRequest } from 'next/server';
import type * as NextServer from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The AuthKit sign-in redirect. The state it puts in the authorization URL
 * is the state it stores in the wos-state cookie, which the callback compares
 * (callback/route.test.ts): if the two drifted apart every sign-in would fail
 * as invalid_state, and a state that script could read, or that repeated,
 * would take away the CSRF guard of the whole OAuth flow. screen_hint is
 * narrowed to the two values AuthKit knows. The cookie writer runs for real;
 * only the WorkOS client and its configuration are replaced.
 */

const getAuthorizationUrl = vi.fn(
  (options: { state: string; screenHint?: string; loginHint?: string }) =>
    `https://api.workos.test/user_management/authorize?state=${options.state}`
);

// connection() needs a request scope, which only the Next server provides;
// it marks the route dynamic and does nothing else the test could observe.
vi.mock('next/server', async importOriginal => ({
  ...(await importOriginal<typeof NextServer>()),
  connection: async () => undefined,
}));
vi.mock('@/lib/workos/auth', () => ({
  getWorkOSEnv: () => ({ clientId: 'client_test', redirectUri: 'http://localhost:3000/api/auth/workos/callback' }),
  getWorkOSClient: () => ({ userManagement: { getAuthorizationUrl } }),
}));

const { GET } = await import('./route');

function login(query = '') {
  return GET(new NextRequest(`http://localhost:3000/api/auth/workos/login${query}`));
}

beforeEach(() => {
  getAuthorizationUrl.mockClear();
});

describe('GET /api/auth/workos/login', () => {
  it('stores the state it sends to AuthKit in an HttpOnly cookie', async () => {
    const response = await login();
    const location = new URL(response.headers.get('location') ?? '');
    const state = location.searchParams.get('state');

    expect(response.status).toBe(307);
    expect(location.origin).toBe('https://api.workos.test');
    expect(state).toBeTruthy();
    expect(response.cookies.get('wos-state')).toMatchObject({ value: state, httpOnly: true, sameSite: 'lax', path: '/' });
    expect(getAuthorizationUrl).toHaveBeenCalledWith({
      provider: 'authkit',
      clientId: 'client_test',
      redirectUri: 'http://localhost:3000/api/auth/workos/callback',
      state,
      screenHint: 'sign-in',
      loginHint: undefined,
    });
  });

  it('issues a new state on every visit', async () => {
    const first = await login();
    const second = await login();

    expect(first.cookies.get('wos-state')?.value).not.toBe(second.cookies.get('wos-state')?.value);
  });

  it.each([
    ['?screen_hint=sign-up', 'sign-up'],
    ['?screen_hint=sign-in', 'sign-in'],
    ['?screen_hint=admin', 'sign-in'],
    ['', 'sign-in'],
  ])('passes %j to AuthKit as the %s screen', async (query, screenHint) => {
    await login(query);

    expect(getAuthorizationUrl.mock.lastCall?.[0].screenHint).toBe(screenHint);
  });

  it('forwards login_hint, and leaves an empty one out', async () => {
    await login('?login_hint=ada%40example.com');

    expect(getAuthorizationUrl.mock.lastCall?.[0].loginHint).toBe('ada@example.com');

    await login('?login_hint=');

    expect(getAuthorizationUrl.mock.lastCall?.[0].loginHint).toBeUndefined();
  });
});
