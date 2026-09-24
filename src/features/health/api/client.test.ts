import { describe, expect, it, vi } from 'vitest';
import { fetchHealthReport } from './client';

/**
 * What System Health asks for and what it reads when that fails. The fetch
 * itself is getJson's (pinned in lib/clients/api-error.test.ts); this pins
 * the path and the screen's own failure line.
 */

describe('fetchHealthReport', () => {
  it('asks for the report and names System Health when it fails', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));
    const controller = new AbortController();

    await expect(fetchHealthReport(controller.signal)).rejects.toMatchObject({
      name: 'ApiRequestError',
      message: 'Failed to load System Health',
      status: 503,
    });
    expect(fetchSpy).toHaveBeenCalledWith('/api/health', {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
  });
});
