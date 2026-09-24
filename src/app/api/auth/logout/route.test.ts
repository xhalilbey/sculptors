import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Logout ends the session at WorkOS as well as in the browser, so a copy of
 * the cookie cannot be refreshed afterwards. The failure directions matter
 * most: a missing, unreadable or expired cookie, and a WorkOS that errors or
 * hangs, must all still sign the browser out, promptly. The two guards stay
 * as they were: GET only as a top-level navigation, POST only from our own
 * origin, and neither refusal reads the cookie or clears it. The cookie
 * helpers run for real, so the Set-Cookie attributes here are the ones
 * production sends.
 */

const getSessionFromCookie = vi.fn();
const revokeSession = vi.fn();
const warn = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/identity', () => ({}));
vi.mock('@/lib/workos/client', () => ({
  getWorkOSEnv: () => ({ clientId: 'client_test', cookiePassword: 'x'.repeat(32), appUrl: 'http://localhost:3000' }),
  getWorkOSClient: () => ({ userManagement: { getSessionFromCookie, revokeSession } }),
}));

const { GET, POST } = await import('./route');

/** An access token as WorkOS signs it; only the payload is read. */
function accessToken(claims: Record<string, unknown>) {
  return `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

function navigate(headers: Record<string, string> = { cookie: 'wos-session=sealed', 'sec-fetch-mode': 'navigate' }) {
  return GET(new NextRequest('http://localhost:3000/api/auth/logout', { headers }));
}

function post(origin: string) {
  return POST(
    new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { origin, cookie: 'wos-session=sealed' },
    })
  );
}

function setCookie(response: Response, name: string) {
  return response.headers.getSetCookie().find(cookie => cookie.startsWith(`${name}=`));
}

function expectSignedOut(response: Response) {
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('http://localhost:3000/');

  const session = setCookie(response, 'wos-session');

  expect(session).toMatch(/^wos-session=;/);
  expect(session).toContain('Max-Age=0');
  expect(session).toContain('Path=/');
  expect(session).toContain('HttpOnly');
  expect(session).toMatch(/SameSite=lax/i);
  expect(setCookie(response, 'wos-state')).toMatch(/^wos-state=;.*Max-Age=0/);
}

beforeEach(() => {
  getSessionFromCookie.mockReset();
  revokeSession.mockReset();
  warn.mockReset();
  getSessionFromCookie.mockResolvedValue({ accessToken: accessToken({ sid: 'session_01', org_id: 'org_A' }) });
  revokeSession.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/auth/logout', () => {
  it.each(['no-cors', 'cors'])('refuses a %s subresource request without reading or clearing the cookie', async mode => {
    const response = await navigate({ cookie: 'wos-session=sealed', 'sec-fetch-mode': mode });

    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(getSessionFromCookie).not.toHaveBeenCalled();
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it('revokes the session at WorkOS, clears the cookies and returns to the app root', async () => {
    const response = await navigate();

    expectSignedOut(response);
    expect(getSessionFromCookie).toHaveBeenCalledWith({ sessionData: 'sealed', cookiePassword: 'x'.repeat(32) });
    expect(revokeSession).toHaveBeenCalledWith({ sessionId: 'session_01' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('treats a request without sec-fetch-mode as a navigation, for older browsers', async () => {
    const response = await navigate({ cookie: 'wos-session=sealed' });

    expectSignedOut(response);
    expect(revokeSession).toHaveBeenCalledWith({ sessionId: 'session_01' });
  });

  it('reads the session id from an expired access token, the usual state after a 401', async () => {
    getSessionFromCookie.mockResolvedValue({ accessToken: accessToken({ sid: 'session_old', exp: 1 }) });

    const response = await navigate();

    expectSignedOut(response);
    expect(revokeSession).toHaveBeenCalledWith({ sessionId: 'session_old' });
  });

  it('signs out without asking WorkOS anything when there is no cookie', async () => {
    const response = await navigate({ 'sec-fetch-mode': 'navigate' });

    expectSignedOut(response);
    expect(getSessionFromCookie).not.toHaveBeenCalled();
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it.each([
    ['a seal that does not open', {}],
    ['a token that is not a JWT', { accessToken: 'opaque' }],
    ['a token without a session id', { accessToken: accessToken({ org_id: 'org_A' }) }],
  ])('signs out without a revocation for %s', async (_label, unsealed) => {
    getSessionFromCookie.mockResolvedValue(unsealed);

    const response = await navigate();

    expectSignedOut(response);
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it('signs out when the cookie cannot be read, logging only the error type', async () => {
    getSessionFromCookie.mockRejectedValue(new TypeError('sealed data for session_01'));

    const response = await navigate();

    expectSignedOut(response);
    expect(revokeSession).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Could not end the WorkOS session at logout', { errorType: 'TypeError' });
  });

  it('signs out when WorkOS refuses the revocation, logging only the error type', async () => {
    const refused = new Error('Session session_01 could not be revoked');

    refused.name = 'BadRequestException';
    revokeSession.mockRejectedValue(refused);

    const response = await navigate();

    expectSignedOut(response);
    expect(warn).toHaveBeenCalledWith('Could not end the WorkOS session at logout', {
      errorType: 'BadRequestException',
    });
  });

  it('stops waiting for WorkOS after three seconds and signs out anyway', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    revokeSession.mockReturnValue(new Promise(() => {}));

    let settled = false;
    const pending = navigate().finally(() => {
      settled = true;
    });

    // setImmediate is left real: it runs once the promise chain up to the
    // revocation has settled, so the three seconds start from here.
    await new Promise(resolve => setImmediate(resolve));

    expect(revokeSession).toHaveBeenCalledWith({ sessionId: 'session_01' });

    await vi.advanceTimersByTimeAsync(2999);

    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expectSignedOut(await pending);
    expect(warn).toHaveBeenCalledWith('Could not end the WorkOS session at logout', {
      errorType: 'RevokeTimeoutError',
    });
  });
});

describe('POST /api/auth/logout', () => {
  it('refuses a cross-site post without reading or clearing the cookie', async () => {
    const response = await post('https://evil.example');

    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(getSessionFromCookie).not.toHaveBeenCalled();
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it('revokes the session and signs out for a same-origin post', async () => {
    const response = await post('http://localhost:3000');

    expectSignedOut(response);
    expect(revokeSession).toHaveBeenCalledWith({ sessionId: 'session_01' });
  });
});
