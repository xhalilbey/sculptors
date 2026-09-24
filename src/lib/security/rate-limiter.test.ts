import { describe, expect, it } from 'vitest';
import { getIdentifier } from './rate-limiter';

/**
 * The rate-limit key must not be attacker-controlled.
 *
 * X-Forwarded-For is append-only: every proxy appends the address it received
 * the request from. On Cloud Run the real client address is therefore the
 * RIGHTMOST entry, and everything to its left is whatever the client sent.
 * Reading the leftmost entry let a caller choose its own bucket by rotating
 * one header, which made the login limiter decorative.
 */

function requestWith(
  headers: Record<string, string>,
  ip?: string
): Request & { ip?: string | null } {
  return {
    ip,
    headers: new Headers(headers),
  } as unknown as Request & { ip?: string | null };
}

describe('getIdentifier', () => {
  it('prefers the platform-provided address', () => {
    const id = getIdentifier(
      requestWith({ 'x-forwarded-for': '9.9.9.9' }, '203.0.113.5')
    );

    expect(id).toBe('ip:203.0.113.5');
  });

  it('uses the rightmost X-Forwarded-For entry', () => {
    const id = getIdentifier(
      requestWith({ 'x-forwarded-for': '10.0.0.1, 203.0.113.5' })
    );

    expect(id).toBe('ip:203.0.113.5');
  });

  it('ignores a client-supplied prefix', () => {
    // The attacker sends their own X-Forwarded-For; the edge appends the real
    // address. Two requests forging different prefixes must land in the SAME
    // bucket, or the limiter can be rotated away.
    const first = getIdentifier(
      requestWith({ 'x-forwarded-for': 'forged-a, 203.0.113.5' })
    );
    const second = getIdentifier(
      requestWith({ 'x-forwarded-for': 'forged-b, 203.0.113.5' })
    );

    expect(first).toBe(second);
    expect(first).toBe('ip:203.0.113.5');
  });

  it('tolerates padding and empty entries', () => {
    const id = getIdentifier(
      requestWith({ 'x-forwarded-for': ' 10.0.0.1 ,, 203.0.113.5 ,' })
    );

    expect(id).toBe('ip:203.0.113.5');
  });

  it('falls back to x-real-ip when no forwarded chain is present', () => {
    const id = getIdentifier(requestWith({ 'x-real-ip': '198.51.100.7' }));

    expect(id).toBe('ip:198.51.100.7');
  });
});
