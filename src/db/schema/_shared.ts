import { sql } from 'drizzle-orm';
import { pgPolicy, pgRole, timestamp } from 'drizzle-orm/pg-core';

/**
 * Building blocks every table uses. This file imports no table, so the schema
 * modules can depend on it without a cycle.
 */

/**
 * The role the app connects as. Created once per Neon project with SQL
 * (db/bootstrap-roles.sql), never by a migration: CREATE ROLE carries a
 * password, and a console-created role would have BYPASSRLS.
 */
export const appRole = pgRole('sculptors_app').existing();

// mode 'date': the driver hands back text and Drizzle builds a Date. The
// wire mappers (lib/workos/dto.ts) call toISOString(), so API JSON carries
// ISO strings.
export const timestamps = {
  createdAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
};

// current_setting(..., true) returns NULL (or '' on a backend that saw the
// setting before) when withTenant did not run, so the comparison is never true.
const tenantPredicate = sql`organization_id = current_setting('app.organization_id', true)`;

/** A tenant table: the app role sees and writes only the rows of the organization set by withTenant. */
export const tenantPolicy = (table: string) =>
  pgPolicy(`${table}_tenant_isolation`, {
    as: 'permissive',
    for: 'all',
    to: appRole,
    using: tenantPredicate,
    withCheck: tenantPredicate,
  });

/**
 * A control-plane table (identity): read across organizations by design,
 * because listing a user's organizations IS the auth path. RLS stays enabled
 * so "every table has RLS" remains a one-line invariant and a narrower role
 * can be given its own policy later; this policy is the explicit decision
 * that the app role may use the whole table.
 */
export const controlPlanePolicy = (table: string) =>
  pgPolicy(`${table}_app_all`, {
    as: 'permissive',
    for: 'all',
    to: appRole,
    using: sql`true`,
    withCheck: sql`true`,
  });
