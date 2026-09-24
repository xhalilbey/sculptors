import { defineConfig } from 'drizzle-kit';

/**
 * Migrations run as the database OWNER over the direct (unpooled) host:
 * DDL needs ownership, and Neon's pooler is transaction-mode PgBouncer.
 * The URL lives in .env.migrate.local, which only `npm run db:migrate` loads
 * (node --env-file); Next.js never does, so the app process never holds it.
 * src/db/env.ts also insists on the pooled host and the sculptors_app role.
 *
 * `generate` and `check` need no URL; only `migrate` connects.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  // Bookkeeping lives outside `public`, where the app role has no grant.
  migrations: { schema: 'drizzle', table: '__drizzle_migrations' },
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? '' },
  entities: { roles: { exclude: ['neon_superuser', 'neondb_owner'] } },
  strict: true,
  verbose: true,
});
