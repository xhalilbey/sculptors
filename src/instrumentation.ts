/**
 * Runs once when a server instance starts (next dev and next start; never
 * during next build).
 *
 * Row level security only binds a role without SUPERUSER or BYPASSRLS. If
 * DATABASE_URL ever points at the owner or a console-created role, every
 * policy silently stops applying; this check turns that into a failed boot.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Imported here, not at the top: this file is also evaluated for the edge
  // runtime, which must never load pg.
  const { assertDatabaseRole } = await import('@/db/client');

  await assertDatabaseRole();
}
