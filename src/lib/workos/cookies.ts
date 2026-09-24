import 'server-only';

import type { NextRequest } from 'next/server';
import { WORKOS_SESSION_COOKIE, WORKOS_SESSION_MAX_AGE, WORKOS_STATE_COOKIE } from './constants';

/**
 * The two cookies the WorkOS flow sets, written in one place so their
 * attributes cannot drift between the routes that set, refresh and clear
 * them: the sealed session, and the OAuth state the callback checks.
 */

type CookieOptions = {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
};

/** Anything with a Next-style cookie jar: a NextResponse, or a test double. */
type CookieWriter = { cookies: { set: (options: CookieOptions) => void } };

const STATE_MAX_AGE = 10 * 60;

function write(response: CookieWriter, name: string, value: string, maxAge: number) {
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export function setWorkOSSessionCookie(response: CookieWriter, sessionData: string) {
  write(response, WORKOS_SESSION_COOKIE, sessionData, WORKOS_SESSION_MAX_AGE);
}

export function clearWorkOSSessionCookie(response: CookieWriter) {
  write(response, WORKOS_SESSION_COOKIE, '', 0);
}

export function setWorkOSStateCookie(response: CookieWriter, state: string) {
  write(response, WORKOS_STATE_COOKIE, state, STATE_MAX_AGE);
}

export function clearWorkOSStateCookie(response: CookieWriter) {
  write(response, WORKOS_STATE_COOKIE, '', 0);
}

export function readWorkOSStateCookie(request: NextRequest): string | undefined {
  return request.cookies.get(WORKOS_STATE_COOKIE)?.value;
}
