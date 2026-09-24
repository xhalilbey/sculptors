import { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearWorkOSSessionCookie,
  clearWorkOSStateCookie,
  readWorkOSStateCookie,
  setWorkOSSessionCookie,
  setWorkOSStateCookie,
} from './cookies';

/**
 * The attributes of the two WorkOS cookies are written here once, and the
 * route tests replace these writers with a double (src/test/sign-in-mocks.ts),
 * so this file is what pins the Set-Cookie production sends. Both cookies are
 * HttpOnly, SameSite=Lax and on Path=/, and Secure exactly when NODE_ENV is
 * production. The sealed session lives thirty days and the OAuth state ten
 * minutes. A clear is the same name on the same path with an empty value and
 * Max-Age=0: a clear on any other path would leave the real cookie in the
 * browser. The writers run against a real NextResponse.
 */

function setCookie(response: NextResponse, name: string) {
  return response.headers.getSetCookie().find(cookie => cookie.startsWith(`${name}=`));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('setWorkOSSessionCookie', () => {
  it('writes the sealed session HttpOnly, SameSite=Lax, on every path, for thirty days', () => {
    const response = new NextResponse(null);

    setWorkOSSessionCookie(response, 'sealed');

    expect(response.cookies.get('wos-session')).toMatchObject({
      value: 'sealed',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 2592000,
    });
    expect(setCookie(response, 'wos-session')).not.toMatch(/;\s*Secure/i);
  });
});

describe('setWorkOSStateCookie', () => {
  it('writes the OAuth state with the same attributes, for ten minutes', () => {
    const response = new NextResponse(null);

    setWorkOSStateCookie(response, 'state-1');

    expect(response.cookies.get('wos-state')).toMatchObject({
      value: 'state-1',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
  });
});

describe('clearing the cookies', () => {
  it.each([
    ['wos-session', clearWorkOSSessionCookie],
    ['wos-state', clearWorkOSStateCookie],
  ])('empties %s on the same name and path with Max-Age=0', (name, clear) => {
    const response = new NextResponse(null);

    clear(response);

    expect(response.cookies.get(name)).toMatchObject({
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    expect(setCookie(response, name)).toContain('Max-Age=0');
  });
});

describe('in production', () => {
  it.each([
    ['setWorkOSSessionCookie', 'wos-session', (response: NextResponse) => setWorkOSSessionCookie(response, 'sealed')],
    ['setWorkOSStateCookie', 'wos-state', (response: NextResponse) => setWorkOSStateCookie(response, 'state-1')],
    ['clearWorkOSSessionCookie', 'wos-session', clearWorkOSSessionCookie],
    ['clearWorkOSStateCookie', 'wos-state', clearWorkOSStateCookie],
  ])('%s marks %s Secure', (_writer, name, write) => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = new NextResponse(null);

    write(response);

    expect(response.cookies.get(name)?.secure).toBe(true);
    expect(setCookie(response, name)).toMatch(/;\s*Secure/i);
  });
});

describe('readWorkOSStateCookie', () => {
  it('reads back the state setWorkOSStateCookie wrote, as the callback does', () => {
    const response = new NextResponse(null);

    setWorkOSStateCookie(response, 'state-1');

    const [pair] = response.headers.getSetCookie()[0]?.split(';') ?? [];
    const request = new NextRequest('http://localhost:3000/api/auth/workos/callback', {
      headers: { cookie: `wos-session=sealed; ${pair}` },
    });

    expect(readWorkOSStateCookie(request)).toBe('state-1');
  });

  it('reads nothing when the request carries no state cookie', () => {
    const request = new NextRequest('http://localhost:3000/api/auth/workos/callback', {
      headers: { cookie: 'wos-session=sealed' },
    });

    expect(readWorkOSStateCookie(request)).toBeUndefined();
  });
});
