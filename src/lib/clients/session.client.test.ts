import { describe, expect, it, vi } from 'vitest';
import { fetchSession } from './session.client';

/**
 * What the browser's session read hands the AuthProvider. It used to be
 * `{ status, session? }`, which let a caller hold a 2xx without a session
 * and so kept a branch for it that could never run. It is now a union: a
 * session, or the status that says why there is none.
 */

const SESSION_BODY = {
  user: { id: 'user-1', email: 'ada@example.com', displayName: 'Ada Lovelace', avatarUrl: null },
  organization: {
    id: 'org_A',
    name: 'Analytical Engines',
    onboardingCompletedAt: '2026-09-02T00:00:00.000Z',
    role: 'owner',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
};

function answer(status: number, body: unknown) {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
}

describe('fetchSession', () => {
  it('returns the parsed session on a 2xx', async () => {
    const fetchSpy = answer(200, SESSION_BODY);

    await expect(fetchSession()).resolves.toEqual({ ok: true, session: SESSION_BODY });
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    });
  });

  it.each([401, 403, 503])('returns the status, not a session, on a %i', async status => {
    answer(status, { error: 'No session' });

    await expect(fetchSession()).resolves.toEqual({ ok: false, status });
  });

  it('throws on a 2xx whose body breaks the contract', async () => {
    answer(200, { user: SESSION_BODY.user });

    await expect(fetchSession()).rejects.toThrow();
  });
});
