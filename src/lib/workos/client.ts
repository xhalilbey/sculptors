import 'server-only';

import { WorkOS } from '@workos-inc/node';

/**
 * The WorkOS client and its configuration, on their own so that modules
 * which only need the client (organizations, webhooks) do not import the
 * whole session layer -- and so the session layer can import them without
 * a cycle.
 */

export function getWorkOSEnv() {
  const apiKey = process.env.WORKOS_API_KEY;
  const clientId = process.env.WORKOS_CLIENT_ID;
  const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri =
    process.env.WORKOS_REDIRECT_URI || `${appUrl}/api/auth/workos/callback`;

  if (!apiKey || !clientId || !cookiePassword) {
    throw new Error(
      'WorkOS configuration missing. Required: WORKOS_API_KEY, WORKOS_CLIENT_ID, WORKOS_COOKIE_PASSWORD'
    );
  }

  // The sealed-session cipher needs 32 bytes of key material. WorkOS checks
  // this too, but at the first request rather than at boot; failing here
  // turns a confusing runtime error into a configuration error.
  if (cookiePassword.length < 32) {
    throw new Error('WORKOS_COOKIE_PASSWORD must be at least 32 characters');
  }

  return { apiKey, clientId, cookiePassword, appUrl, redirectUri };
}

let client: WorkOS | null = null;

export function getWorkOSClient() {
  if (!client) {
    const { apiKey, clientId } = getWorkOSEnv();

    client = new WorkOS(apiKey, { clientId });
  }

  return client;
}
