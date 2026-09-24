-- Sculptors: database roles. Run ONCE per Neon project, as the owner, over the
-- direct (unpooled) host. This is NOT a migration: roles belong to the
-- cluster, and the role's password must never reach git.
--
--   (DATABASE_URL_UNPOOLED is in .env.migrate.local, never .env.local)
--   (umask 077; openssl rand -hex 32 > ~/.sculptors_app.pw)
--   psql "$DATABASE_URL_UNPOOLED"
--
-- then, at the psql prompt:
--
--   \i db/bootstrap-roles.sql
--   \password sculptors_app
--   \q
--
-- \password asks for the password twice: paste the contents of
-- ~/.sculptors_app.pw both times. Put that password only into the pooled
-- DATABASE_URL secret (user sculptors_app, host ...-pooler...,
-- sslmode=verify-full), then `rm ~/.sculptors_app.pw`. To rotate it later,
-- run only the \password step.
--
-- Why this way: the file is readable by the operator alone and sits outside
-- the checkout, so no `git add` can pick it up. Hex needs no escaping in a
-- URL, where base64's + / = would. psql's \password hashes the password as
-- SCRAM on the client and sends only the hash, so the plaintext never
-- crosses the wire or lands in a statement log. This file used to take the
-- password with `-v app_password="$(openssl rand -base64 32)"`, which put it
-- on psql's command line (visible to other local users in the process
-- list), never showed it to the operator, and sent it in clear inside
-- CREATE ROLE.
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
-- sculptors_app from this file, in its earlier -v app_password form; the
-- role already exists there and is not created again. Roles live in the
-- cluster catalog, so every Neon branch created from it carries the role and
-- its password hash.
--
-- Table privileges are granted by drizzle/0002_app_role_grants.sql (0007
-- takes DELETE on the identity tables back), so run `npm run db:migrate`
-- after this file.

-- No password here: \password sets it once this has run (above). Until then
-- the role cannot sign in.
create role sculptors_app with login nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- Role-level settings apply when a backend starts, before PgBouncer
-- multiplexes anything, so they hold behind the transaction-mode pooler
-- where a session SET would not.
alter role sculptors_app set statement_timeout = '15s';
alter role sculptors_app set idle_in_transaction_session_timeout = '10s';

-- Expect: rolsuper, rolbypassrls, rolcreaterole, rolcreatedb all false.
select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
from pg_roles
where rolname = 'sculptors_app';
