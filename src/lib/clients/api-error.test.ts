import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, getJson } from './api-error';

/**
 * The one GET every feature client (commerce, metrics, System Health) goes
 * through. Commerce kept it privately and the other two wrote it out by
 * hand; these tests pin what all three relied on: the session cookie, no
 * HTTP cache, the caller's signal, the server's own message on a failure
 * (or the caller's line when there is none), and an abort left untouched.
 */

function answer(status: number, body: string) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status }));
}

describe('getJson', () => {
  it('asks with the session cookie, past the cache, with the caller signal', async () => {
    const fetchSpy = answer(200, JSON.stringify({ list: [] }));
    const controller = new AbortController();

    const body = await getJson('/api/products', 'Failed to load products', controller.signal);

    expect(body).toEqual({ list: [] });
    expect(fetchSpy).toHaveBeenCalledWith('/api/products', {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
  });

  it('throws the server message and status on a non-2xx', async () => {
    answer(403, JSON.stringify({ error: 'No access to this organization' }));

    const failure = await getJson('/api/orders', 'Failed to load orders').catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(ApiRequestError);
    expect(failure).toMatchObject({ message: 'No access to this organization', status: 403 });
  });

  it.each([
    ['a body that is not json', 'Bad Gateway'],
    ['a json body with no error', JSON.stringify({ success: false })],
  ])('throws the caller failure line on %s', async (_label, body) => {
    answer(502, body);

    const failure = await getJson('/api/health', 'Failed to load System Health').catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(ApiRequestError);
    expect(failure).toMatchObject({ message: 'Failed to load System Health', status: 502 });
  });

  it('rejects with the abort itself, not an api error, when the signal aborts', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        })
    );
    const controller = new AbortController();
    const pending = getJson('/api/metrics?range=7d', 'Failed to load the panel', controller.signal);

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
