import { beforeEach, describe, expect, it, vi } from 'vitest';

/** isOwnerInWorkOS is the fresh answer an owner's change rests on; it must only say yes to an active admin of THAT organization. */

const listOrganizationMemberships = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('./client', () => ({
  getWorkOSClient: () => ({ userManagement: { listOrganizationMemberships } }),
}));

const { isOwnerInWorkOS } = await import('./organizations');

const membership = (overrides: Record<string, unknown> = {}) => ({
  id: 'om_1',
  organizationId: 'org_A',
  userId: 'user_w1',
  status: 'active',
  role: { slug: 'admin' },
  ...overrides,
});

beforeEach(() => {
  listOrganizationMemberships.mockReset();
});

describe('isOwnerInWorkOS', () => {
  it('asks WorkOS for this user in this organization, active only', async () => {
    listOrganizationMemberships.mockResolvedValue({ data: [membership()] });

    expect(await isOwnerInWorkOS('user_w1', 'org_A')).toBe(true);
    expect(listOrganizationMemberships).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_w1', organizationId: 'org_A', statuses: ['active'] })
    );
  });

  it.each([
    ['no membership', []],
    ['a member, not an admin', [membership({ role: { slug: 'member' } })]],
    ['an admin of another organization', [membership({ organizationId: 'org_B' })]],
    ['another user', [membership({ userId: 'user_w2' })]],
    ['an inactive admin', [membership({ status: 'inactive' })]],
  ])('says no for %s', async (_case, data) => {
    listOrganizationMemberships.mockResolvedValue({ data });

    expect(await isOwnerInWorkOS('user_w1', 'org_A')).toBe(false);
  });

  it('lets a WorkOS failure propagate instead of answering', async () => {
    listOrganizationMemberships.mockRejectedValue(new Error('unavailable'));

    await expect(isOwnerInWorkOS('user_w1', 'org_A')).rejects.toThrow('unavailable');
  });
});
