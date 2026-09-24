import { randomUUID } from 'crypto';
import { connection, NextResponse } from 'next/server';
import { getWorkOSClient, getWorkOSEnv } from '@/lib/workos/auth';
import { setWorkOSStateCookie } from '@/lib/workos/cookies';

export async function GET(request: Request) {
  await connection();
  const { clientId, redirectUri } = getWorkOSEnv();
  const state = randomUUID();
  const url = new URL(request.url);
  const screenHint = url.searchParams.get('screen_hint') === 'sign-up' ? 'sign-up' : 'sign-in';
  const loginHint = url.searchParams.get('login_hint') || undefined;

  const authorizationUrl = getWorkOSClient().userManagement.getAuthorizationUrl({
    provider: 'authkit',
    clientId,
    redirectUri,
    state,
    screenHint,
    loginHint,
  });

  const response = NextResponse.redirect(authorizationUrl);

  setWorkOSStateCookie(response, state);

  return response;
}
