import 'server-only';

import { AuthenticationException, type AuthenticationResponse } from '@workos-inc/node';
import { logger } from '@/lib/logger';
import { clientIpFrom } from '@/lib/security/client-ip';
import {
  AccountInactiveError,
  establishSignInSession,
  getWorkOSClient,
  getWorkOSEnv,
  WorkOSAccountForbiddenError,
} from '@/lib/workos/auth';

/**
 * Completing a sign-in, whichever way it started (password, emailed code,
 * the AuthKit callback). The routes parse their input, call this with the
 * WorkOS call that authenticates, and turn the result into their response;
 * everything between -- WorkOS's error codes, organization selection, the
 * allowlist, the mirror sync, binding the session to an organization -- is
 * here, once. Before this, three routes each had their own copy, one of them
 * found the pending token by walking the error object and sniffing its
 * message.
 *
 * WorkOS refusing the attempt (a 4xx) and something of ours failing after
 * WorkOS said yes are different answers: 'rejected' is the user's to fix,
 * 'unavailable' (a 503) is ours.
 */

export type SignInRejection = 'invalid_credentials' | 'mfa_required' | 'sso_required' | 'invalid_code';

export type SignInResult =
  | { kind: 'signed-in'; sealedSession: string }
  | { kind: 'verify-email'; pendingAuthenticationToken: string | null }
  | { kind: 'rejected'; reason: SignInRejection }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' };

export interface SignInContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/** What a plain WorkOS refusal means for the step being completed. */
type InvalidReason = Extract<SignInRejection, 'invalid_credentials' | 'invalid_code'>;

/**
 * The options every WorkOS authenticate call takes here: our client, a
 * sealed session, and the caller's address and agent for WorkOS's own
 * checks. Routes spread it into the call they make.
 */
export function signInOptions(ctx: SignInContext) {
  const { clientId, cookiePassword } = getWorkOSEnv();

  return {
    clientId,
    ...(ctx.ipAddress ? { ipAddress: ctx.ipAddress } : {}),
    ...(ctx.userAgent ? { userAgent: ctx.userAgent } : {}),
    session: { sealSession: true, cookiePassword },
  };
}

/**
 * WorkOS asks which organization to sign into when the user belongs to
 * several and none was chosen. We take the first it lists; the switcher in
 * the app is where the user picks another. No session leaves unbound.
 */
export function firstListedOrganizationId(error: AuthenticationException): string | null {
  return error.rawData.organizations?.[0]?.id ?? null;
}

/** The HTTP status of a WorkOS API error, when the thrown value is one. */
function workosStatus(error: unknown): number | null {
  return error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : null;
}

/** A WorkOS 4xx other than rate limiting: the attempt itself was refused. */
function isRefusal(error: unknown): boolean {
  const status = workosStatus(error);

  return status !== null && status >= 400 && status < 500 && status !== 429;
}

function describe(error: unknown) {
  return {
    errorType: error instanceof Error ? error.name : 'UnknownError',
    status: workosStatus(error),
    code: error instanceof AuthenticationException ? error.code : undefined,
  };
}

async function authenticateOrExplain(
  authenticate: () => Promise<AuthenticationResponse>,
  ctx: SignInContext,
  invalid: InvalidReason
): Promise<AuthenticationResponse | Exclude<SignInResult, { kind: 'signed-in' }>> {
  try {
    return await authenticate();
  } catch (error) {
    if (error instanceof AuthenticationException) {
      switch (error.code) {
        case 'organization_selection_required': {
          const organizationId = firstListedOrganizationId(error);
          const pendingAuthenticationToken = error.pendingAuthenticationToken;

          if (!organizationId || !pendingAuthenticationToken) {
            logger.warn('WorkOS asked for an organization but listed none', describe(error));

            return { kind: 'rejected', reason: invalid };
          }

          // One level only: a selection that itself needs something else is
          // explained, not followed again.
          return authenticateOrExplain(
            () =>
              getWorkOSClient().userManagement.authenticateWithOrganizationSelection({
                ...signInOptions(ctx),
                organizationId,
                pendingAuthenticationToken,
              }),
            ctx,
            invalid
          ).then((result) =>
            'kind' in result && result.kind === 'verify-email' ? { kind: 'rejected', reason: invalid } : result
          );
        }

        case 'email_verification_required':
          return { kind: 'verify-email', pendingAuthenticationToken: error.pendingAuthenticationToken ?? null };

        case 'mfa_enrollment':
        case 'mfa_challenge':
        case 'mfa_verification':
          return { kind: 'rejected', reason: 'mfa_required' };

        case 'sso_required':
          return { kind: 'rejected', reason: 'sso_required' };
      }
    }

    logger.warn('WorkOS sign-in attempt failed', describe(error));

    return isRefusal(error) ? { kind: 'rejected', reason: invalid } : { kind: 'unavailable' };
  }
}

/**
 * Authenticate with WorkOS, then establish the session: allowlist, mirror
 * the user (refusing one whose row is not active) and their memberships
 * from WorkOS (a sign-in takes the authoritative list), and bind the session
 * to an organization if WorkOS issued it unbound. The sealed session to
 * store is the bound one. This is the only path that writes the mirror on
 * behalf of a session; per-request resolution (lib/auth/session.ts) reads.
 */
export async function completeSignIn(
  authenticate: () => Promise<AuthenticationResponse>,
  ctx: SignInContext,
  options: { invalid: InvalidReason } = { invalid: 'invalid_credentials' }
): Promise<SignInResult> {
  const outcome = await authenticateOrExplain(authenticate, ctx, options.invalid);

  if ('kind' in outcome) {
    return outcome;
  }

  if (!outcome.sealedSession) {
    logger.error('WorkOS authentication returned no sealed session');

    return { kind: 'unavailable' };
  }

  try {
    const established = await establishSignInSession(outcome.user, {
      organizationId: outcome.organizationId ?? null,
      sessionData: outcome.sealedSession,
    });

    return { kind: 'signed-in', sealedSession: established.refreshedSessionData ?? outcome.sealedSession };
  } catch (error) {
    // Outside the allowlist, or a row that is not active (suspended here,
    // deleted in WorkOS): no cookie either way.
    if (error instanceof WorkOSAccountForbiddenError || error instanceof AccountInactiveError) {
      return { kind: 'forbidden' };
    }

    logger.error('Sign-in succeeded at WorkOS but the session could not be established', describe(error));

    return { kind: 'unavailable' };
  }
}

/**
 * The caller's address and agent, as WorkOS wants them for its own checks.
 * The address is the one our edge appended (clientIpFrom), the same one the
 * rate limiter keys on; before 24 Sep this sent the leftmost X-Forwarded-For
 * entry, which the caller writes.
 */
export function signInContextFrom(headers: Headers): SignInContext {
  return {
    ipAddress: clientIpFrom(headers),
    userAgent: headers.get('user-agent') || null,
  };
}
