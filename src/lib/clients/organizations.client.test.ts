import { describe, expect, it, vi } from 'vitest';
import { listOrganizations } from './organizations.client';

/**
 * What the organization list asks for and what it reads back. The fetch
 * itself is getJson's (pinned in api-error.test.ts); this pins the path, the
 * list taken out of the body and the failure line the switcher shows.
 */

const ORGANIZATION = {
  id: 'org_A',
  name: 'Analytical Engines',
  onboardingCompletedAt: '2026-09-02T00:00:00.000Z',
  role: 'owner',
  isActive: true,
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('listOrganizations', () => {
  it('asks for the list and returns the parsed organizations', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ organizations: [ORGANIZATION] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const controller = new AbortController();

    await expect(listOrganizations(controller.signal)).resolves.toEqual([ORGANIZATION]);
    expect(fetchSpy).toHaveBeenCalledWith('/api/organizations', {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
  });

  it('names the organizations when the server gives no message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));

    await expect(listOrganizations()).rejects.toMatchObject({
      name: 'ApiRequestError',
      message: 'Failed to load organizations',
      status: 503,
    });
  });
});
