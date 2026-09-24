import { text } from 'drizzle-orm/pg-core';
import type { OrganizationId } from '../../types/ids';
import { organizations } from './identity';

/**
 * Tenant tables. None exist yet; the first product table lands with its
 * feature slice. The ceremony for one is deliberately short:
 *
 *   export const products = pgTable('products', {
 *     id: uuid().primaryKey().defaultRandom(),
 *     organizationId: organizationId(),
 *     ...timestamps,
 *   }, (t) => [
 *     // Every composite index leads with organization_id, so the policy
 *     // predicate is cheap.
 *     index('products_org_created_idx').on(t.organizationId, t.createdAt),
 *     tenantPolicy('products'),
 *   ]).enableRLS();
 *
 * The schema test fails any table with an organization_id column that lacks
 * a tenant policy, so forgetting `tenantPolicy()` fails `npm test`.
 */
export const organizationId = () =>
  text()
    .$type<OrganizationId>()
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' });
