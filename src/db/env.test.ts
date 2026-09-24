import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * dbEnv's refinements are tripwires for pasting the wrong URL into the app's
 * slot. Each must refuse, and the refusal must never repeat the URL: it
 * carries the password. They must also read the URL as pg does: a query
 * parameter pg applies over the URL's parts, a repeated key (pg keeps the
 * last), or a socket: URL would otherwise connect somewhere the checks never
 * looked.
 */

const PASSWORD = 's3cret-p4ss';
const POOLED = `postgresql://sculptors_app:${PASSWORD}@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full`;
// The local Postgres the cloud sessions run the app against.
const LOCAL_POOLED =
  `postgres://sculptors_app:${PASSWORD}@db-pooler.sculptors.test:5432/sculptors` +
  '?sslmode=verify-full&sslrootcert=/var/lib/postgresql/sculptors-dev/ca.crt';

async function load(url: string | undefined) {
  // Owner-only keys exported in the developer's shell must not decide these
  // cases. A case about them sets its key after load(): dbEnv reads the
  // environment when called, not when imported.
  vi.stubEnv('DATABASE_URL_UNPOOLED', undefined);
  vi.stubEnv('NEON_API_KEY', undefined);

  if (url === undefined) {
    vi.stubEnv('DATABASE_URL', undefined);
  } else {
    vi.stubEnv('DATABASE_URL', url);
  }
  // dbEnv caches a success per module instance.
  vi.resetModules();

  return (await import('./env')).dbEnv;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('dbEnv', () => {
  it('accepts the pooled app-role URL with verified TLS', async () => {
    const dbEnv = await load(POOLED);

    expect(dbEnv().DATABASE_URL).toBe(POOLED);
  });

  it.each([
    ["Neon's copied form with channel_binding", `${POOLED}&channel_binding=require`],
    ['the local pooled URL with its own CA', LOCAL_POOLED],
  ])('accepts %s', async (_case, url) => {
    const dbEnv = await load(url);

    expect(dbEnv().DATABASE_URL).toBe(url);
  });

  it.each([
    ['unset', undefined, /DATABASE_URL is not set/],
    ['not a URL', 'nonsense', /not a URL/],
    ['the direct host', POOLED.replace('-pooler.', '.'), /pooled host/],
    ['the owner role', POOLED.replace('sculptors_app:', 'neondb_owner:'), /sculptors_app, not the owner/],
    ['sslmode=require', POOLED.replace('verify-full', 'require'), /sslmode=verify-full/],
    ['no sslmode', POOLED.replace('?sslmode=verify-full', ''), /sslmode=verify-full/],
    ['a socket: URL', POOLED.replace('postgresql:', 'socket:'), /postgres:\/\/ or postgresql:\/\/ scheme/],
    ['a user parameter', `${POOLED}&user=neondb_owner`, /only sslmode, channel_binding and sslrootcert/],
    ['a host parameter', `${POOLED}&host=ep-x.eu-central-1.aws.neon.tech`, /only sslmode, channel_binding/],
    ['an options parameter', `${POOLED}&options=-c%20role%3Dneondb_owner`, /only sslmode, channel_binding/],
    ['a second sslmode=disable', `${POOLED}&sslmode=disable`, /must not repeat a query parameter/],
    ['a second sslmode=no-verify', `${POOLED}&sslmode=no-verify`, /must not repeat a query parameter/],
  ])('refuses %s without echoing the URL', async (_case, url, rule) => {
    const dbEnv = await load(url);

    const message = (() => {
      try {
        dbEnv();
      } catch (error) {
        return (error as Error).message;
      }

      return null;
    })();

    expect(message).toMatch(rule);
    expect(message).not.toContain(PASSWORD);
  });

  it.each(['DATABASE_URL_UNPOOLED', 'NEON_API_KEY'])('refuses to start while %s is set', async (key) => {
    const secret = 'owner-only-value';

    const dbEnv = await load(POOLED);

    vi.stubEnv(key, secret);

    const message = (() => {
      try {
        dbEnv();
      } catch (error) {
        return (error as Error).message;
      }

      return null;
    })();

    expect(message).toMatch(`${key} must not be in the app's environment`);
    expect(message).not.toContain(secret);
  });

  it('ignores an owner-only key left empty by a copied template', async () => {
    const dbEnv = await load(POOLED);

    vi.stubEnv('DATABASE_URL_UNPOOLED', '');
    vi.stubEnv('NEON_API_KEY', '');

    expect(dbEnv().DATABASE_URL).toBe(POOLED);
  });
});
