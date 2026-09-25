import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import { config } from './middleware';

/**
 * The matcher is compiled by Next's own unstable_doesMiddlewareMatch, not by
 * a copied regular expression, so the test sees what the build sees. It
 * skips static images, except under /api/, where `PATCH
 * /api/organizations/x.png` is a route call: skipping it once skipped the
 * API budget of 100 calls per address and path per minute.
 *
 * This case lives apart from src/middleware.test.ts on purpose. Importing
 * Next's testing helper installs Next's node-environment patches, and their
 * console wrapper throws "AsyncLocalStorage accessed in runtime where it is
 * not available" outside a Next server, so a log line anywhere in the same
 * file would fail with that instead of its own result. Vitest isolates each
 * file, which keeps the patches away from the behavioural middleware tests.
 */

describe('middleware matcher', () => {
  it('runs on API paths that end in an image extension and skips static assets', () => {
    const runsOn = (url: string) => unstable_doesMiddlewareMatch({ config, url });

    expect(runsOn('/api/organizations/x.png')).toBe(true);
    expect(runsOn('/dashboard')).toBe(true);
    expect(runsOn('/logo.png')).toBe(false);
    expect(runsOn('/_next/static/chunk.js')).toBe(false);
    expect(runsOn('/favicon.ico')).toBe(false);
  });
});
