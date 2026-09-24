import type { Event } from '@workos-inc/node';

/**
 * WorkOS webhook events for tests, in both shapes they exist in:
 *
 * - `wire*` builds the snake_case JSON WorkOS signs and POSTs (what the
 *   route receives); the seam test signs it with the real SDK.
 * - `event()` builds the DESERIALIZED Event the SDK's constructEvent returns
 *   (camelCase), which is what webhook-sync applies.
 *
 * Only the fields a test states matter; the rest are filled so the objects
 * are complete members of the SDK's types, not casts.
 */

export const AT = '2026-09-23T10:00:00.000Z';

type EventOf<E extends Event['event']> = Extract<Event, { event: E }>;

export function event<E extends Event['event']>(
  name: E,
  id: string,
  data: EventOf<E>['data'],
  createdAt = AT
): EventOf<E> {
  // Every member of the union is exactly these five fields; TypeScript
  // cannot see that through a generic Extract<>, hence the double cast.
  const built: { id: string; event: E; data: EventOf<E>['data']; createdAt: string; context: undefined } = {
    id,
    event: name,
    data,
    createdAt,
    context: undefined,
  };

  return built as unknown as EventOf<E>;
}

export function organization(fields: { id: string; name?: string; updatedAt?: string }) {
  return {
    object: 'organization' as const,
    id: fields.id,
    name: fields.name ?? fields.id,
    allowProfilesOutsideOrganization: false,
    domains: [],
    createdAt: AT,
    updatedAt: fields.updatedAt ?? AT,
    externalId: null,
    metadata: {},
  };
}

export function membership(fields: {
  id: string;
  organizationId: string;
  userId: string;
  organizationName?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'pending';
  updatedAt?: string;
}) {
  return {
    object: 'organization_membership' as const,
    id: fields.id,
    organizationId: fields.organizationId,
    organizationName: fields.organizationName ?? '',
    userId: fields.userId,
    status: fields.status ?? ('active' as const),
    role: { slug: fields.role ?? 'member' },
    directoryManaged: false,
    customAttributes: {},
    createdAt: AT,
    updatedAt: fields.updatedAt ?? AT,
  };
}

export function user(fields: {
  id: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
  updatedAt?: string;
}) {
  return {
    object: 'user' as const,
    id: fields.id,
    email: fields.email ?? `${fields.id}@example.com`,
    emailVerified: true,
    profilePictureUrl: fields.profilePictureUrl ?? null,
    firstName: fields.firstName ?? null,
    lastName: fields.lastName ?? null,
    lastSignInAt: null,
    locale: null,
    createdAt: AT,
    updatedAt: fields.updatedAt ?? AT,
    externalId: null,
    metadata: {},
  };
}

/** The JSON WorkOS POSTs for a membership event (snake_case, as signed). */
export function wireMembershipEvent(
  name: 'organization_membership.created' | 'organization_membership.updated' | 'organization_membership.deleted',
  id: string,
  fields: { id: string; organizationId: string; userId: string; organizationName?: string; role?: string; status?: string; updatedAt?: string }
) {
  return {
    id,
    event: name,
    created_at: AT,
    data: {
      object: 'organization_membership',
      id: fields.id,
      organization_id: fields.organizationId,
      organization_name: fields.organizationName ?? '',
      user_id: fields.userId,
      status: fields.status ?? 'active',
      role: { slug: fields.role ?? 'member' },
      created_at: AT,
      updated_at: fields.updatedAt ?? AT,
    },
  };
}

/** The JSON WorkOS POSTs for user.updated (snake_case, as signed). */
export function wireUserUpdatedEvent(
  id: string,
  fields: { id: string; email: string; firstName?: string | null; lastName?: string | null; profilePictureUrl?: string | null; updatedAt?: string }
) {
  return {
    id,
    event: 'user.updated',
    created_at: AT,
    data: {
      object: 'user',
      id: fields.id,
      email: fields.email,
      email_verified: true,
      first_name: fields.firstName ?? null,
      last_name: fields.lastName ?? null,
      profile_picture_url: fields.profilePictureUrl ?? null,
      last_sign_in_at: null,
      locale: null,
      created_at: AT,
      updated_at: fields.updatedAt ?? AT,
    },
  };
}
