import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Vite resolves tsconfig `paths` natively; no plugin needed.
    tsconfigPaths: true,
    alias: {
      'server-only': new URL('./src/test/server-only-stub.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    // Restores every vi.spyOn to its original after each test, so a spy
    // cannot leak into the next one. It does not keep tests off the network
    // or the database: unit tests mock their modules, and database tests run
    // on in-process PGlite.
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['src/**/*.db.test.ts'],
        },
      },
      {
        // In-process Postgres (PGlite) with the real migrations. No network,
        // but each file boots a database, so it gets more time.
        extends: true,
        test: {
          name: 'db',
          include: ['src/**/*.db.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
