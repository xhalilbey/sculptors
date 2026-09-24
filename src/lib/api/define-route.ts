import 'server-only';

import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { z, ZodError } from 'zod';
import { readJsonBody } from '@/lib/api/read-json-body';
import { ensureOrganizationAccess } from '@/lib/auth/ensure-organization-access';
import { resolveSession, type SessionResolution } from '@/lib/auth/session';
import { formatErrorResponse } from '@/lib/error-handler';
import {
  isOrganizationId,
  parseOrganizationId,
  parseUserId,
  type OrganizationId,
  type UserId,
} from '@/lib/identity';
import { logger } from '@/lib/logger';
import { requireSameOrigin } from '@/lib/security/request-guards';
import { runResourceCheck, type ResourceCheck } from '@/lib/tenancy/resource-check';
import type { AppAuthUser, SessionOrganization } from '@/lib/workos/auth';
import { setWorkOSSessionCookie, WORKOS_SESSION_COOKIE } from '@/lib/workos/auth';
import { AppError, ValidationError } from '@/types/errors';

/**
 * Route definition wrapper.
 *
 * Every route handler in this codebase repeats the same preamble: origin check,
 * session lookup, active-user check, organization authorization, input parsing,
 * error mapping, session-refresh cookie. Before this existed, `requireSameOrigin`
 * was present on 27 of 55 routes and absent on 28, the organization access
 * check was sometimes called without the session's organization (silently
 * skipping the tenant check), and `refreshedSessionData` was dropped on about half the routes.
 *
 * The design decision that matters: `authz` is REQUIRED and has no default.
 * Authorization is the one step that cannot be made generic — it depends on
 * which resource the route touches — so the wrapper forces every route to state
 * it. A route that only reads rows scoped to the session organization says so
 * explicitly; a route that accepts a caller-supplied id must supply a
 * ResourceCheck (lib/tenancy/resource-check.ts), which runs inside withTenant.
 *
 * Unauthenticated routes use `definePublicRoute`, which requires a written
 * justification so they can be found with a grep.
 *
 * Handlers never receive a database handle. They get `ctx.tenant`, whose
 * branded OrganizationId is what withTenant (src/db/tenant.ts) accepts, and
 * they call services; the ESLint boundary keeps src/db out of app/.
 */

const ORIGIN_EXEMPT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * An incoming x-request-id is kept only when it looks like one: it is echoed
 * in a header and written to every log line, so a caller must not be able
 * to put arbitrary text (newlines, a forged trace) in either.
 */
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/** How each way a session can fail to resolve is answered. */
const SESSION_REFUSALS: Record<Exclude<SessionResolution['kind'], 'ok'>, { status: number; error: string }> = {
  none: { status: 401, error: 'Unauthorized. Please log in.' },
  expired: { status: 401, error: 'Session expired. Please sign in again.' },
  // No organization to bind to: a sign-in creates or finds one.
  unbound: { status: 401, error: 'Session expired. Please sign in again.' },
  inactive: { status: 403, error: 'Account is not active.' },
  forbidden: { status: 403, error: 'This WorkOS account is not allowed to sign in to Sculptors.' },
};

/** Envelope shape. The codebase has two; routes keep the one they already emit. */
export type Envelope = 'error' | 'success';

/** The organization this request was authorized against, and the caller's place in it. */
export interface TenantContext {
  organizationId: OrganizationId;
  userId: UserId;
  role: 'owner' | 'member';
}

export interface RouteContext {
  user: AppAuthUser;
  /** The caller's active organization (the one the session is bound to). */
  organization: SessionOrganization;
  /** Every organization the caller belongs to, active one included. */
  organizations: SessionOrganization[];
  /**
   * The authorized organization. For `session-organization` and `resource`
   * it is the session's; for `explicit-organization` it is the one the
   * caller named, after its membership was verified.
   */
  tenant: TenantContext;
  /**
   * The sealed session this request is authenticated with (the re-issued one
   * when WorkOS refreshed it). Only for handlers that ask WorkOS to re-issue
   * it again, such as switching organization; never echo it.
   */
  sessionData: string;
  requestId: string;
}

