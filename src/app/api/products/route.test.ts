import { NextRequest, type NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { okSession } from '@/test/session-fixtures';

/** The store-data routes on the wire: signed-in members only, never cached. */

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

const products = await import('./route');
const customers = await import('../customers/route');
const orders = await import('../orders/route');

function request(path: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { origin: 'http://localhost:3000', cookie: 'wos-session=sealed' },
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T15:00:00Z'));
  resolveSession.mockReset();
  ensureOrganizationAccess.mockReset();
  resolveSession.mockResolvedValue(okSession());
  ensureOrganizationAccess.mockResolvedValue({ authorized: true, role: 'owner' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/products, /api/customers and /api/orders', () => {
  it('refuse a request without a session', async () => {
    resolveSession.mockResolvedValue({ kind: 'none' });

    expect((await products.GET(request('/api/products'))).status).toBe(401);
    expect((await customers.GET(request('/api/customers'))).status).toBe(401);
    expect((await orders.GET(request('/api/orders'))).status).toBe(401);
  });

  it("answer the session's organization with demo data, never cached", async () => {
    const productResponse = await products.GET(request('/api/products'));
    const customerResponse = await customers.GET(request('/api/customers'));
    const orderResponse = await orders.GET(request('/api/orders'));

    for (const response of [productResponse, customerResponse, orderResponse]) {
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }

    expect((await productResponse.json()).list.products).toHaveLength(36);
    expect((await customerResponse.json()).list.customers).toHaveLength(48);
    expect((await orderResponse.json()).board).toMatchObject({ source: 'demo', checkedAt: '2026-09-23T15:00:00Z' });
  });
});
