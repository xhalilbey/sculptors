import 'server-only';

import { eq, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { OrganizationId } from '@/types/ids';
import { getDb, type Db, type Tx } from './client';

/**
 * The tenant boundary. Every read or write of a tenant table goes through
 * `withTenant`, which enforces isolation twice:
 *
 *   1. In Postgres. The transaction sets `app.organization_id`, and each
 *      tenant table's RLS policy (schema/_shared.ts `tenantPolicy`) admits
 *      only rows carrying that id. Outside `withTenant` the setting is unset
 *      or '', the predicate is false, and the app role sees and writes
 *      nothing: it fails closed.
 *   2. In the query. Tenant repositories also filter with `tenantWhere`, so a
 *      misconfigured role degrades to "still filtered", not to a full leak.
 *
 * Do not await network I/O (WorkOS, an LLM, fetch) inside the callback: it
 * holds a pooled connection for its whole duration.
 */

declare const tenantBrand: unique symbol;

/** A transaction whose backend has app.organization_id set. Only withTenant makes one. */
export type TenantDb = {
  readonly tx: Tx;
  readonly organizationId: OrganizationId;
  readonly [tenantBrand]: true;
};

/**
 * Test harness only: the PGlite handle. The harness also owns the switch to
 * the app role (PGlite connects as a superuser), so the production boundary
 * carries no role hook of its own.
 */
type WithTenantOptions = { db?: Db };

export async function withTenant<T>(
  organizationId: OrganizationId,
  fn: (tenant: TenantDb) => Promise<T>,
  options: WithTenantOptions = {}
): Promise<T> {
  const db = options.db ?? getDb();

  return db.transaction(async (tx) => {
    // set_config(name, value, is_local => true) is SET LOCAL with a bind
    // parameter. It dies with the transaction, which PgBouncer pins to one
    // backend, so it cannot leak to the next request on that backend.
    await tx.execute(sql`select set_config('app.organization_id', ${organizationId}, true)`);

    return fn({ tx, organizationId } as TenantDb);
  });
}

/** The query-level half of the boundary: `where organization_id = <the tenant>`. */
export function tenantWhere<T extends { organizationId: PgColumn }>(tenant: TenantDb, table: T): SQL {
  return eq(table.organizationId, tenant.organizationId);
}