export interface PublicRouteContext {
  requestId: string;
  /** Public routes authenticate themselves (a webhook reads its signature header). */
  headers: Headers;
}

export interface RouteInput<TParams, TQuery, TBody> {
  params: TParams;
  query: TQuery;
  body: TBody;
}

export type Authz<TParams, TQuery, TBody> =
  /** Touches only rows of the session's organization; no caller-supplied ids reach a query. */
  | { kind: 'session-organization' }
  /**
   * The caller names an organization (path or body) -- the identity routes
   * that rename or switch to one. Authorized by an active membership of THAT
   * organization in the mirror; it may differ from the session's. The
   * mirror can lag WorkOS, so a handler that acts on `tenant.role` must
   * confirm it with WorkOS (isOwnerInWorkOS) or leave the decision to WorkOS.
   */
  | {
      kind: 'explicit-organization';
      organizationId: (input: RouteInput<TParams, TQuery, TBody>) => string;
    }
  /**
   * The caller names a RESOURCE. `check` answers, for the session's tenant,
   * whether the id is visible there; `false` becomes a 404, so a missing id
   * and a foreign id are indistinguishable to the caller. It is a
   * ResourceCheck (lib/tenancy/resource-check.ts), which runs inside
   * withTenant, so RLS decides what it can see.
   */
  | {
      kind: 'resource';
      check: ResourceCheck<RouteInput<TParams, TQuery, TBody>>;
    };

type DefaultParams = Record<string, never>;
type DefaultQuery = Record<string, never>;
type DefaultBody = undefined;

type IsExactly<T, D> = [T] extends [D] ? ([D] extends [T] ? true : false) : false;

/**
 * A schema is REQUIRED for every input whose type is not the default. Without
 * this, `defineRoute<{ id: string }>({ ... })` compiled with no params schema
 * and handed the handler an unvalidated segment typed as validated. (One
 * conditional type per input rather than overloads: three independent
 * inputs would need eight overloads.)
 */
type SchemaField<K extends 'params' | 'query' | 'body', T, D> =
  IsExactly<T, D> extends true ? { [P in K]?: ZodType<T> } : { [P in K]: ZodType<T> };

type BaseConfig<TParams, TQuery, TBody> = SchemaField<'params', TParams, DefaultParams> &
  SchemaField<'query', TQuery, DefaultQuery> &
  SchemaField<'body', TBody, DefaultBody> & {
    envelope?: Envelope;
  };

/** What parseInput reads the schemas from, whichever of them are required. */
type InputSchemas<TParams, TQuery, TBody> = {
  params?: ZodType<TParams>;
  query?: ZodType<TQuery>;
  body?: ZodType<TBody>;
};

type SegmentContext = { params: Promise<Record<string, string | string[]>> };

