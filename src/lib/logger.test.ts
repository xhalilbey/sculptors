import { DrizzleQueryError } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A failed Drizzle query carries the bound values in its message. Those are
 * user data the key-based masking never sees, so the logger must drop them
 * and keep the database's own reason instead.
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

afterEach(() => {
  vi.unstubAllEnvs();
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
    const logger = await loggerFor('production');

    logger.error('Boom', { error: new Error('plain failure') });

    const entry = JSON.parse(String(log.mock.calls[0]?.[0]));

    expect(entry.error.error).toEqual({ name: 'Error', message: 'plain failure' });
  });
});
