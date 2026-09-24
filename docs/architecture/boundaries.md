# Architectural boundaries

Dependencies point inward. The framework is the outermost layer.

```
   app/            routing only — composes everything, nothing composes it
     │
     ▼
   features/       vertical slices (metrics is the first — see below)
     │
     ▼
   lib/            shared infrastructure: identity, workos, security, logger
     │
     ▼
   db/             Drizzle client, schema, withTenant — reached only via lib/identity,
     │               lib/tenancy/resource-check (and, later, a slice's infrastructure/)
     ▼
   types/ config/  pure leaves — depend on nothing
```

## Enforced today (`error`)

These are measured at **zero violations**, so they are errors from day one —
nothing has to be migrated to satisfy them, they only have to stay true.
Enforced by `import/no-restricted-paths` in `eslint.config.mjs`.

| Invariant | Why |
|---|---|
| Nothing imports `app/` (`lib`, `components`, `hooks`, `types`, `config`, `contexts`, `providers`, `db`) | Routing is a leaf. Anything shared between routes belongs below them. |
| `types/` and `config/` import nothing from `src/` | Leaves. A type that needs a helper is not a type. The branded ids (`types/ids.ts`) live here, so the id shapes are written once and every layer, `db/` included, imports them from the leaf. |
| `lib/` does not import `components`, `hooks`, `contexts` | Shared infrastructure must not depend on the application it serves. |
| `app/api/` does not import `components/` | Route handlers are transport, not view. |
| `app`, `components`, `hooks`, `contexts`, `providers` do not import `src/db` or `src/lib/identity` | Routes and UI never hold a database handle: a tenant query cannot be written where the tenant is not known, and the driver never reaches a browser bundle. |
| `components`, `hooks`, `contexts`, `providers` and a slice's `ui/` do not import `src/lib/workos` | The WorkOS client and the session layer hold the server's API key; UI reaches them through a route. `app/` is not in this zone, because its routes are where `lib/workos` is used. `import 'server-only'` at the top of every module but `constants.ts` (the cookie names the middleware reads) is the build-time half of the same fence. |
| A slice's `domain/` imports none of its sibling layers; `application/` and `infrastructure/` import neither `api/` nor `ui/` | See [Feature slices](#feature-slices). Checked on the resolved file, so a relative import counts. |
| The identity handle is opened only by repositories (`@/lib/identity/internal/*` is fenced like `@/db/*`) | `IdentityDb` is sealed: a service holds it to share a transaction between repository calls but cannot run a query with it. `handle.test.ts` fails typecheck if the brand is ever widened back to the executor. |
| `drizzle-orm`, `pg` and `@/db/*` are imported only in `src/db`, `src/lib/identity`, `src/lib/tenancy/resource-check.ts` and tests | `@typescript-eslint/no-restricted-imports`. Everything else calls a service. `lib/tenancy/resource-check.ts` is the one other lib module allowed to see `src/db`: it runs a route's `resource` authorization inside `withTenant` (a branded `ResourceCheck`, so a resolver that bypasses RLS does not type-check). A feature slice's `infrastructure/` is opened here deliberately when the first tenant table lands. |
| Test fixtures (`*.test-utils.ts`, such as `lib/identity/testing.test-utils.ts`) are imported only by tests and the data layer | Same rule. They seed the database directly; a service that imported one would ship a write path around the repositories. |

Tests (`*.test.ts`) count as data-layer code for the database rules: they
may import `drizzle-orm`, `@/db/*` and the identity internals, including
beside a route (a seam test drives the real handler on PGlite). Test
fixtures that seed the database are named `*.test-utils.ts` and are fenced
off from everything but tests and the data layer.

## Backlog

Empty. The two backlogs this section used to list (`src/agent/` reaching
outward, and hooks importing Server Actions) were deleted with the code that
caused them on 22 Sep 2026; see `docs/DECISIONS.md`.

## Feature slices

`src/features/metrics` (the Store Events Panel, 23 Sep 2026) is the first
slice, and the layout every later one follows. The intra-slice rules shipped
as `error` before it existed, so it was held to them from its first line.

