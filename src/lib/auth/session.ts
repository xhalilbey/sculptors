import 'server-only';

import { AuthenticateWithSessionCookieFailureReason, RefreshSessionFailureReason } from '@workos-inc/node';
import {
  identityDb,
  membershipsRepository,
  usersRepository,
  withIdentityReadTransaction,
} from '@/lib/identity';
import { logger } from '@/lib/logger';
import {
  getWorkOSClient,
  getWorkOSEnv,
  isAllowedWorkOSUser,
  refreshSessionForOrganization,
  toAppUser,
  toSessionOrganization,
  type AppAuthUser,
  type SessionOrganization,
} from '@/lib/workos/auth';

/**
 * Who is this request, from the sealed WorkOS session and the mirror.
 *
 * Read-only by design. Sign-in (lib/auth/sign-in.ts) is where the user is
 * upserted, memberships are synced from WorkOS and a first organization is
 * created; here nothing is, so a GET or a layout never writes the mirror or
 * calls WorkOS's API beyond the session itself, and a suspension written to
 * the mirror is not undone by the next request. The one write is
 * last_seen_at, at most every 15 minutes (usersRepository.touchLastSeen).
 *
 * Refreshing is a choice of the caller. A route handler can store a
 * re-issued cookie, so it passes `refresh: true`; a Server Component cannot,
 * so it must not rotate the refresh token it would then lose.
 *
 * Failures of WorkOS or the database are thrown, never mapped to "signed
 * out": a transient error must not cost the user their session.
 */

export type SessionResolution =
  | {
      kind: 'ok';
      user: AppAuthUser;
      /** The organization the session is bound to. */
      organization: SessionOrganization;
      /** Every active organization of the user, oldest membership first. */
      organizations: SessionOrganization[];
      role: 'owner' | 'member';
      /** Set when WorkOS re-issued the session; the caller must store it. */
      refreshedSessionData?: string;
    }
  /**
   * The cookie cannot be used. `cookieInvalid` is true only when it can never
   * work again (it does not unseal, or WorkOS refused the refresh token), so
   * clearing it is safe; otherwise it may just need a refresh the caller
   * could not do.
   */
  | { kind: 'expired'; cookieInvalid: boolean }
  /** No active membership matches the session's organization, and it was not rebound. */
  | { kind: 'unbound' }
  /** The user's row is not 'active'. */
  | { kind: 'inactive' }
  /** Outside the sign-in allowlist. */
  | { kind: 'forbidden' }
  /** No session cookie at all. */
  | { kind: 'none' };

type SessionClaims = {
  workosUserId: string;
  organizationId: string | null;
  refreshedSessionData?: string;
};

async function authenticate(
  sessionData: string,
  refresh: boolean
): Promise<SessionClaims | { kind: 'expired'; cookieInvalid: boolean }> {
  const { cookiePassword } = getWorkOSEnv();
  const session = getWorkOSClient().userManagement.loadSealedSession({ sessionData, cookiePassword });
  const result = await session.authenticate();

  if (result.authenticated) {
    return { workosUserId: result.user.id, organizationId: result.organizationId ?? null };
  }

  // Only an expired access token is worth a refresh; a cookie that does not
  // unseal never will.
  if (result.reason !== AuthenticateWithSessionCookieFailureReason.INVALID_JWT) {
    return { kind: 'expired', cookieInvalid: true };
  }

  if (!refresh) {
    return { kind: 'expired', cookieInvalid: false };
  }

  const refreshed = await session.refresh();

  if (!refreshed.authenticated || !refreshed.sealedSession) {
    const reason = refreshed.authenticated ? undefined : refreshed.reason;

    return {
      kind: 'expired',
      cookieInvalid:
        reason === RefreshSessionFailureReason.INVALID_GRANT ||
        reason === RefreshSessionFailureReason.INVALID_SESSION_COOKIE,
    };
  }

  return {
    workosUserId: refreshed.user.id,
    organizationId: refreshed.organizationId ?? null,
    refreshedSessionData: refreshed.sealedSession,
  };
}

export async function resolveSession(
  sessionData: string | undefined,
  options: { refresh: boolean }
): Promise<SessionResolution> {
  if (!sessionData) return { kind: 'none' };

  const claims = await authenticate(sessionData, options.refresh);

  if ('kind' in claims) return claims;

  if (!isAllowedWorkOSUser(claims.workosUserId)) return { kind: 'forbidden' };

  const snapshot = await withIdentityReadTransaction(async (tx) => {
    const user = await usersRepository.findByWorkOSUserId(tx, claims.workosUserId);

    if (!user || user.status !== 'active') return { user, memberships: [] };

    return { user, memberships: await membershipsRepository.listActiveForUser(tx, user.id) };
  });

  // A session for a user the mirror has never seen predates it (or the row
  // was removed by hand): only a sign-in creates the row.
  if (!snapshot.user) return { kind: 'expired', cookieInvalid: false };
  if (snapshot.user.status !== 'active') return { kind: 'inactive' };

  const { user, memberships } = snapshot;

  try {
    await usersRepository.touchLastSeen(identityDb(), user.id);
  } catch (error) {
    // Activity is bookkeeping; a failed write must not fail the request.
    logger.warn('Failed to record last_seen_at', { error, userId: user.id });
  }

  const organizations = memberships.map((membership, index) => toSessionOrganization(membership, index === 0));
  let organization = organizations.find((candidate) => candidate.id === claims.organizationId);
  let refreshedSessionData = claims.refreshedSessionData;

  if (!organization) {
    const [first] = organizations;

    // Bound to an organization the user has left (or never bound): only a
    // caller that can store the re-issued cookie may rebind, and only to an
    // organization the user is in. WorkOS refuses anything else.
    if (!options.refresh || !first) return { kind: 'unbound' };

    const rebound = await refreshSessionForOrganization(refreshedSessionData ?? sessionData, first.id);

    organization = first;
    refreshedSessionData = rebound.sealedSession;
  }

  return {
    kind: 'ok',
    user: toAppUser(user),
    organization,
    organizations,
    role: organization.role,
    refreshedSessionData,
  };
}
