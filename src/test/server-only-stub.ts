/**
 * Stub for the `server-only` package under Vitest.
 *
 * `server-only` throws when resolved through Vite's browser condition, which is
 * how the test runner resolves it. In production the real package still does its
 * job — this alias exists only so server modules are importable in tests.
 */
export {};
