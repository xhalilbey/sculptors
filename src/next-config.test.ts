import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The build must not strip the logger's sink. src/lib/logger.ts writes every
 * production line through console (info through console.log), and until
 * 24 Sep 2026 compiler.removeConsole compiled the one console.log it used
 * for every level away, so production logged nothing. Vitest never runs
 * Next's compiler, so the logger's own tests cannot see that; this reads the
 * config as `next build` does, with NODE_ENV=production.
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
});
