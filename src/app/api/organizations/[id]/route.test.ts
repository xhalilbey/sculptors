import { NextRequest, type NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allKeys, ORGANIZATION_DTO_KEYS, RETIRED_KEYS, okSession } from '@/test/session-fixtures';

/**
 * Renaming an organization is carried out in WorkOS with the server's API
 * key, so WorkOS never refuses it on the user's behalf. The mirror's "owner"
 * can be stale; WorkOS's answer is the one that must decide.
 */

const resolveSession = vi.fn();
const ensureOrganizationAccess = vi.fn();
const isOwnerInWorkOS = vi.fn();
const updateOrganization = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/auth', () => ({
  WORKOS_SESSION_COOKIE: 'wos-session',
  setWorkOSSessionCookie: (response: NextResponse) => response,
}));
vi.mock('@/lib/auth/ensure-organization-access', () => ({ ensureOrganizationAccess }));
vi.mock('@/lib/auth/session', () => ({ resolveSession }));
vi.mock('@/lib/workos/organizations', () => ({ isOwnerInWorkOS, updateOrganization }));

const { PATCH } = await import('./route');

const USER_ID = '6f1c1a4e-2b1d-4c6a-9f0e-0a1b2c3d4e5f';
const NOW = new Date('2026-09-23T00:00:00Z');

function patch(body: unknown) {
  return PATCH(
    new NextRequest('http://localhost:3000/api/organizations/org_A', {
      method: 'PATCH',
      headers: { origin: 'http://localhost:3000', cookie: 'wos-session=sealed', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'org_A' }) }
  );
}

beforeEach(() => {
  for (const mock of [resolveSession, ensureOrganizationAccess, isOwnerInWorkOS, updateOrganization]) {
    mock.mockReset();
  }
  resolveSession.mockResolvedValue(okSession());
  ensureOrganizationAccess.mockResolvedValue({ authorized: true, role: 'owner' });
  updateOrganization.mockResolvedValue({
    id: 'org_A',
    name: 'Renamed',
    slug: null,
    plan: 'free',
    region: 'eu-central-1',
    status: 'active',
    onboardingCompletedAt: null,
    createdBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  });
});

describe('PATCH /api/organizations/[id]', () => {
  it('refuses when the mirror says owner but WorkOS no longer does', async () => {
    isOwnerInWorkOS.mockResolvedValue(false);

    const response = await patch({ name: 'Renamed' });

    expect(response.status).toBe(403);
    expect(isOwnerInWorkOS).toHaveBeenCalledWith('user_w1', 'org_A');
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  it('refuses a mirror member without asking WorkOS', async () => {
    ensureOrganizationAccess.mockResolvedValue({ authorized: true, role: 'member' });

    const response = await patch({ name: 'Renamed' });

    expect(response.status).toBe(403);
    expect(isOwnerInWorkOS).not.toHaveBeenCalled();
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  it('fails closed with 500 when WorkOS cannot be asked', async () => {
    isOwnerInWorkOS.mockRejectedValue(new Error('WorkOS unavailable'));

    const response = await patch({ name: 'Renamed' });

    expect(response.status).toBe(500);
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  it('applies the change when WorkOS confirms the owner', async () => {
    isOwnerInWorkOS.mockResolvedValue(true);

    const response = await patch({ name: 'Renamed' });

    expect(response.status).toBe(200);
    expect(updateOrganization).toHaveBeenCalledWith('org_A', { name: 'Renamed' });
  });

  it('answers with the organization DTO, not the raw row', async () => {
    isOwnerInWorkOS.mockResolvedValue(true);

    const body = await (await patch({ completeOnboarding: true })).json();

    expect(Object.keys(body).sort()).toEqual(['organization', 'success']);
    expect(Object.keys(body.organization).sort()).toEqual(ORGANIZATION_DTO_KEYS);
    expect(body.organization).toEqual({
      id: 'org_A',
      name: 'Renamed',
      onboardingCompletedAt: null,
      role: 'owner',
      isActive: true,
      createdAt: NOW.toISOString(),
    });
    for (const key of [...RETIRED_KEYS, 'plan', 'region', 'status', 'slug', 'created_by', 'deleted_at']) {
      expect(allKeys(body)).not.toContain(key);
    }
  });

  it('refuses a field it does not know, such as the retired category', async () => {
    isOwnerInWorkOS.mockResolvedValue(true);

    const response = await patch({ category: 'ecommerce' });

    expect(response.status).toBe(400);
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  it('refuses a name with a NUL before WorkOS is asked anything', async () => {
    isOwnerInWorkOS.mockResolvedValue(true);

    const response = await patch({ name: 'A\u{0}B' });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fields.name).toEqual(['Organization name cannot contain control or text-direction characters']);
    expect(isOwnerInWorkOS).not.toHaveBeenCalled();
    expect(updateOrganization).not.toHaveBeenCalled();
  });
});
