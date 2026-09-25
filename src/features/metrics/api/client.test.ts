import { describe, expect, it, vi } from 'vitest';
import { fetchMetricDetail, fetchOverview } from './client';

/**
 * What the metrics screens ask for and what they read when it fails. The
 * fetch itself is getJson's (pinned in lib/clients/api-error.test.ts); these
 * pin the two URLs and each call's own failure line, which moved into
 * getJson's arguments on 24 Sep 2026.
 */

function failWithoutMessage() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
}

describe('fetchOverview', () => {
  it('asks for the selected range and names the panel when it fails', async () => {
    const fetchSpy = failWithoutMessage();
    const controller = new AbortController();

    await expect(
      fetchOverview({ from: '2026-09-01', to: '2026-09-07' }, controller.signal)
    ).rejects.toMatchObject({
      name: 'ApiRequestError',
      message: 'Failed to load the panel',
      status: 500,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/metrics?range=custom&from=2026-09-01&to=2026-09-07',
      { credentials: 'include', cache: 'no-store', signal: controller.signal }
    );
  });
});

describe('fetchMetricDetail', () => {
  it('asks for the metric, range and granularity and names the metric on failure', async () => {
    const fetchSpy = failWithoutMessage();

    await expect(fetchMetricDetail('revenue', { preset: '30d' }, 'week')).rejects.toMatchObject({
      name: 'ApiRequestError',
      message: 'Failed to load this metric',
      status: 500,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/metrics/revenue?range=30d&granularity=week',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' })
    );
  });

  it('leaves the granularity out when the caller has none', async () => {
    const fetchSpy = failWithoutMessage();

    await expect(fetchMetricDetail('revenue', { preset: '7d' }, null)).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledWith('/api/metrics/revenue?range=7d', expect.anything());
  });
});
