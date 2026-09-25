import 'server-only';

import {
  identityDb,
  usersRepository,
  type OrganizationId,
  type UserId,
  type UserRow,
} from '@/lib/identity';
import { logger } from '@/lib/logger';
import { getWorkOSClient, getWorkOSEnv } from './client';
import { displayNameOf } from './dto';
import {
  createOrganizationForUser,
  isOwnerRole,
  listMirroredMemberships,
  listWorkOSMemberships,
  syncMembershipsForUser,
  type MirroredMembership,
} from './organizations';

export { getWorkOSClient, getWorkOSEnv } from './client';
export { clearWorkOSSessionCookie, setWorkOSSessionCookie } from './cookies';
export { WORKOS_SESSION_COOKIE } from './constants';

/*
 * Sessions and organizations, v2.
 *
 * The active tenant is the organization the WorkOS session was issued for.
 * That is the whole design: the sealed cookie WorkOS gives us carries an
 * organizationId, switching organizations means asking WorkOS to re-issue
 * the session for another one (session.refresh({ organizationId })), and
 * WorkOS refuses an organization the user is not a member of. There is no
 * separate "active tenant" cookie any more. v1 had one, which meant the
 * tenant a request ran under was a mutable client cookie validated by our
 * own lookup; now it is inside the encrypted session and validated by the
 * identity provider.
 *
 * Two paths use this module, and only the first writes:
 *   - SIGN-IN (lib/auth/sign-in.ts -> establishSignInSession): apply the
 *     allowlist, upsert the user, refuse one that is not active, mirror
 *     their memberships from WorkOS, create a first organization in WorkOS
 *     if they have none, and bind the session to an organization.
 *   - EVERY OTHER REQUEST (lib/auth/session.ts -> resolveSession): read the
 *     sealed session and the mirror. No upsert, no WorkOS listing, no
 *     organization creation; only a throttled last_seen_at.
 * A suspension written to the mirror therefore sticks: nothing on the
 * request path sets a user back to active.
 */

/** The signed-in user, as the server holds it. The wire shape is SessionUserDto (lib/workos/dto.ts). */
export interface AppAuthUser {
  /** Our users.id, branded as the row carries it; the WorkOS id is workosUserId. */
  id: UserId;
  workosUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  status: string;
}

/**
 * An organization of the session's user, as the server holds it. Routes
 * turn it into an OrganizationDto (lib/workos/dto.ts); nothing sends it as
 * it is.
 */
export interface SessionOrganization {
  id: OrganizationId;
  name: string;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  /** 'owner' when the WorkOS role is the admin slug. */
  role: 'owner' | 'member';
  /** The user's first organization (oldest membership); the switcher lists it first. */
  isDefault: boolean;
}

export type WorkOSUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
  /** ISO time of the WorkOS state this snapshot carries; orders the mirror write. */
  updatedAt?: string;
};

/**
 * Accounts allowed to sign in.
 *
 * Reads `SCULPTORS_ALLOWED_WORKOS_USER_IDS` (comma-separated) and still
 * honours the original `SCULPTORS_OWNER_WORKOS_USER_ID`. An empty or unset
 * value denies everyone: the gate fails closed.
 */
export function getAllowedWorkOSUserIds(): string[] {
  const raw = [
    process.env.SCULPTORS_ALLOWED_WORKOS_USER_IDS,
    process.env.SCULPTORS_OWNER_WORKOS_USER_ID,
  ]
    .filter((value): value is string => Boolean(value))
    .join(',');

  return Array.from(new Set(raw.split(',').map((value) => value.trim()).filter(Boolean)));
}

/**
 * Whether the account may sign in. Asked at sign-in and again on every
 * request (lib/auth/session.ts), so a user taken off the list is out at once.
 */
export function isAllowedWorkOSUser(workosUserId: string) {
  const allowed = getAllowedWorkOSUserIds();

  return allowed.length > 0 && allowed.includes(workosUserId);
}

export class WorkOSAccountForbiddenError extends Error {
  constructor() {
    super('This WorkOS account is not allowed to sign in to Sculptors.');
    this.name = 'WorkOSAccountForbiddenError';
  }
}

/**
 * The user's row is not 'active' (suspended by us, or deleted in WorkOS).
 * Signing in again does not reactivate it: status is ours, and only a
 * deliberate change to the row does.
 */
export class AccountInactiveError extends Error {
  constructor(readonly status: string) {
    super('This account is not active.');
    this.name = 'AccountInactiveError';
  }
}

export function toAppUser(row: Pick<UserRow, 'id' | 'workosUserId' | 'email' | 'firstName' | 'lastName' | 'avatarUrl' | 'status'>): AppAuthUser {
  return {
    id: row.id,
    workosUserId: row.workosUserId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: row.avatarUrl,
    status: row.status,
  };
}

