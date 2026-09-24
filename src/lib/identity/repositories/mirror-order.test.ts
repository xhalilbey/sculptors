import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { fromProposedIfNotOlder } from './mirror-order';

/**
 * mirror-order splices table and column names into sql.raw, so both must be
 * names written in this code, never input. The @ts-expect-error line is the
 * test for the column: `npm run typecheck` covers test files, so if the
 * parameter ever widens back to string, the directive goes unused and
 * typecheck fails. The rendered SQL pins the snake_case name the database
 * knows, which a PgColumn's camelCase `.name` would not give.
 */

// Never called: the point is what compiles.
export function columnsAreNotInput(fromRequest: string) {
  // @ts-expect-error -- a column name from anywhere else does not compile
  void fromProposedIfNotOlder('users', fromRequest);
}

describe('fromProposedIfNotOlder', () => {
  it('takes the proposed value only when it is not older, by its database name', () => {
    const query = new PgDialect().sqlToQuery(fromProposedIfNotOlder('users', 'first_name'));

    expect(query).toEqual({
      sql:
        'case when (excluded.workos_updated_at >= users.workos_updated_at or users.workos_updated_at is null) ' +
        'then excluded.first_name else users.first_name end',
      params: [],
    });
  });
});
