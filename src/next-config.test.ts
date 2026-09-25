import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The build must not strip the logger's sink. src/lib/logger.ts writes every
 * production line through console (info through console.log), and until
 * 24 Sep 2026 compiler.removeConsole compiled the one console.log it used
 * for every level away, so production logged nothing. Vitest never runs
 * Next's compiler, so the logger's own tests cannot see that; this reads the
 * config as `next build` does, with NODE_ENV=production.
 *
 * `next dev` must not write agent files into the tree. From 16.3 it creates
 * AGENTS.md and CLAUDE.md when it detects an AI coding agent, unless
 * agentRules is false.
 *
 * Every page sends the static security policy: a CSP that holds no
 * script-src (a nonce would force dynamic rendering), a Permissions-Policy
 * and COOP. Until 24 Sep 2026 no page sent any of them, while two comments
 * said a CSP was in place.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('next.config', () => {
  it('keeps console calls in a production build', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();

    const { default: config } = await import('../next.config');

    expect(config.compiler?.removeConsole ?? false).toBe(false);
  });

  it('keeps next dev from writing agent files into the tree', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();

    const { default: config } = await import('../next.config');

    expect(config.agentRules).toBe(false);
  });

  it('sends the static page policy', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();

    const { default: config } = await import('../next.config');
    const routes = (await config.headers?.()) ?? [];
    const page = routes.find(route => route.source === '/:path*');
    const headers = new Map(page?.headers.map(header => [header.key, header.value]));

    expect(headers.get('Content-Security-Policy')).toBe(
      "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'"
    );
    expect(headers.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });
});
