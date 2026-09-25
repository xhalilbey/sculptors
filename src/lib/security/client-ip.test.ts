import { describe, expect, it } from 'vitest';
import { clientIpFrom } from './client-ip';

/**
 * The caller's address must not be the caller's choice.
 *
 * X-Forwarded-For is append-only: every proxy appends the address it received
 * the request from. On Cloud Run the real client address is therefore the
 * RIGHTMOST entry, and everything to its left is whatever the client sent.
 * Reading the leftmost entry let a caller choose its own rate-limit bucket by
 * rotating one header, and chose the address WorkOS was told about. These
 * cases moved here from rate-limiter.test.ts when the limiter and sign-in
 * started sharing this helper.
 */

describe('clientIpFrom', () => {
  it('uses the rightmost X-Forwarded-For entry', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '10.0.0.1, 203.0.113.5' }))).toBe(
      '203.0.113.5'
    );
  });

  it('ignores a client-supplied prefix', () => {
    // The attacker sends their own X-Forwarded-For; the edge appends the real
    // address. Two requests forging different prefixes must give the SAME
    // address, or the limiter can be rotated away.
    const first = clientIpFrom(new Headers({ 'x-forwarded-for': 'forged-a, 203.0.113.5' }));
    const second = clientIpFrom(new Headers({ 'x-forwarded-for': 'forged-b, 203.0.113.5' }));

    expect(first).toBe(second);
    expect(first).toBe('203.0.113.5');
  });

  it('tolerates padding and empty entries', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': ' 10.0.0.1 ,, 203.0.113.5 ,' }))).toBe(
      '203.0.113.5'
    );
  });

  it('falls back to x-real-ip when no forwarded chain is present', () => {
    expect(clientIpFrom(new Headers({ 'x-real-ip': ' 198.51.100.7 ' }))).toBe('198.51.100.7');
  });

  it('falls back to x-real-ip when the forwarded chain holds no address', () => {
    expect(
      clientIpFrom(new Headers({ 'x-forwarded-for': ' , ', 'x-real-ip': '198.51.100.7' }))
    ).toBe('198.51.100.7');
  });

  it('answers null when neither header names an address', () => {
    expect(clientIpFrom(new Headers())).toBeNull();
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': ',', 'x-real-ip': ' ' }))).toBeNull();
  });
});
