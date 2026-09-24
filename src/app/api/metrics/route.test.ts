import { NextRequest, type NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { okSession } from '@/test/session-fixtures';

/**
 * The metrics routes on the wire: signed-in only, the range validated before
 * anything is computed, and answers in the shape the client parses.
 */

const resolveSession = vi.fn();
const ensureOrganizationAccess = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/auth', () => ({
  WORKOS_SESSION_COOKIE: 'wos-session',
  setWorkOSSessionCookie: (response: NextResponse, value: string) => response.cookies.set('wos-session', value),
}));
vi.mock('@/lib/auth/ensure-organization-access', () => ({ ensureOrganizationAccess }));
vi.mock('@/lib/auth/session', () => ({ resolveSession }));

const overviewRoute = await import('./route');
const metricRoute = await import('./[metric]/route');

function request(path: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { origin: 'http://localhost:3000', cookie: 'wos-session=sealed' },
  });
}

function segment(metric: string) {
  return { params: Promise.resolve({ metric }) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T14:35:00Z'));
  resolveSession.mockReset();
  ensureOrganizationAccess.mockReset();
  resolveSession.mockResolvedValue(okSession());
  ensureOrganizationAccess.mockResolvedValue({ authorized: true, role: 'owner' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/metrics', () => {
  it('refuses a request without a session', async () => {
    resolveSession.mockResolvedValue({ kind: 'none' });

    const response = await overviewRoute.GET(request('/api/metrics'));

    expect(response.status).toBe(401);
  });

  it("answers with the last 30 days of the session's organization, marked as demo data", async () => {
    const response = await overviewRoute.GET(request('/api/metrics'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body.success).toBe(true);
    expect(body.overview.source).toBe('demo');
    expect(body.overview.selection).toEqual({ preset: '30d' });
    expect(body.overview.period).toEqual({ start: '2026-08-24T00:00:00Z', end: '2026-09-23T00:00:00Z' });
    expect(body.overview.metrics).toHaveLength(9);
  });

  it('reads a custom range', async () => {
    const response = await overviewRoute.GET(request('/api/metrics?range=custom&from=2026-08-01&to=2026-08-31'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overview.period).toEqual({ start: '2026-08-01T00:00:00Z', end: '2026-09-01T00:00:00Z' });
  });

  it.each([
    ['an unknown range', '/api/metrics?range=forever'],
    ['a custom range without its days', '/api/metrics?range=custom&from=2026-08-01'],
    ['a custom range in the future', '/api/metrics?range=custom&from=2026-09-01&to=2026-10-01'],
  ])('refuses %s with a 400', async (_, path) => {
    const response = await overviewRoute.GET(request(path));

    expect(response.status).toBe(400);
    expect((await response.json()).success).toBe(false);
  });
});

describe('GET /api/metrics/[metric]', () => {
  it('answers one metric in the bucket size asked for', async () => {
    const response = await metricRoute.GET(request('/api/metrics/revenue?range=12m&granularity=month'), segment('revenue'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.detail.metric).toBe('revenue');
    expect(body.detail.granularity).toBe('month');
    expect(body.detail.points).toHaveLength(13);
  });

  it('refuses an unknown metric and a bucket size the range does not offer', async () => {
    expect((await metricRoute.GET(request('/api/metrics/visits'), segment('visits'))).status).toBe(400);
    expect(
      (await metricRoute.GET(request('/api/metrics/revenue?range=7d&granularity=month'), segment('revenue'))).status
    ).toBe(400);
  });

  it('refuses a request without a session', async () => {
    resolveSession.mockResolvedValue({ kind: 'none' });

    expect((await metricRoute.GET(request('/api/metrics/revenue'), segment('revenue'))).status).toBe(401);
  });
});
