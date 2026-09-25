import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * defineRoute's explicit-organization routes gate on this helper. What it
 * must never do is say yes when the mirror has no active membership, nor
 * turn a failed lookup into "no access": an outage is a 500, not a 403. The
 * membership lookup is the service (findMembership over the identity
 * repositories), mocked here; its own behaviour is tested against PGlite.
 */

const findMembership = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/organizations', () => ({
  findMembership,
  isOwnerRole: (slug: string) => slug === 'admin',
}));

const { ensureOrganizationAccess } = await import('./ensure-organization-access');

beforeEach(() => {
  findMembership.mockReset();
});

describe('ensureOrganizationAccess', () => {
  it('denies when there is no active membership', async () => {
    findMembership.mockResolvedValue(null);

    const result = await ensureOrganizationAccess('org_1', 'user_1');

    expect(result).toEqual({
      authorized: false,
      status: 403,
      error: 'You do not have access to this organization',
    });
  });

  it('asks the mirror about the organization and user it was given', async () => {
    findMembership.mockResolvedValue(null);

    await ensureOrganizationAccess('org_1', 'user_1');

    expect(findMembership).toHaveBeenCalledWith('user_1', 'org_1');
  });

  it('lets a database failure through', async () => {
    const outage = new Error('connect ECONNREFUSED');

    findMembership.mockRejectedValue(outage);

    await expect(ensureOrganizationAccess('org_1', 'user_1')).rejects.toBe(outage);
  });

  it('maps the WorkOS admin slug to owner and everything else to member', async () => {
    findMembership.mockResolvedValueOnce({ role: 'admin' });
    expect(await ensureOrganizationAccess('org_1', 'user_1')).toEqual({ authorized: true, role: 'owner' });

    findMembership.mockResolvedValueOnce({ role: 'member' });
    expect(await ensureOrganizationAccess('org_1', 'user_1')).toEqual({ authorized: true, role: 'member' });
  });
});
