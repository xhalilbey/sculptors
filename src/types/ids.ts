/**
 * Branded identifiers. Pure: no I/O, no framework, importable anywhere.
 *
 * A brand makes an id that has been checked a different type from a string
 * that has not. Tenant code takes an `OrganizationId`, so an id read from a
 * URL or a body has to pass through `parseOrganizationId` before it can reach
 * a query, and the compiler, not a reviewer, notices when it did not.
 */

declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** WorkOS organization id (org_...). Also the primary key of `organizations`. */
export type OrganizationId = Brand<string, 'OrganizationId'>;
/** Our own users.id (a uuid), not the WorkOS user id. */
export type UserId = Brand<string, 'UserId'>;
/** WorkOS organization membership id (om_...). */
export type MembershipId = Brand<string, 'MembershipId'>;

// Stricter than the table CHECK constraints, which only require the prefix
// (`id like 'org\_%'`): every value that parses here passes them, so the
// database never refuses a parsed id for its form. These literals are the
// only copy of the shapes; request schemas refine with isOrganizationId.
const ORGANIZATION_ID = /^org_[A-Za-z0-9]+$/;
const MEMBERSHIP_ID = /^om_[A-Za-z0-9]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOrganizationId(value: string): value is OrganizationId {
  return ORGANIZATION_ID.test(value);
}

export function parseOrganizationId(value: string): OrganizationId {
  if (!isOrganizationId(value)) throw new RangeError('Invalid organization id');

  return value;
}

export function isMembershipId(value: string): value is MembershipId {
  return MEMBERSHIP_ID.test(value);
}

export function parseMembershipId(value: string): MembershipId {
  if (!isMembershipId(value)) throw new RangeError('Invalid membership id');

  return value;
}

export function isUserId(value: string): value is UserId {
  return UUID.test(value);
}

export function parseUserId(value: string): UserId {
  if (!isUserId(value)) throw new RangeError('Invalid user id');

  return value;
}
