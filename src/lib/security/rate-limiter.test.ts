import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getIdentifier, RATE_LIMITS, rateLimit } from './rate-limiter';

/**
 * The rate-limit key must not be attacker-controlled.
 *
 * The address itself comes from clientIpFrom, whose tests (client-ip.test.ts)
 * pin the rightmost-hop rule. Here: the key is that address under an 'ip:'
 * prefix, and a request with no proxy header shares one 'ip:unknown' bucket.
 * The limiter used to fall back to the `sub` of a Bearer token it never
 * verified, which let a caller name its own bucket.
 *
 * The window is fixed: it opens at a key's first attempt and ends
 * `windowMs` later, whatever happens inside it. The limit is admitted, the
 * next attempt is refused until the window has ended, and the reset time
 * reported (the middleware's Retry-After and X-RateLimit-Reset) is that
 * end. The store is module-global, so each test spends its own key.
 */

function requestWith(headers: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/organizations', { headers });
}

describe('getIdentifier', () => {
  it('keys on the address our edge appended', () => {
    const id = getIdentifier(requestWith({ 'x-forwarded-for': 'forged, 203.0.113.5' }));

    expect(id).toBe('ip:203.0.113.5');
  });

  it('puts a request with no proxy header in the shared unknown bucket, whatever token it carries', () => {
    const payload = btoa(JSON.stringify({ sub: 'user_chosen_by_caller' }));
    const id = getIdentifier(requestWith({ authorization: `Bearer header.${payload}.signature` }));

    expect(id).toBe('ip:unknown');
  });
});

describe('rateLimit', () => {
  const NOW = new Date('2026-09-24T12:00:00Z');
  const { maxAttempts, windowMs } = RATE_LIMITS.AUTH_SUBMIT;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('admits max attempts per window, then refuses until it ends', () => {
    const attempt = () => rateLimit('ip:198.51.100.1', 'window-test', 'AUTH_SUBMIT');

    for (let spent = 1; spent <= maxAttempts; spent += 1) {
      expect(attempt()).toMatchObject({ allowed: true, remaining: maxAttempts - spent });
    }

    expect(attempt()).toMatchObject({ allowed: false, remaining: 0 });

    vi.advanceTimersByTime(windowMs - 1);

    expect(attempt()).toMatchObject({ allowed: false, remaining: 0 });

    vi.advanceTimersByTime(2);

    expect(attempt()).toMatchObject({ allowed: true, remaining: maxAttempts - 1 });
  });

  it('reports the window end as resetTime', () => {
    const attempt = () => rateLimit('ip:198.51.100.2', 'reset-test', 'AUTH_SUBMIT');
    const first = attempt();

    vi.advanceTimersByTime(60 * 1000);

    const later = attempt();

    expect(first.resetTime).toBe(NOW.getTime() + windowMs);
    expect(later.resetTime).toBe(first.resetTime);
  });
});
