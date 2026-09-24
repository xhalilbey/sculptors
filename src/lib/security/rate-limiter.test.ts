import { describe, expect, it } from 'vitest';
import { getIdentifier } from './rate-limiter';

/**
 * The rate-limit key must not be attacker-controlled.
 *
 * The address itself comes from clientIpFrom, whose tests (client-ip.test.ts)
 * pin the rightmost-hop rule. Here: the key is that address under an 'ip:'
 * prefix, and a request with no proxy header shares one 'ip:unknown' bucket.
 * The limiter used to fall back to the `sub` of a Bearer token it never
 * verified, which let a caller name its own bucket.
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
