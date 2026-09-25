import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUrl } from './app-url';

/**
 * The app's origin, as the same-origin guard and the WorkOS redirects read
 * it. Production never guesses: with NEXT_PUBLIC_APP_URL unset it throws
 * instead of falling back to a localhost address. Outside production the
 * fallback is the port `npm run dev` serves on, 3002; until 24 Sep 2026 it
 * was 3000 in every mode.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('appUrl', () => {
  it('answers NEXT_PUBLIC_APP_URL when it is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example');

    expect(appUrl()).toBe('https://app.example');
  });

  it.each([undefined, ''])('throws in production when it is %j', value => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', value);

    expect(() => appUrl()).toThrow('NEXT_PUBLIC_APP_URL must be set in production');
  });

  it.each(['development', 'test'])('falls back to the dev server on port 3002 in %s', mode => {
    vi.stubEnv('NODE_ENV', mode);
    vi.stubEnv('NEXT_PUBLIC_APP_URL', undefined);

    expect(appUrl()).toBe('http://localhost:3002');
  });
});
