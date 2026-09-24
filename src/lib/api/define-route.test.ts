import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type * as ResourceCheckModule from '@/lib/tenancy/resource-check';
import { okSession, sessionOrganization, USER_ID } from '@/test/session-fixtures';

/**
 * defineRoute decides which organization a request runs under. The tests
 * pin the directions that must fail: no session, a session that is not
 * usable (expired, inactive, outside the allowlist), a named organization the
 * caller is not in, a malformed id, a resource the tenant cannot see. And the
 * one subtle success: a handler that switched the session keeps its newer
 * cookie. Every answer, refusals included, is marked private and unstored.
 */

const resolveSession = vi.fn();
const ensureOrganizationAccess = vi.fn();
const runResourceCheck = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/auth', () => ({
  WORKOS_SESSION_COOKIE: 'wos-session',
  setWorkOSSessionCookie: (response: NextResponse, value: string) =>
    response.cookies.set({ name: 'wos-session', value, httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 60 }),
}));
vi.mock('@/lib/auth/session', () => ({ resolveSession }));
vi.mock('@/lib/auth/ensure-organization-access', () => ({ ensureOrganizationAccess }));
vi.mock('@/lib/tenancy/resource-check', async (importOriginal) => ({
  ...(await importOriginal<typeof ResourceCheckModule>()),
  runResourceCheck,
}));

const { defineRoute, definePublicRoute } = await import('./define-route');
const { MAX_BODY_BYTES } = await import('./read-json-body');
const { defineResourceCheck } = await import('@/lib/tenancy/resource-check');

function session(refreshed?: string) {
  return {
    ...okSession([sessionOrganization('org_A', { isDefault: true, role: 'member' }), sessionOrganization('org_B')]),
    refreshedSessionData: refreshed,
  };
}

function request(method = 'POST') {
  return new NextRequest('http://localhost:3000/api/x', {
    method,
    headers: { origin: 'http://localhost:3000', cookie: 'wos-session=sealed-old' },
  });
}

const idParams = z.object({ id: z.string() });

const segment = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  resolveSession.mockReset();
  ensureOrganizationAccess.mockReset();
  ensureOrganizationAccess.mockResolvedValue({ authorized: true, role: 'member' });
});

