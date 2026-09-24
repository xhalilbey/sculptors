import { type Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb, type Db } from './client';

/**
 * node-postgres re-emits an idle client's error on the pool, and an 'error'
 * event with no listener is thrown, which ends the process. These tests pin
 * the pool's listener (it logs the error's name and code, never its message)
 * and the TCP keepalive that lets a dropped idle connection surface there.
 * The pool is real but never connects: nothing here queries.
 */

const globalForDb = globalThis as unknown as { __sculptorsDb?: Db };

function poolOf(db: Db): Pool {
  return (db as unknown as { $client: Pool }).$client;
}

beforeEach(() => {
  vi.stubEnv('DATABASE_URL_UNPOOLED', undefined);
  vi.stubEnv('NEON_API_KEY', undefined);
  vi.stubEnv(
    'DATABASE_URL',
    'postgresql://sculptors_app:s3cret-p4ss@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full'
  );
});

afterEach(async () => {
  const db = globalForDb.__sculptorsDb;

  delete globalForDb.__sculptorsDb;
  vi.unstubAllEnvs();

  if (db) {
    await poolOf(db).end();
  }
});

describe('getDb', () => {
  it('logs an idle client failure instead of letting it end the process', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = poolOf(getDb());
    const failure = Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01',
    });

    expect(() => pool.emit('error', failure)).not.toThrow();
    expect(consoleError).toHaveBeenCalledOnce();

    const line = String(consoleError.mock.calls[0]?.[0]);

    expect(JSON.parse(line)).toMatchObject({
      severity: 'ERROR',
      level: 'error',
      message: 'Idle database client failed',
      error: { name: 'Error', code: '57P01' },
    });
    expect(line).not.toContain('administrator');
  });

  it('keeps one error listener and TCP keepalive across calls', () => {
    const pool = poolOf(getDb());

    getDb();

    expect(pool.listenerCount('error')).toBe(1);
    expect(pool.options.keepAlive).toBe(true);
  });
});
