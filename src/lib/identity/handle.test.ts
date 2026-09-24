import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DbExecutor } from '@/db/client';
import { unwrap, wrap } from './internal/handle';
import { identityDb, withIdentityTransaction } from './index';

/**
 * The identity handle is opaque to services: only a repository, through
 * unwrap(), can run a query with it. The @ts-expect-error lines are the
 * test -- `npm run typecheck` covers test files (tsconfig includes
 * **\/*.ts), so if the brand ever widens back to the executor, these lines
 * stop being errors and typecheck fails on the unused directive.
 */

// Never called: the point is what compiles, and identityDb() would need a
// DATABASE_URL at runtime.
export function servicesCannotQuery() {
  // @ts-expect-error -- a service cannot run raw SQL on the pool handle
  void identityDb().execute(sql`select 1`);
  // @ts-expect-error -- nor start a query builder
  void identityDb().select();

  void withIdentityTransaction(async (tx) => {
    // @ts-expect-error -- nor query inside a transaction it opened
    await tx.execute(sql`select 1`);
  });
}

describe('identity handle', () => {
  it('gives the executor back only through unwrap', () => {
    const executor = { marker: true } as unknown as DbExecutor;
    const handle = wrap(executor);

    expect(Object.keys(handle)).toEqual([]);
    expect(Object.isFrozen(handle)).toBe(true);
    expect(unwrap(handle)).toBe(executor);
  });

  it('refuses something that was not wrapped', () => {
    expect(() => unwrap({} as ReturnType<typeof wrap>)).toThrow(/Not an identity handle/);
  });
});
