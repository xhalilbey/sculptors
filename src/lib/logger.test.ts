import { DrizzleQueryError } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A failed Drizzle query carries the bound values in its message. Those are
 * user data the key-based masking never sees, so the logger must drop them
 * and keep the database's own reason instead.
 *
 * In production every line is one JSON object that Cloud Logging files by
 * `severity`: errors on stderr through console.error, warnings through
 * console.warn, info on stdout through console.log. The logger's own keys
 * cannot be forged from the context, and the browser bundle keeps info
 * lines (which carry user and organization ids) out of the visitor's
 * console. Whether the build keeps those console calls at all is pinned in
 * src/next-config.test.ts, because Vitest never runs Next's compiler.
 *
 * Secret keys are redacted whatever their case and wherever they sit, in
 * nested objects and in arrays, while the ids operators need stay readable.
 */

function uniqueViolation() {
  const cause = Object.assign(new Error('duplicate key value violates unique constraint "users_email_lower_key"'), {
    code: '23505',
    constraint: 'users_email_lower_key',
    detail: 'Key (lower(email))=(alice@example.com) already exists.',
  });

  return new DrizzleQueryError(
    'insert into "users" ("workos_user_id", "email", "first_name") values ($1, $2, $3)',
    ['user_1', 'alice@example.com', 'Alice'],
    cause
  );
}

async function loggerFor(env: 'production' | 'development') {
  vi.stubEnv('NODE_ENV', env);
  vi.resetModules();

  return (await import('./logger')).logger;
}

function entryOf(spy: { mock: { calls: unknown[][] } }, call = 0) {
  return JSON.parse(String(spy.mock.calls[call]?.[0]));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('logger with a failed query', () => {
  it.each(['production', 'development'] as const)('never writes the bound values (%s)', async (env) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = await loggerFor(env);

    logger.error('Failed to sync WorkOS user', { error: uniqueViolation() });
    logger.error('Unhandled route error', uniqueViolation());

    const output = [...log.mock.calls, ...error.mock.calls].flat().join('\n');

    expect(output).not.toMatch(/alice@example\.com|Alice|params/);
    expect(output).toContain('users_email_lower_key');
    expect(output).toContain('23505');
    expect(output).toContain('insert into \\"users\\"');
  });

  it('logs an ordinary error as before', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = await loggerFor('production');

    logger.error('Boom', { error: new Error('plain failure') });

    const entry = entryOf(error);

    expect(entry.error.error).toEqual({ name: 'Error', message: 'plain failure' });
    expect(entry.severity).toBe('ERROR');
    expect(entry.level).toBe('error');
    expect(log).not.toHaveBeenCalled();
  });
});

describe('logger in production', () => {
  it('writes a warning with severity WARNING', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logger = await loggerFor('production');

    logger.warn('Route error', { requestId: 'req-1', status: 404 });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(entryOf(warn)).toMatchObject({
      severity: 'WARNING',
      level: 'warn',
      message: 'Route error',
      requestId: 'req-1',
      status: 404,
    });
  });

  it('writes info to stdout with severity INFO', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logger = await loggerFor('production');

    logger.info('Organization created', { organizationId: 'org_1' });
    logger.auth('Session bound', { userId: 'user_1' });

    expect(log).toHaveBeenCalledTimes(2);
    expect(entryOf(log, 0)).toMatchObject({
      severity: 'INFO',
      level: 'info',
      message: 'Organization created',
      organizationId: 'org_1',
    });
    expect(entryOf(log, 1)).toMatchObject({ severity: 'INFO', message: '[AUTH] Session bound' });
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('a context key cannot overwrite severity or message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = await loggerFor('production');

    logger.error('Boom', undefined, {
      severity: 'DEBUG',
      level: 'debug',
      message: 'forged',
      timestamp: 'long ago',
      requestId: 'req-1',
    });

    const entry = entryOf(error);

    expect(entry).toMatchObject({ severity: 'ERROR', level: 'error', message: 'Boom', requestId: 'req-1' });
    expect(entry.timestamp).not.toBe('long ago');
  });

  it('redacts camelCase secrets and those inside arrays', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logger = await loggerFor('production');

    logger.warn('Session detail', {
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      sessionId: 's-1',
      sealedSession: 'seal-1',
      refreshedSessionData: 'seal-2',
      pendingAuthenticationToken: 'p-1',
      nested: { cookiePassword: 'cp-1' },
      list: [{ refresh_token: 'rt-2' }, [{ sessionData: 'seal-3' }], new Error('in a list'), 'plain'],
      userId: 'u-1',
      organizationId: 'org_1',
      sessionOrganizationId: 'org_2',
      email: 'ada@example.com',
    });

    const line = String(warn.mock.calls[0]?.[0]);
    const entry = entryOf(warn);

    expect(line).not.toMatch(/at-1|rt-1|s-1|seal-1|seal-2|seal-3|p-1|cp-1|rt-2|ada@/);
    expect(entry).toMatchObject({
      accessToken: '[REDACTED]',
      sealedSession: '[REDACTED]',
      nested: { cookiePassword: '[REDACTED]' },
      list: [
        { refresh_token: '[REDACTED]' },
        [{ sessionData: '[REDACTED]' }],
        { name: 'Error', message: 'in a list' },
        'plain',
      ],
      userId: 'u-1',
      organizationId: 'org_1',
      sessionOrganizationId: 'org_2',
      email: 'a*a@example.com',
    });
  });

  it('stays quiet for info in a production browser bundle', async () => {
    vi.stubGlobal('window', {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = await loggerFor('production');

    logger.info('Organization created', { organizationId: 'org_1' });
    logger.auth('WorkOS authentication check completed', { userId: 'user_1' });
    logger.error('Failed to create organization', new Error('offline'));

    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(entryOf(error).severity).toBe('ERROR');
  });
});
