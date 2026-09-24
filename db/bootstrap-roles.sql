-- Sculptors: database roles. Run ONCE per Neon project, as the owner, over the
-- direct (unpooled) host. This is NOT a migration: it carries a password.
--
--   (DATABASE_URL_UNPOOLED is in .env.migrate.local, never .env.local)
--   psql "$DATABASE_URL_UNPOOLED" \
--     -v app_password="$(openssl rand -base64 32)" \
--     -f db/bootstrap-roles.sql
--
-- Put the generated password only into the pooled DATABASE_URL secret
-- (user sculptors_app, host ...-pooler..., sslmode=verify-full).
--
-- Why SQL and not the Neon console: roles created in the console, CLI or API
-- are granted membership in neon_superuser, which has BYPASSRLS. Row level
-- security would not apply to such a role and every policy would be
-- decoration. Roles created with SQL get only the basic public-schema
-- privileges. src/instrumentation.ts refuses to boot on a role that has
-- SUPERUSER or BYPASSRLS, is a member of any role, or owns a table in public,
-- so this mistake fails the start, not an audit.
--
-- Never `grant <role> to sculptors_app`. A member of a table's owner holds
-- the owner's privileges, and RLS does not apply to the owner; the role's
-- own flags would still read false.
--
-- On 2026-09-23 the production project (young-sky-82887799) got its
-- sculptors_app exactly this way. Roles live in the cluster catalog, so every
-- Neon branch created from it carries the role and its password hash.
--
-- Table privileges are granted by drizzle/0002_app_role_grants.sql, so run
-- `npm run db:migrate` after this file.

create role sculptors_app with login password :'app_password'
  nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- Role-level settings apply when a backend starts, before PgBouncer
-- multiplexes anything, so they hold behind the transaction-mode pooler
-- where a session SET would not.
alter role sculptors_app set statement_timeout = '15s';
alter role sculptors_app set idle_in_transaction_session_timeout = '10s';

-- Expect: rolsuper, rolbypassrls, rolcreaterole, rolcreatedb all false.
select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
from pg_roles
where rolname = 'sculptors_app';
