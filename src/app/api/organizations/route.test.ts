import { NextRequest, type NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allKeys, ORGANIZATION_DTO_KEYS, RETIRED_KEYS, okSession, sessionOrganization, USER_ID } from '@/test/session-fixtures';

/**
 * The organization list and creation, on the wire: OrganizationDto key sets
 * exactly, the switcher's order decided on the server, a create body that
 * refuses fields it does not know, and a create WorkOS made that is answered
 * 201, with the session switched, even when the mirror cannot be read back.
 */

const resolveSession = vi.fn();
const ensureOrganizationAccess = vi.fn();
const createOrganizationForUser = vi.fn();
const findMembership = vi.fn();
const refreshSessionForOrganization = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/auth', () => ({
  WORKOS_SESSION_COOKIE: 'wos-session',
  refreshSessionForOrganization,
  setWorkOSSessionCookie: (response: NextResponse, value: string) => response.cookies.set('wos-session', value),
}));
vi.mock('@/lib/auth/ensure-organization-access', () => ({ ensureOrganizationAccess }));
vi.mock('@/lib/auth/session', () => ({ resolveSession }));
vi.mock('@/lib/workos/organizations', () => ({ createOrganizationForUser, findMembership }));

const { GET, POST } = await import('./route');

function request(method: 'GET' | 'POST', body?: unknown) {
  return new NextRequest('http://localhost:3000/api/organizations', {
    method,
    headers: { origin: 'http://localhost:3000', cookie: 'wos-session=sealed', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  for (const mock of [resolveSession, ensureOrganizationAccess, createOrganizationForUser, findMembership, refreshSessionForOrganization]) {
    mock.mockReset();
  }
  ensureOrganizationAccess.mockResolvedValue({ authorized: true, role: 'owner' });
});

describe('GET /api/organizations', () => {
  it('lists DTOs, default first then newest, the session one active', async () => {
    resolveSession.mockResolvedValue(okSession([
        sessionOrganization('org_B', { createdAt: new Date('2026-09-10T00:00:00Z') }),
        sessionOrganization('org_A', { isDefault: true, createdAt: new Date('2026-09-01T00:00:00Z') }),
        sessionOrganization('org_C', { createdAt: new Date('2026-09-20T00:00:00Z'), role: 'member' }),
      ])
    );

    const response = await GET(request('GET'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(Object.keys(body).sort()).toEqual(['organizations', 'success']);
    expect(body.organizations.map((o: { id: string }) => o.id)).toEqual(['org_A', 'org_C', 'org_B']);
    // The session is bound to the first organization of the context (org_B).
    expect(body.organizations.map((o: { isActive: boolean }) => o.isActive)).toEqual([false, false, true]);
    expect(body.organizations[1].role).toBe('member');

    for (const organization of body.organizations) {
      expect(Object.keys(organization).sort()).toEqual(ORGANIZATION_DTO_KEYS);
    }
    for (const key of RETIRED_KEYS) expect(allKeys(body)).not.toContain(key);
  });
});

describe('POST /api/organizations', () => {
  beforeEach(() => {
    resolveSession.mockResolvedValue(okSession());
    createOrganizationForUser.mockResolvedValue({ organizationId: 'org_N', membershipId: 'om_N' });
    refreshSessionForOrganization.mockResolvedValue({ sealedSession: 'sealed-new', organizationId: 'org_N', role: 'admin' });
  });

  it('creates, switches the session, and answers with the new organization DTO', async () => {
    findMembership.mockResolvedValue({
      role: 'admin',
      organization: {
        id: 'org_N',
        name: 'New',
        onboardingCompletedAt: null,
        createdAt: new Date('2026-09-23T00:00:00Z'),
      },
    });

    const response = await POST(request('POST', { name: ' New ' }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createOrganizationForUser).toHaveBeenCalledWith({
      name: 'New',
      userId: USER_ID,
      workosUserId: 'user_w1',
    });
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-new');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(Object.keys(body).sort()).toEqual(['organization', 'success']);
    expect(Object.keys(body.organization).sort()).toEqual(ORGANIZATION_DTO_KEYS);
    expect(body.organization).toEqual({
      id: 'org_N',
      name: 'New',
      onboardingCompletedAt: null,
      role: 'owner',
      isActive: true,
      createdAt: '2026-09-23T00:00:00.000Z',
    });
  });

  it('still answers with the created organization when the mirror has not got it', async () => {
    findMembership.mockResolvedValue(null);

    const response = await POST(request('POST', { name: 'New' }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.organization).toMatchObject({ id: 'org_N', name: 'New', role: 'owner', isActive: true });
  });

  it('still answers 201 and switches the session when reading the mirror back fails', async () => {
    findMembership.mockRejectedValue(new Error('connect ECONNREFUSED'));

    const response = await POST(request('POST', { name: 'New' }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.cookies.get('wos-session')?.value).toBe('sealed-new');
    expect(Object.keys(body.organization).sort()).toEqual(ORGANIZATION_DTO_KEYS);
    expect(body.organization).toMatchObject({
      id: 'org_N',
      name: 'New',
      onboardingCompletedAt: null,
      role: 'owner',
      isActive: true,
    });
  });

  it('refuses a field it does not know, such as the retired category', async () => {
    const response = await POST(request('POST', { name: 'New', category: 'ecommerce' }));

    expect(response.status).toBe(400);
    expect(createOrganizationForUser).not.toHaveBeenCalled();
  });

  it('refuses a name with a NUL before WorkOS is asked to create it', async () => {
    const response = await POST(request('POST', { name: 'A\u{0}B' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields.name).toEqual(['Organization name cannot contain control or text-direction characters']);
    expect(createOrganizationForUser).not.toHaveBeenCalled();
    expect(refreshSessionForOrganization).not.toHaveBeenCalled();
  });
});
