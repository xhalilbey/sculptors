# Sculptors

The web app for Sculptors, an Agent Store for developers. Today it is the
landing page, WorkOS sign-in, organizations, and a dashboard: the Overview
(the Store Events Panel), Agent Suite and System Health run on demo data,
Settings holds the theme, the organization and the account, and Products,
Customers, Orders, Pipelines, API docs and Integrations are empty sections
waiting to be built.

## Stack

- Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript (strict)
- Tailwind CSS 4
- WorkOS AuthKit for identity, sessions and organizations
- Neon Postgres (Frankfurt, Postgres 18) through Drizzle ORM and
  node-postgres; migrations in `drizzle/`, schema in `src/db/schema/`
- Vitest for unit tests and in-process Postgres (PGlite) database tests,
  ESLint (`eslint-config-next`) with architectural boundaries in
  `eslint.config.mjs`

## Identity and organizations

WorkOS is the identity provider. Sign-in, password reset and email
verification go through `src/app/api/auth/workos/*`; the sealed WorkOS
session cookie is the only credential the app trusts.

The tenant is a WorkOS Organization. The session is issued for exactly one
organization, and switching organizations re-issues the session for another
one. Users and memberships are mirrored into the database on sign-in and by
the signature-verified WorkOS webhook (`/api/auth/workos/webhook`), which
applies the SDK's deserialized events, applies a failed event again when
WorkOS redelivers it, and orders every write by WorkOS's own `updatedAt`, so
a late or replayed event cannot undo a newer one. The mirror never grants
access. Organizations are listed, switched and created in Settings >
Organization (`/api/organizations`).

Only sign-in (`src/lib/auth/sign-in.ts`) writes the mirror on a user's
behalf. Every other request resolves the session read-only
(`src/lib/auth/session.ts`), so a user suspended in the mirror stays out
until the row is changed on purpose.

Sign-in is closed to everyone not on the allowlist
(`SCULPTORS_ALLOWED_WORKOS_USER_IDS`); an empty allowlist admits nobody.

`src/middleware.ts` redirects unauthenticated requests for every dashboard
page to `/auth/login` and answers `/api/*` with 401, except `/api/auth/*`.

## Database

The app connects to Neon's pooled host as `sculptors_app`, a role created
with SQL (`db/bootstrap-roles.sql`) so that it has no `BYPASSRLS`; the server
refuses to start otherwise (`src/instrumentation.ts`). Every table has row
level security: identity tables carry an explicit policy for the app role,
and tenant tables (none yet) are isolated by `app.organization_id`, which
only `withTenant` in `src/db/tenant.ts` sets. Migrations run as the owner
over the direct host and never from the app.

Only `src/db` and `src/lib/identity` may import `drizzle-orm`, `pg` or
`@/db/*`; everything else calls a service. Changing the schema:

```bash
# edit src/db/schema/*, then
npm run db:generate -- --name <what_changed>   # writes drizzle/NNNN_*.sql
npm run db:migrate                             # applies it as the owner (.env.migrate.local)
```

Never edit a migration that has been applied; generate a new one.
Grants, triggers and functions go in `drizzle-kit generate --custom` files.

See `docs/DECISIONS.md` for why things are the way they are.

## Environment

Set these in `.env.local`, except the owner's two, which go in
`.env.migrate.local`: Next.js loads `.env.local` into the running server, and
the owner role bypasses row level security, so the app process must never
hold it; the app refuses to start if either is in its environment.
`.env.example` and `.env.migrate.example` list every name the code reads, one
file per destination (names only; never commit values). `NEXT_PUBLIC_*`
values are inlined by Next.js at BUILD time, into the server bundle as well
as the browser's: changing one in Cloud Run without rebuilding the image
changes nothing. Keys nothing reads any more were moved to
`.env.archive.local` (ignored, not loaded by Next.js).

| Variable | Purpose |
|---|---|
| `WORKOS_API_KEY` | WorkOS server key |
| `WORKOS_CLIENT_ID` | WorkOS client id |
| `WORKOS_COOKIE_PASSWORD` | Seals the session cookie |
| `WORKOS_REDIRECT_URI` | Optional; defaults to `NEXT_PUBLIC_APP_URL` + `/api/auth/workos/callback` |
| `WORKOS_WEBHOOK_SECRET` | Verifies WorkOS webhook signatures |
| `SCULPTORS_ALLOWED_WORKOS_USER_IDS` | Comma-separated sign-in allowlist |
| `SCULPTORS_OWNER_WORKOS_USER_ID` | Legacy single-user allowlist entry, still honoured |
| `NEXT_PUBLIC_APP_URL` | The app's origin (scheme, host and port), for same-origin checks and redirects; required in production, `http://localhost:3002` elsewhere when unset |
| `DATABASE_URL` | Neon pooled host (`-pooler`), user `sculptors_app`, `sslmode=verify-full`; the only URL the app reads |
| `DATABASE_URL_UNPOOLED` | `.env.migrate.local` only. Neon direct host as the owner; read only by `npm run db:migrate` |
| `NEON_API_KEY` | `.env.migrate.local` only. Neon API, for provisioning scripts; never read by the app |
| `NEXT_PUBLIC_LANDING_HERO_VARIANT` | Optional landing hero variant |

## Commands

```bash
npm install
npm run dev            # http://localhost:3002 (NEXT_PUBLIC_APP_URL and the WorkOS redirect URI use this port)
npm run build          # production build (output: standalone)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint, boundaries included
npm run test           # vitest run (unit + PGlite database tests)
npm run check:routes   # every state-changing API handler must be guarded
npm run db:generate    # schema change -> new migration in drizzle/
npm run db:migrate     # apply migrations (owner, direct host)
npm run db:check       # migration journal consistency
npm run verify         # typecheck + lint + check:routes + db:check + test
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, route guards, the
migration drift check, tests and build on every push to `main` and every pull
request. It never connects to Neon.

## Layout

```
src/
  app/            routes: landing (marketing)/, dashboard (dashboard)/, auth/, api/
  components/     landing, layout (rail, app shell), organizations, brand, ui
  contexts/       auth (session) and organization providers
  db/             Drizzle client, schema, withTenant, PGlite test harness
  lib/            auth/ (sign-in, per-request session), identity/ (repositories),
                  tenancy/ (resource checks in withTenant), workos/, clients/
                  (browser API clients), validations/, security/,
                  api/define-route.ts, logger
  types/          shared types: branded ids (ids.ts), wire DTOs (api/)
  instrumentation.ts   startup check of the database role
drizzle/               generated and custom SQL migrations (never edited after apply)
db/bootstrap-roles.sql creates the app role, once per Neon project
docs/                  DECISIONS.md, architecture/boundaries.md
```
