import { WorkOS } from '@workos-inc/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The WorkOS configuration and client. getWorkOSEnv carries the app URL
 * (lib/app-url.ts) for the redirects: the callback defaults to the dev
 * server on port 3002 outside production, and production with no
 * NEXT_PUBLIC_APP_URL is a configuration error. The client is built from
 * the credentials alone, so that error never reaches it: the webhook, which
 * the same-origin guard does not cover, keeps verifying deliveries. As first
 * written on 24 Sep 2026 the client went through getWorkOSEnv, and every
 * delivery was answered 401 as a bad signature.
 */

async function load() {
  // The client is memoised per module instance.
  vi.resetModules();

  return import('./client');
}

beforeEach(() => {
  vi.stubEnv('WORKOS_API_KEY', 'sk_test_dummy');
  vi.stubEnv('WORKOS_CLIENT_ID', 'client_test');
  vi.stubEnv('WORKOS_COOKIE_PASSWORD', 'x'.repeat(32));
  vi.stubEnv('WORKOS_REDIRECT_URI', undefined);
  vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getWorkOSEnv', () => {
  it('defaults the callback to the dev server on port 3002 outside production', async () => {
    const { getWorkOSEnv } = await load();

    expect(getWorkOSEnv()).toMatchObject({
      appUrl: 'http://localhost:3002',
      redirectUri: 'http://localhost:3002/api/auth/workos/callback',
    });
  });

  it('builds the callback on NEXT_PUBLIC_APP_URL unless WORKOS_REDIRECT_URI is set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example');
    const { getWorkOSEnv } = await load();

    expect(getWorkOSEnv().redirectUri).toBe('https://app.example/api/auth/workos/callback');

    vi.stubEnv('WORKOS_REDIRECT_URI', 'https://auth.example/callback');

    expect(getWorkOSEnv().redirectUri).toBe('https://auth.example/callback');
  });

  it('throws in production when NEXT_PUBLIC_APP_URL is unset', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getWorkOSEnv } = await load();

    expect(() => getWorkOSEnv()).toThrow('NEXT_PUBLIC_APP_URL must be set in production');
  });
});

describe('getWorkOSClient', () => {
  it('builds the client in production without NEXT_PUBLIC_APP_URL', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { getWorkOSClient } = await load();

    expect(getWorkOSClient()).toBeInstanceOf(WorkOS);
  });

  it('refuses to build the client without its credentials', async () => {
    vi.stubEnv('WORKOS_API_KEY', undefined);
    const { getWorkOSClient } = await load();

    expect(() => getWorkOSClient()).toThrow('WorkOS configuration missing');
  });
});