function requestIdOf(request: NextRequest): string {
  const incoming = request.headers.get('x-request-id');

  return incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

/**
 * Cloud Run passes the load balancer's trace as X-Cloud-Trace-Context
 * ("TRACE_ID/SPAN_ID;o=1"). Logged under the key Cloud Logging reads, a
 * route's log lines group under the request in the trace viewer.
 */
function traceOf(request: NextRequest): Record<string, string> {
  const header = request.headers.get('x-cloud-trace-context');
  const traceId = header?.split('/')[0];

  if (!traceId || !/^[0-9a-f]{1,64}$/i.test(traceId)) return {};

  const project = process.env.GOOGLE_CLOUD_PROJECT;

  return { 'logging.googleapis.com/trace': project ? `projects/${project}/traces/${traceId}` : traceId };
}

function fail(
  envelope: Envelope,
  message: string,
  status: number,
  fields?: Record<string, string[]>
) {
  const base = envelope === 'success' ? { success: false, error: message } : { error: message };

  return NextResponse.json(fields ? { ...base, fields } : base, { status });
}

/**
 * The one exit of both wrappers: every response carries the request id, and
 * a session WorkOS re-issued while authenticating is stored on every
 * response -- error responses included, or a refresh that preceded a 403 or
 * a 500 was lost and the browser kept replaying the spent refresh token. A
 * handler that re-issued the session itself (an organization switch) has set
 * the newer cookie, which wins.
 *
 * Every answer is also marked `private, no-store`. Until 24 Sep seven data
 * handlers set `no-store` by hand and nothing else did, so the answers this
 * wrapper built (a 401, a 404, a 500, a plain object) carried no cache
 * directive, though any of them could carry the re-issued session cookie.
 * A handler that states its own Cache-Control keeps it, unless the answer
 * carries the session cookie: a cache that stored that Set-Cookie would
 * hand the session to whoever it served next.
 */
function finish(response: NextResponse, requestId: string, refreshedSessionData?: string): NextResponse {
  response.headers.set('x-request-id', requestId);

  if (refreshedSessionData && !response.cookies.get(WORKOS_SESSION_COOKIE)) {
    setWorkOSSessionCookie(response, refreshedSessionData);
  }

  if (response.cookies.get(WORKOS_SESSION_COOKIE) || !response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', 'private, no-store');
  }

  return response;
}

async function parseInput<TParams, TQuery, TBody>(
  config: InputSchemas<TParams, TQuery, TBody>,
  request: NextRequest,
  segment: SegmentContext | undefined
): Promise<RouteInput<TParams, TQuery, TBody>> {
  const rawParams = segment ? await segment.params : {};
  const rawQuery = Object.fromEntries(request.nextUrl.searchParams.entries());
  const rawBody = config.body ? await readJsonBody(request) : undefined;

  // The casts are the "no schema" branch, which the config type allows only
  // when the input's type is its default (an empty record, or no body).
  return {
    params: config.params ? config.params.parse(rawParams) : (rawParams as TParams),
    query: config.query ? config.query.parse(rawQuery) : (rawQuery as TQuery),
    body: config.body ? config.body.parse(rawBody) : (undefined as TBody),
  };
}

function toResponse(result: unknown): NextResponse {
  if (result instanceof NextResponse) {
    return result;
  }

  // A plain Response (streaming, a redirect built with Response.redirect)
  // is rewrapped so the exit helper can use NextResponse's cookie jar.
  if (result instanceof Response) {
    return new NextResponse(result.body, result);
  }

  return NextResponse.json(result ?? { success: true });
}

function handleError(
  error: unknown,
  envelope: Envelope,
  requestId: string,
  trace: Record<string, string>
): NextResponse {
  if (error instanceof ZodError) {
    logger.warn('Route input validation failed', { requestId, ...trace, issues: error.issues });

    // Field errors describe the caller's own input, so returning them leaks
    // nothing and keeps the messages as specific as the hand-rolled checks were.
    const { fieldErrors } = z.flattenError(error);

    return fail(envelope, 'Invalid request', 400, fieldErrors as Record<string, string[]>);
  }

  const err = error instanceof Error ? error : new Error(String(error));
  const status = err instanceof AppError && err.statusCode ? err.statusCode : 500;

  if (status >= 500) {
    logger.error('Unhandled route error', err, { requestId, ...trace });
  } else {
    logger.warn('Route error', { requestId, ...trace, status, reason: err.message });
  }

  // formatErrorResponse sanitizes the message; raw error text never reaches the client.
  return fail(envelope, formatErrorResponse(err).error, status);
}

/**
 * Authenticated route. Runs, in fixed order:
 * requestId -> origin (non-GET) -> session (resolveSession: expired, inactive,
 * forbidden and unbound stop here) -> input parsing -> organization
 * authorization -> resource check -> handler -> error mapping -> one exit
 * (request id, refreshed session cookie, `Cache-Control: private, no-store`).
 */
export function defineRoute<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
>(
  config: BaseConfig<TParams, TQuery, TBody> & {
    authz: Authz<TParams, TQuery, TBody>;
    handler: (
      input: RouteInput<TParams, TQuery, TBody>,
      ctx: RouteContext
    ) => Promise<unknown>;
  }
) {
  return async function route(
    request: NextRequest,
    segment?: SegmentContext
  ): Promise<NextResponse> {
    const envelope = config.envelope ?? 'error';
    const requestId = requestIdOf(request);
    const trace = traceOf(request);
    let refreshedSessionData: string | undefined;

    try {
      if (!ORIGIN_EXEMPT_METHODS.has(request.method.toUpperCase())) {
        const originError = requireSameOrigin(request);

        if (originError) {
          return finish(originError, requestId);
        }
      }

      const cookie = request.cookies.get(WORKOS_SESSION_COOKIE)?.value;
      // A route handler can store a re-issued cookie, so it may refresh an
      // expired session and rebind an unbound one.
      const session = await resolveSession(cookie, { refresh: true });

      if (session.kind !== 'ok') {
        const refused = SESSION_REFUSALS[session.kind];

        return finish(fail(envelope, refused.error, refused.status), requestId);
      }

      refreshedSessionData = session.refreshedSessionData;

      const input = await parseInput(config, request, segment);

      let organizationId: string;
      let role: 'owner' | 'member';

      if (config.authz.kind === 'explicit-organization') {
        organizationId = config.authz.organizationId(input);

        if (!isOrganizationId(organizationId)) {
          throw new ValidationError('Invalid organization id');
        }

        // Naming an organization other than the session's is the point of
        // these routes. The membership of the named one is the whole check.
        const access = await ensureOrganizationAccess(organizationId, session.user.id);

        if (!access.authorized) {
          return finish(fail(envelope, access.error, access.status), requestId, refreshedSessionData);
        }

        role = access.role;
      } else {
        // The organization WorkOS bound the sealed session to, which
        // resolveSession matched against an active membership in the mirror;
        // the role comes with it, no second query.
        organizationId = session.organization.id;
        role = session.role;
      }

      const tenant: TenantContext = {
        organizationId: parseOrganizationId(organizationId),
        userId: parseUserId(session.user.id),
        role,
      };

      if (
        config.authz.kind === 'resource' &&
        !(await runResourceCheck(config.authz.check, input, tenant.organizationId))
      ) {
        // Deliberately the same response as "exists but belongs to someone
        // else" — a 403 here would confirm the id exists.
        return finish(fail(envelope, 'Not found', 404), requestId, refreshedSessionData);
      }

      const sessionData = refreshedSessionData ?? cookie;

      if (!sessionData) {
        return finish(fail(envelope, 'Session missing', 401), requestId);
      }

      const result = await config.handler(input, {
        user: session.user,
        organization: session.organization,
        organizations: session.organizations,
        tenant,
        sessionData,
        requestId,
      });

      return finish(toResponse(result), requestId, refreshedSessionData);
    } catch (error) {
      return finish(handleError(error, envelope, requestId, trace), requestId, refreshedSessionData);
    }
  };
}

/**
 * Deliberately unauthenticated route. `justification` is required so every
 * public endpoint carries a written reason and the set can be audited with
 * `grep -rn definePublicRoute src/app/api`.
 */
export function definePublicRoute<
  TParams = DefaultParams,
  TQuery = DefaultQuery,
  TBody = DefaultBody,
>(
  config: BaseConfig<TParams, TQuery, TBody> & {
    justification: string;
    handler: (
      input: RouteInput<TParams, TQuery, TBody>,
      ctx: PublicRouteContext
    ) => Promise<unknown>;
  }
) {
  return async function publicRoute(
    request: NextRequest,
    segment?: SegmentContext
  ): Promise<NextResponse> {
    const envelope = config.envelope ?? 'error';
    const requestId = requestIdOf(request);

    try {
      const input = await parseInput(config, request, segment);
      const result = await config.handler(input, { requestId, headers: request.headers });

      return finish(toResponse(result), requestId);
    } catch (error) {
      return finish(handleError(error, envelope, requestId, traceOf(request)), requestId);
    }
  };
}
