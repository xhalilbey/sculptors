/**
 * The caller's address, as our own edge saw it.
 *
 * X-Forwarded-For is append-only: each proxy adds the address it received
 * the request from, so the rightmost entry is the one written by our own
 * edge and everything to its left is whatever the client claimed. Reading
 * the leftmost entry let a caller pick its own rate-limit key by sending its
 * own X-Forwarded-For, which made the login limiter bypassable by rotating
 * one header, and it sent WorkOS an address the caller chose.
 *
 * This trusts exactly one hop: Cloud Run, reached directly. If the
 * deployment ever sits behind an additional proxy (an external load
 * balancer, say), this needs to skip that many entries from the right.
 *
 * The rate limiter and the sign-in context both read the address here.
 * Before 24 Sep each had its own parser, with opposite trust rules. The
 * Edge middleware reaches this module through the limiter, so it uses no
 * Node APIs and is not server-only.
 *
 * Falls back to X-Real-IP, and answers null when neither header names an
 * address.
 */
export function clientIpFrom(headers: Headers): string | null {
  const hops = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const lastHop = hops.at(-1);

  if (lastHop) {
    return lastHop;
  }

  const realIp = headers.get('x-real-ip')?.trim();

  return realIp || null;
}
