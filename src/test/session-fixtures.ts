/**
 * A resolved session as lib/auth/session.ts hands it to routes, for route
 * tests that mock the session layer. Dates are Dates: the DTO mapper turns them
 * into ISO strings, which is part of what the tests check.
 */

export const USER_ID = '6f1c1a4e-2b1d-4c6a-9f0e-0a1b2c3d4e5f';

export function sessionOrganization(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Name of ${id}`,
    onboardingCompletedAt: new Date('2026-09-02T00:00:00Z'),
    createdAt: new Date('2026-09-01T00:00:00Z'),
    role: 'owner' as const,
    isDefault: false,
    memberCount: 3,
    ...overrides,
  };
}

/** A session lib/auth/session.ts resolved: the first organization is the one it is bound to. */
export function okSession(organizations = [sessionOrganization('org_A', { isDefault: true })]) {
  const [active] = organizations;

  if (!active) throw new Error('okSession needs at least one organization');

  return {
    kind: 'ok' as const,
    user: {
      id: USER_ID,
      workosUserId: 'user_w1',
      email: 'ada@example.com',
      firstName: 'Ada' as string | null,
      lastName: 'Lovelace' as string | null,
      avatarUrl: null as string | null,
      status: 'active',
    },
    organization: active,
    organizations,
    role: active.role,
    refreshedSessionData: undefined as string | undefined,
  };
}

/** The exact key set of an OrganizationDto. */
export const ORGANIZATION_DTO_KEYS = ['createdAt', 'id', 'isActive', 'name', 'onboardingCompletedAt', 'role'];

/** Keys of the old v1 shapes that must never reach the wire again. */
export const RETIRED_KEYS = ['workos', 'user_metadata', 'tenant_id', 'member_count', 'memberCount'];

export function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value === null || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, nested]) => [key, ...allKeys(nested)]);
}
