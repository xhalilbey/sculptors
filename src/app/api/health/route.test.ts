import { NextRequest, type NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { okSession } from '@/test/session-fixtures';

/** GET /api/health on the wire: signed-in members only, never cached. */

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

const route = await import('./route');

function request() {
  return new NextRequest('http://localhost:3000/api/health', {
    headers: { origin: 'http://localhost:3000', cookie: 'wos-session=sealed' },
  });
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

describe('GET /api/health', () => {
  it('refuses a request without a session', async () => {
    resolveSession.mockResolvedValue({ kind: 'none' });

    expect((await route.GET(request())).status).toBe(401);
  });

  it('answers the system as of now, marked as demo data and never cached', async () => {
    const response = await route.GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(body.success).toBe(true);
    expect(body.report.source).toBe('demo');
    expect(body.report.checkedAt).toBe('2026-09-23T14:35Z');
    expect(body.report.components).toHaveLength(7);
    expect(body.report.pastIncidents).toHaveLength(15);
  });
});