export function toSessionOrganization(membership: MirroredMembership, isDefault: boolean): SessionOrganization {
  const organization = membership.organization;

  return {
    id: organization.id,
    name: organization.name,
    onboardingCompletedAt: organization.onboardingCompletedAt,
    createdAt: organization.createdAt,
    role: isOwnerRole(membership.role) ? 'owner' : 'member',
    isDefault,
  };
}

async function upsertUser(user: WorkOSUser): Promise<UserRow> {
  try {
    return await usersRepository.upsertFromWorkOS(identityDb(), {
      workosUserId: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      avatarUrl: user.profilePictureUrl ?? null,
      workosUpdatedAt: user.updatedAt ? new Date(user.updatedAt) : null,
    });
  } catch (error) {
    logger.error('Failed to sync WorkOS user', { error });
    throw new Error('Failed to sync authenticated user');
  }
}

/**
 * A first organization's name: "<display name>'s Organization", the display
 * name cut so the whole stays within the 100 code points a name may have.
 * A long display name used to give WorkOS a name the mirror refused.
 */
function defaultOrganizationName(user: WorkOSUser): string {
  const suffix = "'s Organization";
  const owner = Array.from(
    displayNameOf({ email: user.email, firstName: user.firstName ?? null, lastName: user.lastName ?? null })
  )
    .slice(0, 100 - suffix.length)
    .join('')
    .trimEnd();

  return `${owner}${suffix}`;
}

/**
 * The user's organizations, from WorkOS (the authoritative list, taken at
 * every sign-in), mirrored, and guaranteed to be at least one.
 */
async function loadOrganizations(input: {
  userId: UserRow['id'];
  workosUser: WorkOSUser;
}): Promise<MirroredMembership[]> {
  const { userId, workosUser } = input;
  // Taken before the request: the list reflects WorkOS at least this late.
  const listedAt = new Date();
  const live = await listWorkOSMemberships(workosUser.id);
  let memberships = await syncMembershipsForUser({
    userId,
    workosUserId: workosUser.id,
    memberships: live,
    listedAt,
  });

  if (memberships.length === 0) {
    await createOrganizationForUser({
      name: defaultOrganizationName(workosUser),
      userId,
      workosUserId: workosUser.id,
    });
    memberships = await listMirroredMemberships(userId);
  }

  if (memberships.length === 0) {
    throw new Error('Failed to establish an organization for the user');
  }

  return memberships;
}

/**
 * Sign-in only (lib/auth/sign-in.ts): apply the allowlist, mirror the user
 * and their memberships, and bind the session to an organization the user
 * is actually in. `organizationId` is the one WorkOS issued the session for
 * (null when unbound) and `sessionData` that sealed session. Returns the
 * re-issued session when binding changed it, nothing when it was already
 * bound to one of theirs.
 *
 * This used to be buildSessionContext and also assembled the user, their
 * organizations and a block of WorkOS claims that its only caller threw
 * away; the request path builds those from the mirror (resolveSession).
 */
export async function establishSignInSession(
  user: WorkOSUser,
  options: { organizationId: string | null; sessionData: string }
): Promise<{ refreshedSessionData?: string }> {
  if (!isAllowedWorkOSUser(user.id)) {
    throw new WorkOSAccountForbiddenError();
  }

  const userRow = await upsertUser(user);

  // Before any WorkOS call: a suspended user gets no organization created
  // and no session bound.
  if (userRow.status !== 'active') {
    throw new AccountInactiveError(userRow.status);
  }

  const memberships = await loadOrganizations({
    userId: userRow.id,
    workosUser: user,
  });

  const [first] = memberships;

  // loadOrganizations guarantees one; the check is for the compiler's sake
  // and for anyone who changes that guarantee.
  if (!first) {
    throw new Error('Failed to establish an organization for the user');
  }

  if (memberships.some((m) => m.organizationId === options.organizationId)) {
    return {};
  }

  // The session is unbound (first sign-in) or bound to an organization the
  // user has since left. Bind it to their first organization; WorkOS
  // re-issues the session and is the one deciding whether that is allowed.
  const refreshed = await refreshSessionForOrganization(options.sessionData, first.organizationId);

  return { refreshedSessionData: refreshed.sealedSession };
}

/**
 * Ask WorkOS to re-issue the session for another organization. This is the
 * only way the active tenant changes, and WorkOS refuses an organization
 * the user is not a member of.
 */
export async function refreshSessionForOrganization(
  sessionData: string,
  organizationId: string
): Promise<{ sealedSession: string; organizationId: string | null; role: string | null }> {
  const { cookiePassword } = getWorkOSEnv();
  const session = getWorkOSClient().userManagement.loadSealedSession({
    sessionData,
    cookiePassword,
  });
  const refreshed = await session.refresh({ organizationId });

  if (!refreshed.authenticated || !refreshed.sealedSession) {
    throw new Error('WorkOS refused to switch organization');
  }

  return {
    sealedSession: refreshed.sealedSession,
    organizationId: refreshed.organizationId ?? null,
    role: refreshed.role ?? null,
  };
}
