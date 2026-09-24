import 'server-only';

import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { dbEnv } from './env';

/**
 * The one database handle the app uses: node-postgres against Neon's pooled
 * endpoint (PgBouncer, transaction mode) as the least-privilege role
 * `sculptors_app`. Migrations never come through here; they run as the owner
 * over the direct host (drizzle.config.ts).
 *
 * Nothing on this pool may depend on session state. PgBouncer hands a
 * different backend to each transaction, so `SET`, `LISTEN`, session advisory
 * locks and named prepared statements do not survive. Session defaults live
 * on the role (`ALTER ROLE ... SET`, see db/bootstrap-roles.sql); per-request
 * state is set inside a transaction with `set_config(..., true)` (tenant.ts).
 */

export type Db = NodePgDatabase;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Control-plane repositories accept either, so a caller can group writes in one transaction. */
export type DbExecutor = Db | Tx;

// On globalThis so Turbopack's module reloads in `next dev` reuse the pool
// instead of leaking one per edit.
const globalForDb = globalThis as unknown as { __sculptorsDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__sculptorsDb) {
    const pool = new Pool({
      // The URL carries sslmode=verify-full. An `ssl` option here would be
      // dead config: pg lets the parsed URL override it.
      connectionString: dbEnv().DATABASE_URL,
      // Per instance. Cloud Run runs several; the pooler absorbs the fan-in.
      max: 5,
      idleTimeoutMillis: 30_000,
      // A scaled-to-zero Neon compute takes a moment to wake.
      connectionTimeoutMillis: 10_000,
      // Rotate sockets so an endpoint restart is not discovered by a failing query.
      maxLifetimeSeconds: 900,
      // pg ignores channel_binding in the URL; this is the only switch.
      enableChannelBinding: true,
    });

    globalForDb.__sculptorsDb = drizzle({ client: pool, casing: 'snake_case' });
  }

  return globalForDb.__sculptorsDb;
}

/**
 * Refuse to serve if the app is connected as a role that ignores RLS.
 *
 * Row level security does not constrain a superuser, a BYPASSRLS role, or a
 * table's owner -- and "owner" includes any role holding the owner's
 * privileges through membership. Every role created in the Neon console is a
 * member of neon_superuser, and a single `grant neondb_owner to
 * sculptors_app` would switch every policy off with the role's own flags
 * still reading false. Either would turn the policies into decoration without
 * a test failing, so the server checks at startup (instrumentation.ts).
 *
 * The app role needs no membership at all (db/bootstrap-roles.sql grants it
 * table privileges directly), so any membership is refused rather than
 * judged role by role.
 */
export async function assertDatabaseRole(db: Db | Tx = getDb()): Promise<void> {
  const { rows } = await db.execute<{
    rolname: string;
    rolsuper: boolean;
    rolbypassrls: boolean;
    member_of_any: boolean;
    owns_public_table: boolean;
  }>(sql`
    select
      r.rolname,
      r.rolsuper,
      r.rolbypassrls,
      exists (select 1 from pg_auth_members m where m.member = r.oid) as member_of_any,
      exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p')
          and pg_has_role(r.oid, c.relowner, 'USAGE')
      ) as owns_public_table
    from pg_roles r
    where r.rolname = current_user
  `);
  const role = rows[0];

  const problems = !role
    ? ['the current role is not in pg_roles']
    : [
        role.rolsuper && 'it is a SUPERUSER',
        role.rolbypassrls && 'it has BYPASSRLS',
        role.member_of_any && 'it is a member of another role',
        role.owns_public_table && 'it owns (or holds the owner of) a table in public',
      ].filter((problem): problem is string => typeof problem === 'string');

  if (problems.length > 0) {
    throw new Error(
      'The database role must be a plain SQL-created role that row level security applies to; ' +
        `refusing to start because ${problems.join(', ')}.`
    );
  }
}