describe('defineRoute', () => {
  it.each([
    ['no session', { kind: 'none' }, 401],
    ['an expired session', { kind: 'expired', cookieInvalid: false }, 401],
    ['an unbound session', { kind: 'unbound' }, 401],
    ['an inactive user', { kind: 'inactive' }, 403],
    ['an account outside the allowlist', { kind: 'forbidden' }, 403],
  ])('answers %s without calling the handler', async (_case, resolution, status) => {
    resolveSession.mockResolvedValue(resolution);
    const handler = vi.fn();

    const response = await defineRoute({ authz: { kind: 'session-organization' }, handler })(request('GET'));

    expect(response.status).toBe(status);
    expect(handler).not.toHaveBeenCalled();
  });

  it('resolves the session with refresh allowed, from the cookie', async () => {
    resolveSession.mockResolvedValue(session());

    await defineRoute({ authz: { kind: 'session-organization' }, handler: vi.fn() })(request('GET'));

    expect(resolveSession).toHaveBeenCalledWith('sealed-old', { refresh: true });
  });

  it('runs a session-organization route under the resolved organization and role, with no second lookup', async () => {
    resolveSession.mockResolvedValue(session());
    const handler = vi.fn().mockResolvedValue({ ok: true });

    await defineRoute({ authz: { kind: 'session-organization' }, handler })(request());

    expect(ensureOrganizationAccess).not.toHaveBeenCalled();
    expect(handler.mock.calls[0]?.[1].tenant).toEqual({ organizationId: 'org_A', userId: USER_ID, role: 'member' });
  });

  it('authorizes an explicitly named organization by its own membership', async () => {
    resolveSession.mockResolvedValue(session());
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const route = defineRoute({
      params: idParams,
      authz: { kind: 'explicit-organization', organizationId: (input) => input.params.id },
      handler,
    });

    await route(request(), segment('org_B'));

    expect(ensureOrganizationAccess).toHaveBeenCalledWith('org_B', USER_ID);
    expect(handler.mock.calls[0]?.[1].tenant.organizationId).toBe('org_B');
  });

  it('refuses a named organization the caller is not in', async () => {
    resolveSession.mockResolvedValue(session());
    ensureOrganizationAccess.mockResolvedValue({ authorized: false, status: 403, error: 'You do not have access to this organization' });
    const handler = vi.fn();
    const route = defineRoute({
      params: idParams,
      authz: { kind: 'explicit-organization', organizationId: (input) => input.params.id },
      handler,
    });

    const response = await route(request(), segment('org_Z'));

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers 400 for a malformed organization id without asking the mirror', async () => {
    resolveSession.mockResolvedValue(session());
    const route = defineRoute({
      params: idParams,
      authz: { kind: 'explicit-organization', organizationId: (input) => input.params.id },
      handler: vi.fn(),
    });

    const response = await route(request(), segment("org_A' or 1=1"));

    expect(response.status).toBe(400);
    expect(ensureOrganizationAccess).not.toHaveBeenCalled();
  });

  it('answers 404 when a resource check says the id is not visible to the session organization', async () => {
    resolveSession.mockResolvedValue(session());
    runResourceCheck.mockResolvedValue(false);
    const check = defineResourceCheck(async () => true);
    const handler = vi.fn();

    const response = await defineRoute({ authz: { kind: 'resource', check }, handler })(request());

    expect(response.status).toBe(404);
    expect(runResourceCheck).toHaveBeenCalledWith(check, expect.objectContaining({ params: {} }), 'org_A');
    expect(handler).not.toHaveBeenCalled();
  });

  it('runs the handler when the resource check says yes', async () => {
    resolveSession.mockResolvedValue(session());
    runResourceCheck.mockResolvedValue(true);
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const response = await defineRoute({
      authz: { kind: 'resource', check: defineResourceCheck(async () => true) },
      handler,
    })(request());

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('does not accept a bare function as a resource check', () => {
    defineRoute({
      // @ts-expect-error -- only defineResourceCheck makes a check; a plain
      // resolver could query outside withTenant and bypass RLS.
      authz: { kind: 'resource', check: async () => true },
      handler: async () => ({ ok: true }),
    });
  });

  it('keeps the cookie a handler set over the older refreshed session', async () => {
    resolveSession.mockResolvedValue(session('sealed-refreshed'));
    const handler = vi.fn(async (_input: unknown, ctx: { sessionData: string }) => {
      const response = NextResponse.json({ switched: ctx.sessionData });

      response.cookies.set('wos-session', 'sealed-switched');

      return response;
    });

    const response = await defineRoute({ authz: { kind: 'session-organization' }, handler })(request());

    expect(await response.json()).toEqual({ switched: 'sealed-refreshed' });
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-switched');
  });

  it('stores a refreshed session when the handler did not set one', async () => {
    resolveSession.mockResolvedValue(session('sealed-refreshed'));

    const response = await defineRoute({
      authz: { kind: 'session-organization' },
      handler: async () => ({ ok: true }),
    })(request());

    expect(response.cookies.get('wos-session')?.value).toBe('sealed-refreshed');
  });
});

describe('defineRoute, hardened', () => {
  const bodySchema = z.object({ name: z.string().min(1, 'Name required') });

  function post(body: string, headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost:3000/api/x', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', cookie: 'wos-session=sealed-old', 'content-type': 'application/json', ...headers },
      body,
    });
  }

  it('refuses a state-changing request from a foreign origin before resolving the session', async () => {
    const handler = vi.fn();
    const response = await defineRoute({ authz: { kind: 'session-organization' }, handler })(
      new NextRequest('http://localhost:3000/api/x', { method: 'POST', headers: { origin: 'https://evil.example' } })
    );

    expect(response.status).toBe(403);
    expect(resolveSession).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers a schema failure with 400 and the fields', async () => {
    resolveSession.mockResolvedValue(session());

    const response = await defineRoute({ body: bodySchema, authz: { kind: 'session-organization' }, handler: vi.fn() })(
      post(JSON.stringify({ name: '' }))
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request', fields: { name: ['Name required'] } });
  });

  it('answers an unexpected throw with 500 and a sanitized message', async () => {
    resolveSession.mockResolvedValue(session());

    const response = await defineRoute({
      authz: { kind: 'session-organization' },
      handler: async () => {
        throw new Error('duplicate key value violates unique constraint "secret_internal_idx"');
      },
    })(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret_internal_idx');
  });

  it('stores a refreshed session on a plain Response a handler returned', async () => {
    resolveSession.mockResolvedValue(session('sealed-refreshed'));

    const response = await defineRoute({
      authz: { kind: 'session-organization' },
      handler: async () => new Response('plain', { status: 200, headers: { 'x-custom': 'kept' } }),
    })(request());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('plain');
    expect(response.headers.get('x-custom')).toBe('kept');
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-refreshed');
  });

  it('stores a refreshed session on a 404, a 403 and a 500 too', async () => {
    resolveSession.mockResolvedValue(session('sealed-refreshed'));

    runResourceCheck.mockResolvedValue(false);
    const notFound = await defineRoute({
      authz: { kind: 'resource', check: defineResourceCheck(async () => false) },
      handler: vi.fn(),
    })(request());

    ensureOrganizationAccess.mockResolvedValue({ authorized: false, status: 403, error: 'You do not have access to this organization' });
    const forbidden = await defineRoute({
      params: idParams,
      authz: { kind: 'explicit-organization', organizationId: (input) => input.params.id },
      handler: vi.fn(),
    })(request(), segment('org_Z'));

    const crashed = await defineRoute({
      authz: { kind: 'session-organization' },
      handler: async () => {
        throw new Error('boom');
      },
    })(request());

    expect([notFound.status, forbidden.status, crashed.status]).toEqual([404, 403, 500]);

    for (const response of [notFound, forbidden, crashed]) {
      expect(response.cookies.get('wos-session')?.value).toBe('sealed-refreshed');
    }
  });

  it('marks every answer private and unstored', async () => {
    resolveSession.mockResolvedValue(session('sealed-refreshed'));
    const answered = await defineRoute({ authz: { kind: 'session-organization' }, handler: async () => ({ ok: true }) })(
      request('GET')
    );

    resolveSession.mockResolvedValue({ kind: 'none' });
    const refused = await defineRoute({ authz: { kind: 'session-organization' }, handler: vi.fn() })(request('GET'));

    const foreign = await defineRoute({ authz: { kind: 'session-organization' }, handler: vi.fn() })(
      new NextRequest('http://localhost:3000/api/x', { method: 'POST', headers: { origin: 'https://evil.example' } })
    );
    const publicAnswer = await definePublicRoute({ justification: 'test', handler: async () => ({ ok: true }) })(
      new NextRequest('http://localhost:3000/api/p')
    );

    expect([answered.status, refused.status, foreign.status, publicAnswer.status]).toEqual([200, 401, 403, 200]);

    for (const response of [answered, refused, foreign, publicAnswer]) {
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
  });

  it('keeps a cache header the handler chose, unless the answer carries the session cookie', async () => {
    const cached = async () => NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'public, max-age=60' } });

    resolveSession.mockResolvedValue(session());
    const plain = await defineRoute({ authz: { kind: 'session-organization' }, handler: cached })(request('GET'));

    resolveSession.mockResolvedValue(session('sealed-refreshed'));
    const refreshed = await defineRoute({ authz: { kind: 'session-organization' }, handler: cached })(request('GET'));

    resolveSession.mockResolvedValue(session());
    const switched = await defineRoute({
      authz: { kind: 'session-organization' },
      handler: async () => {
        const response = await cached();

        response.cookies.set('wos-session', 'sealed-switched');

        return response;
      },
    })(request('GET'));

    expect(plain.headers.get('cache-control')).toBe('public, max-age=60');
    expect(refreshed.cookies.get('wos-session')?.value).toBe('sealed-refreshed');
    expect(refreshed.headers.get('cache-control')).toBe('private, no-store');
    expect(switched.headers.get('cache-control')).toBe('private, no-store');
  });

  it('keeps a well-formed request id and replaces a forged one', async () => {
    resolveSession.mockResolvedValue(session());
    const route = defineRoute({ authz: { kind: 'session-organization' }, handler: async () => ({ ok: true }) });

    const kept = await route(
      new NextRequest('http://localhost:3000/api/x', { headers: { cookie: 'wos-session=s', 'x-request-id': 'req-0123456789' } })
    );
    const forged = await route(
      new NextRequest('http://localhost:3000/api/x', {
        headers: { cookie: 'wos-session=s', 'x-request-id': 'evil value\" injected' },
      })
    );

    expect(kept.headers.get('x-request-id')).toBe('req-0123456789');
    expect(forged.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers 413 for a body over the cap, declared or not', async () => {
    resolveSession.mockResolvedValue(session());
    const handler = vi.fn();
    const route = defineRoute({ body: bodySchema, authz: { kind: 'session-organization' }, handler });
    const big = JSON.stringify({ name: 'x'.repeat(70 * 1024) });

    const declared = await route(post(big, { 'content-length': String(big.length) }));
    // A stream with no length header is cut off at the cap while reading.
    const streamed = await route(
      new NextRequest('http://localhost:3000/api/x', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', cookie: 'wos-session=s', 'content-type': 'application/json' },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(big));
            controller.close();
          },
        }),
        duplex: 'half',
      } as ConstructorParameters<typeof NextRequest>[1])
    );

    expect(big.length).toBeGreaterThan(MAX_BODY_BYTES);
    expect(declared.status).toBe(413);
    expect(streamed.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers 415 for a JSON body sent as text/plain', async () => {
    resolveSession.mockResolvedValue(session());
    const handler = vi.fn();

    const response = await defineRoute({ body: bodySchema, authz: { kind: 'session-organization' }, handler })(
      post(JSON.stringify({ name: 'ok' }), { 'content-type': 'text/plain' })
    );

    expect(response.status).toBe(415);
    expect(handler).not.toHaveBeenCalled();
  });

  it('caps and types public bodies the same way', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const route = definePublicRoute({ justification: 'test', body: bodySchema, handler });
    const publicPost = (body: string, contentType: string) =>
      route(new NextRequest('http://localhost:3000/api/p', { method: 'POST', headers: { 'content-type': contentType }, body }));

    expect((await publicPost(JSON.stringify({ name: 'x'.repeat(70 * 1024) }), 'application/json')).status).toBe(413);
    expect((await publicPost(JSON.stringify({ name: 'ok' }), 'text/plain')).status).toBe(415);
    expect((await publicPost(JSON.stringify({ name: 'ok' }), 'application/json; charset=utf-8')).status).toBe(200);
  });
});
