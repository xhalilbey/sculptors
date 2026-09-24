import 'server-only';

import { withTenant, type TenantDb } from '@/db/tenant';
import type { OrganizationId } from '@/types/ids';

/**
 * The only way a route answers "is this resource visible to this tenant?".
 *
 * defineRoute's `resource` authorization used to take any async function and
 * trusted it to query inside withTenant; a resolver that queried any other
 * way (or not at all) was checking nothing the database enforces, and the
 * only thing saying so was a comment. A ResourceCheck is branded: it can only
 * be made by defineResourceCheck, whose function receives a TenantDb -- a
 * transaction with app.organization_id set, so RLS applies -- and
 * runResourceCheck is what runs it, inside withTenant, for the tenant
 * defineRoute authorized. A plain function no longer type-checks.
 *
 * This module and lib/identity are the only lib/ code allowed to import
 * src/db (see docs/architecture/boundaries.md).
 */

declare const resourceCheckBrand: unique symbol;

export type { TenantDb };

export type ResourceCheck<I> = {
  readonly [resourceCheckBrand]: true;
  readonly run: (tenant: TenantDb, input: I) => Promise<boolean>;
};

export function defineResourceCheck<I>(fn: (tenant: TenantDb, input: I) => Promise<boolean>): ResourceCheck<I> {
  // The brand has no runtime value; this is where it is attached.
  return { run: fn } as ResourceCheck<I>;
}

/** Runs the check inside withTenant for `organizationId`: RLS and the setting apply. */
export function runResourceCheck<I>(check: ResourceCheck<I>, input: I, organizationId: OrganizationId): Promise<boolean> {
  return withTenant(organizationId, (tenant) => check.run(tenant, input));
}
