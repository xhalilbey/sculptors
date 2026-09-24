import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import type { MembershipId, OrganizationId, UserId } from '../../types/ids';
import { controlPlanePolicy, timestamps } from './_shared';

/*
 * Identity: the control plane. The tenant is a WorkOS Organization and its
 * WorkOS id is the primary key of `organizations`, so the session's
 * organizationId and the row here are the same string.
 *
 * WorkOS is the source of truth; these tables are a MIRROR, written on sign-in
 * from the user's own memberships and by webhook for changes made elsewhere.
 * The mirror never grants access on its own -- the session does.
 *
 * Mirror writes are ordered by WorkOS's own clock: `workos_updated_at` holds
 * the updatedAt (or, for a deletion, the event time) of the WorkOS object the
 * row was last written from, and a write carrying an older one is ignored
 * (repositories/mirror-order.ts). Webhooks arrive out of order and a sign-in
 * can carry a snapshot older than the last webhook; neither may undo a newer
 * state.
 *
 * Every CHECK, UNIQUE, index and default of the original bootstrap SQL is
 * carried here by name. Status columns use `text({ enum })` for the compiler
 * AND `check()` for the database: the enum alone is erased at runtime.
 */

/** One row per WorkOS user we have seen. Profile fields cache what WorkOS said at last sign-in. */
export const users = pgTable(
  'users',
  {
    id: uuid().$type<UserId>().primaryKey().defaultRandom(),
    workosUserId: text().notNull(),
    email: text().notNull(),
    firstName: text(),
    lastName: text(),
    avatarUrl: text(),
    status: text({ enum: ['active', 'inactive', 'suspended'] }).notNull().default('active'),
    lastSeenAt: timestamp({ withTimezone: true, mode: 'date' }),
    workosUpdatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [
    unique('users_workos_user_id_key').on(t.workosUserId),
    // The WorkOS user id is the identity; an email is an attribute and may be
    // shared over time (a deleted WorkOS user's address reused by a new one).
    // A unique index here locked the new user out of sign-in. Kept as a
    // plain index for lookups by address.
    index('users_email_lower_idx').using('btree', sql`lower(${t.email})`),
    check('users_status_check', sql`${t.status} in ('active', 'inactive', 'suspended')`),
    controlPlanePolicy('users'),
  ]
).enableRLS();

/** The tenant. id = WorkOS organization id. */
export const organizations = pgTable(
  'organizations',
  {
    id: text().$type<OrganizationId>().primaryKey(),
    name: text().notNull(),
    slug: text().notNull().default(''),
    plan: text().notNull().default('free'),
    region: text().notNull().default('eu-central-1'),
    status: text({ enum: ['active', 'suspended', 'deleted'] }).notNull().default('active'),
    onboardingCompletedAt: timestamp({ withTimezone: true, mode: 'date' }),
    createdBy: uuid().$type<UserId>().references(() => users.id, { onDelete: 'set null' }),
    workosUpdatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
    deletedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (t) => [
    check('organizations_id_check', sql`${t.id} like 'org\\_%' escape '\\'`),
    check('organizations_name_check', sql`char_length(${t.name}) between 1 and 100`),
    check('organizations_status_check', sql`${t.status} in ('active', 'suspended', 'deleted')`),
    controlPlanePolicy('organizations'),
  ]
).enableRLS();

/** Mirror of WorkOS organization memberships. id = WorkOS membership id; role = WorkOS role slug. */
export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: text().$type<MembershipId>().primaryKey(),
    organizationId: text()
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid()
      .$type<UserId>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workosUserId: text().notNull(),
    role: text().notNull().default('member'),
    status: text({ enum: ['active', 'inactive', 'pending'] }).notNull().default('active'),
    workosUpdatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [
    unique('organization_memberships_org_user_key').on(t.organizationId, t.userId),
    index('organization_memberships_user_idx').on(t.userId).where(sql`${t.status} = 'active'`),
    index('organization_memberships_org_idx').on(t.organizationId).where(sql`${t.status} = 'active'`),
    check('organization_memberships_id_check', sql`${t.id} like 'om\\_%' escape '\\'`),
    check('organization_memberships_status_check', sql`${t.status} in ('active', 'inactive', 'pending')`),
    controlPlanePolicy('organization_memberships'),
  ]
).enableRLS();

/**
 * Every webhook event we accepted, keyed by WorkOS's event id. The primary
 * key is the idempotency guard: a redelivery of an event that was applied
 * (processed_at set) is acknowledged without applying it again; one whose
 * apply failed is applied again, and `attempts` counts the deliveries.
 * payload is kept for audit.
 */
export const workosWebhookEvents = pgTable(
  'workos_webhook_events',
  {
    id: text().primaryKey(),
    type: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true, mode: 'date' }),
    error: text(),
    attempts: integer().notNull().default(1),
  },
  (t) => [
    index('workos_webhook_events_unprocessed_idx').on(t.receivedAt).where(sql`${t.processedAt} is null`),
    controlPlanePolicy('workos_webhook_events'),
  ]
).enableRLS();

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
export type MembershipRow = typeof organizationMemberships.$inferSelect;
export type NewMembershipRow = typeof organizationMemberships.$inferInsert;
export type WebhookEventRow = typeof workosWebhookEvents.$inferSelect;