```
src/features/<slice>/
  domain/           entities and pure rules. No I/O, no framework, no persistence.
  application/      use cases. Transport-agnostic; take ports as arguments.
  infrastructure/   repositories and adapters. No HTTP, no React.
  api/              route handlers, server actions, browser fetch clients.
  ui/               components, hooks, providers.
  index.ts          public surface (client-safe)
  server.ts         public surface (server-only)
```

The layer rules come in two halves. Which sibling layer a file may import
is an `import/no-restricted-paths` zone in `LOCKED_ZONES`, and a zone
compares the file the import resolves to, so `../ui/x` counts the same as
`@/features/<slice>/ui/x`: `domain/` imports none of `application/`,
`infrastructure/`, `api/` or `ui/`, and `application/` and
`infrastructure/` import neither `api/` nor `ui/`. `infrastructure/`
importing `application/ports` is the adapter implementing its port, and is
allowed. Which packages a layer must not import (`next/*` and `react` kept
out of `domain/`, `next/server` and `react` out of `application/`,
`next/server` out of `infrastructure/`) is
`@typescript-eslint/no-restricted-imports` per layer, which reads the
specifier as written; a package has no other spelling. Until 24 Sep 2026
the sibling layers were specifier patterns too, on `@/features/...` only,
while the slices import their own layers relatively, so a relative import
walked past them.

Slices are black boxes to each other: cross-slice imports go through
`@/features/<slice>` or `@/features/<slice>/server`, never a deep path.
That rule (`CROSS_SLICE`) is still a specifier pattern: it catches a deep
`@/features/...` path, and a relative path into another slice is caught
only where a layer zone forbids the layer it lands in.

`metrics` in that layout: `domain/` holds the metric definitions and the
hour-precision time model, `application/` the two use cases and the
`MetricsSource` port they take, `infrastructure/` the deterministic demo
source, `api/` the wire schemas and the browser client, `ui/` the screens.
The `/api/metrics` routes import `@/features/metrics/server`; the pages import
`@/features/metrics`.

`health` (System Health, 23 Sep 2026) is the second, in the same shape:
`domain/` the components, statuses and incidents, `application/` the
report and its `HealthSource` port, `infrastructure/` the demo source,
`api/` the wire schema and client, `ui/` the screen. `/api/health` imports
`@/features/health/server`; the settings page imports `@/features/health`.

`agents` (Agent Suite, 23 Sep 2026) is the third: `domain/` the agent
profile (identifier, culture, rules, skills) and its limits, `application/`
the save use case and the `AgentProfileStore` port, `infrastructure/` the
browser store the demo keeps it in, `ui/` the screen and its draft hook. It
has no route yet: the agent API is not designed, and the store port is where
it will plug in.

`pipelines` (23 Sep 2026) is the fourth, in the same shape as `agents`:
`domain/` syncs and jobs, their triggers, filters and sort, `application/`
the create, favorite and delete actions on a `PipelineStore` port,
`infrastructure/` the browser store, `ui/` the list and the create dialog.
The dropdown and the modal it needed are shared, in `components/ui/`.

`commerce` (23 Sep 2026) is the fifth: `domain/` products, customers and
orders with their filters and sorts, `application/` the three reads on a
`CommerceSource` port, `infrastructure/` the deterministic demo source,
`api/` the wire schemas and client, `ui/` the Products, Customers and Orders
pages. `/api/products`, `/api/customers` and `/api/orders` import
`@/features/commerce/server`.

`organizations` is the next candidate: its code already uses that name
throughout (`components/organizations`, `contexts/organization-context`,
`lib/clients/organizations.client.ts`, `types/api/organizations.ts`).

## Running the check

```bash
npm run lint          # boundaries included
npm run verify        # typecheck + lint + route guards + tests
```

`scripts/check-route-guards.mjs` is a separate ratchet covering a different
property: every state-changing route handler must carry an auth/origin guard,
and every deliberately public one (`definePublicRoute`) must be listed in its
`PUBLIC` map.

## The database boundary at runtime

Lint keeps the driver out of routes; Postgres keeps tenants apart. The app
role (`sculptors_app`) has no `BYPASSRLS`, every table has RLS, and a tenant
table's policy admits only rows whose `organization_id` equals
`app.organization_id` — which only `withTenant(ctx.tenant.organizationId, …)`
sets, inside a transaction. `src/db/schema.db.test.ts` fails any table with an
`organization_id` column that lacks that policy.
