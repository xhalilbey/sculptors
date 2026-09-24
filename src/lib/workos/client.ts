import 'server-only';

import { WorkOS } from '@workos-inc/node';
import { appUrl } from '@/lib/app-url';

/**
 * The WorkOS client and its configuration, on their own so that modules
 * which only need the client (organizations, webhooks) do not import the
 * whole session layer -- and so the session layer can import them without
 * a cycle.
 */

/**
 * The WorkOS credentials alone: the API key and client id the client is
 * built with, and the password that seals the session cookie. Kept apart
 * from the app URL so that building the client never depends on it.
 */
function getWorkOSCredentials() {
  const apiKey = process.env.WORKOS_API_KEY;
  const clientId = process.env.WORKOS_CLIENT_ID;
  const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;

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

  return { apiKey, clientId, cookiePassword };
}

/**
 * The credentials plus the app's origin and the AuthKit callback address,
 * for the session layer and the sign-in, callback and logout routes.
 */
export function getWorkOSEnv() {
  const credentials = getWorkOSCredentials();
  // lib/app-url.ts: throws in production when NEXT_PUBLIC_APP_URL is unset,
  // rather than redirecting everyone to a localhost default.
  const origin = appUrl();
  const redirectUri =
    process.env.WORKOS_REDIRECT_URI || `${origin}/api/auth/workos/callback`;

  return { ...credentials, appUrl: origin, redirectUri };
}

let client: WorkOS | null = null;

/**
 * The one WorkOS client, built from the credentials alone. It never reads
 * the app URL, so a production deployment without NEXT_PUBLIC_APP_URL still
 * verifies and applies webhook deliveries (a public route the same-origin
 * guard does not cover). As first written on 24 Sep 2026 the client was
 * built through getWorkOSEnv, so that error reached the webhook's signature
 * check and every delivery was answered 401 as a bad signature.
 */
export function getWorkOSClient() {
  if (!client) {
    const { apiKey, clientId } = getWorkOSCredentials();

    client = new WorkOS(apiKey, { clientId });
  }

  return client;
}
