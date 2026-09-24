# Decisions

## 2026-09-22 — The tenant is a WorkOS Organization

**Decision.** v2 drops v1's three-table tenancy (`sculptors_tenants` keyed by
WorkOS user, personal `workspaces` looked up by WorkOS user, a local
`workspace_members` table) for one: `organizations`, whose primary key IS
the WorkOS organization id. Memberships live in WorkOS and are mirrored into
`organization_memberships` (on sign-in from the user's own list, by webhook
for changes made elsewhere). The mirror never grants access.

**The active tenant is the session.** WorkOS issues the sealed session for
exactly one organization; switching is `session.refresh({ organizationId })`,
which WorkOS refuses for an organization the user is not in. v1 kept the
active workspace in a separate httpOnly cookie validated by our own lookup —
a mutable client value deciding the tenant. That cookie is gone.

**Compatibility.** *(Superseded 2026-09-23 by "One vocabulary; sign-in vs
per-request session": the names are organization everywhere and the wire
has its own DTOs.)* `auth.context.workspace` keeps its v1 field names
(`tenant_id`, `id`, `workos_organization_id` are all the org id) because 40
files read them; `ensureWorkspaceAccess` and `getWorkspaceTenantBinding` keep
their signatures with new bodies. The renames come with the table port, not
with the auth rewrite, so each change stays reviewable.

**RLS is on with no policies, on purpose.** *(Superseded 2026-09-23 by
"Neon and Drizzle replace Supabase": every table has an explicit policy for
the app role, which RLS actually constrains.)* WorkOS is the identity provider,
so requests carry no Supabase JWT and claim-based RLS would be theatre. The
server uses the secret key; the publishable key can read nothing. Adding a
policy later must be a decision, not a default.

**Migrations.** *(Superseded 2026-09-23 by "Neon and Drizzle replace
Supabase": migrations are Drizzle's, in `drizzle/`, and `supabase/` is gone.)*
`supabase/migrations/` is the v2 set (one file so far);
v1's 69 migrations moved to `supabase/migrations_v1/` and must never be
pushed to the v2 project.

**Not verified end-to-end.** A WorkOS sign-in needs a browser and the
`:3002` redirect URI registered in the WorkOS dashboard; this environment
has neither. Verified: typecheck, 154 unit tests (webhook fails closed
without a secret, replay is idempotent, access guard refuses tenant/org
disagreement), and on the running app: webhook → 503 with no secret, login
→ 307 to WorkOS with the 3002 callback.


## 2026-09-22 — An organization is created where it is listed

Creating an organization no longer has a page. The switcher in the rail lists
the organizations you belong to; "Create organization" opens a name field in
that same list and the new one appears there, selected, on reload. The
`/workspaces/new` route and `CreateWorkspaceForm` are gone, and with them the
app layout's special case that hid the shell for that route.

**Why:** the list you are adding to should be the list you are looking at, and
a full page for one text field made the product feel bigger and slower than
it is. The category picker went with it: the API accepts exactly one category
today, so asking is theatre.

**Consequence:** the onboarding card (category setup after creation) still
exists and still uses the auth-card frame; that is a different step and was
only reworded from "workspace" to "organization".

## 2026-09-22 — The login screen is Harvey's composition

`/auth/login` is one 320px column on #0f0e0d: a 52px mark, a 36px "Welcome",
one line of context, a single outlined field whose label floats into the
border, and a 52px off-white button — measured from Harvey's Auth0 universal
login and reproduced value for value (ink #fafaf9, muted #8f8b85, 4px radii,
16px field text, 14px label and button). Email first, password on a second
step, like Harvey.

**Why:** Halil's brief (22 Sep) — the login must look like Harvey's, and the
old two-column card with side art did not. Every mode the page had (SSO,
reset, code verification) kept its API route and became the same column with a
different single field.

**Deliberate departure:** Harvey's page ends at the button. Ours keeps
"Continue with company SSO" and "Sign up" below it in the muted tone, because
the product has both and a login page that hides them is a dead end.

**The opening (added the same day):** Harvey does not open on the form; it
opens on a loader — a 96px tile with the mark inside and a blurred light
travelling once a second around its 2px edge (read from their bundle: a
spinning 128px frame carrying a blur-16 disc under an 8%-white ring). The same
loader (`AppLoader`) now sits at every boundary where our app has not decided
yet: the login page until the session check answers (and while the redirect
to the app is in flight), the dashboard shell until the session loads, and
the dashboard's Suspense fallback. Light everywhere -- including on the way
into the dark login: Harvey's loader is the app's theme (white ground,
warm-grey tile, a dark disc), checked against a screenshot of it running, and
the dark ground begins with the form, not before it. The form then fades in
over 250ms, Harvey's own `animate-fade-in`.

**Revised 23 Sep 2026 (owner's direction):** the tile in the middle is ours
now: a raised key like the rail's and the panel's cards (lit from the top, a
white highlight, a soft lifting shadow) with 22px / 20px corners, Harvey's
sweep kept around its 2px edge. The same loader replaced the last two
stand-ins: `app/auth/loading.tsx`, a v1 screen ("Yükleniyor...", stripes,
blurred blobs) that was the first paint of every cold /auth/login, and the
small spinner in the middle of the dashboard's content panel.

## 2026-09-22 — The abandoned product is deleted from the tree

**What.** The product pivoted to an Agent Store for developers, and the old
one is gone from the repository, not hidden: the sales-agent, Meta ads,
sensor/radar, campaign, market brain, enterprise chat, product memory,
revenue, library, playground, competitor, creative studio, agent space,
automations, action, analytics, report and storefront-session pages; every
API route except `auth/*` and `organizations/*`; the in-process LangChain
agent (`src/agent`), the v1 server actions, the RAG/document services and
their components and hooks; the bridge to the Python agent
(`lib/sculptors-agent`, its internal JWT minting and every agent env read);
the vendored Python agent itself; `supabase/migrations_v1/`; 44 npm packages;
about 183 MB of unreferenced `public/` assets; and the old root planning
notes. `/settings` is an empty section like the other rail pages, the rail
lost its Search button and chat history panel, and the middleware now
protects exactly the dashboard directories that exist.

**Why.** Hidden code was not free. It compiled against the v1 schema the v2
database does not have (the Settings page's own API calls 500'd on v2), it
answered requests through routes nobody should call (an unauthenticated
storefront order endpoint among them), it kept 44 packages in the install,
and it made every reader, human or agent, start from a product that no
longer exists. Git
history is the archive: anything here can be read back from the commits
before this one. `migrations_v1/` in particular was a standing invitation to
push v1 tables into the v2 project, which the tenant entry
above forbids.

**Consequence.** What remains is identity (WorkOS), organizations, the landing
page and an empty dashboard shell. `lib/api/define-route.ts` with
`ensure-workspace-access` and `auth-guards` is kept although no route uses it
yet: it is the guard standard the clean-architecture pass builds on
*(23 Sep: the organization routes use it; `ensure-workspace-access` is now
`ensure-organization-access` and `auth-guards` is gone, see "One vocabulary;
sign-in vs per-request session")*. The
Supabase client, the generated database types and the `workspace` naming stay
until the Neon migration, which is the next phase. The future SDK/agent API
is designed from scratch, not revived from the deleted bridge.

**Carried into the Neon phase (found in review, 23 Sep; not done here on
purpose).** None of these is a regression, and each touches identity or
middleware code this phase kept frozen:
- `lib/workos/{auth,client}.ts` and `lib/supabase/server.ts` have no
  `import 'server-only'`, and the ESLint zone fences only `supabase/server.ts`.
  `workos/auth.ts` imports the service-role client, so add `server-only` to
  all three and put `./src/lib/workos` in the zone.
  *(Done 24 Sep 2026: server-only is in both files and lib/workos is fenced
  from components, hooks, contexts, providers and slice ui/ by a
  resolved-path zone; see "Slice layers are checked on resolved paths; UI
  never reaches lib/workos".)*
- The middleware matcher skips every path ending in an image extension,
  `/api/**` included (for example `PATCH /api/organizations/x.png`). The route
  still checks origin and session itself, but it skips the rate limit. Keep
  `/api` out of the extension carve-out. *(Done 23 Sep in the Neon phase: the carve-out
  no longer applies under `/api/`.)*
- `POST /api/auth/workos/{password,password-reset,email-verification}` have
  no rate limit: `LOGIN` matches only `/auth/` pages, and `API_READ` skips
  `/api/auth/`. The limiter is also per instance, in memory. Its unused
  `SIGNUP`/`FORGOT_PASSWORD`/`VERIFY_EMAIL` budgets were deleted with the
  other dead exports; set the budgets when the routes are wired.
  *(Done 24 Sep 2026 for a per-address budget; see "Sign-in submissions are
  throttled, page views are not". Still in memory and per instance;
  per-email keys wait for a shared store.)*
- There is no page that completes a WorkOS password reset.
  `POST /api/auth/workos/password-reset` still has WorkOS send the email, but
  the deleted `/auth/reset-password` page was Supabase-only (it waited for a
  `#type=recovery` hash) and could never finish a WorkOS reset, so no working
  flow was lost. If the WorkOS dashboard's password-reset URL points at
  `/auth/reset-password`, that link now 404s instead of bouncing to the
  forgot form. Owner: check that URL; the next phase builds the page that
  calls `resetPassword` with the emailed token.
- Pages are gated by the session cookie being present, not valid. The first
  page that renders data on the server must validate the session itself.
- Owner, by hand: `.env.local` still holds about 34 keys nothing reads (the
  Python agent's ClickHouse/Qdrant/memory-worker settings, `OPENAI_API_KEY`,
  `SUPABASE_STORAGE_BUCKET`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Keep
  the `DATABASE_URL*`/`NEON_*` keys for this phase.
  `SCULPTORS_ALLOWED_WORKOS_USER_IDS` is read but unset, so sign-in rests on
  `SCULPTORS_OWNER_WORKOS_USER_ID` alone. The removed
  `.next.stuck-20260612-0148/` stays in history with source maps of the old
  server code. It holds no secret beyond a public anon key, so rewriting
  history is optional.

## 2026-09-23 — Neon and Drizzle replace Supabase

**What.** The identity mirror (users, organizations, memberships, the
WorkOS webhook log) lives in Neon (project `young-sky-82887799`, Frankfurt,
Postgres 18) and is reached through Drizzle ORM 0.45 over node-postgres.
The schema is TypeScript in `src/db/schema/`, migrations are generated SQL
in `drizzle/` plus two hand-written ones (the `updated_at` trigger, the app
role's grants), and row types are inferred from the schema. Supabase is
gone from the code, the dependencies and the repository: the service-role
client, both database type files, the `db:types` script, the CLI, the
`supabase/` directory and its MCP entry. The v2 Supabase project never had
a table, so no data moved; the mirror rebuilds from WorkOS at sign-in.

**Why.** The Supabase service key bypassed row level security, so RLS was
decoration ("on, no policies" in the entry of 22 Sep) and tenant isolation
rested on every query remembering a `where`. With Neon the app connects as
a role the database actually constrains.

**How access is decided.**
- *The app role is created with SQL, not in the Neon console.* Console
  roles join `neon_superuser`, which has `BYPASSRLS`. `sculptors_app` was
  created on 23 Sep with `db/bootstrap-roles.sql` (no superuser, no
  BYPASSRLS, `statement_timeout` 15s, `idle_in_transaction_session_timeout`
  10s); its password lives only in `.env.local` / the deployment secret.
  It connects through the pooled host; `src/db/env.ts` refuses any other
  user, host or `sslmode`.
- *RLS is on for every table.* Default-deny for this role, so each table
  says who may do what:
  - identity tables are control plane, read across organizations by design
    (listing a user's organizations is the sign-in path), and carry one
    explicit `<table>_app_all` policy for the app role;
  - tenant tables (none yet) get `tenantPolicy()`: rows are visible and
    writable only when `organization_id = current_setting('app.organization_id')`,
    which only `withTenant` sets, per transaction (safe behind the
    transaction-mode pooler). Repositories also filter by the organization,
    so a misconfigured role degrades to filtered, not to a leak.
  A PGlite test fails any `organization_id` table without that policy.
- *The owner runs migrations,* over the direct host
  (`npm run db:migrate`, `DATABASE_URL_UNPOOLED`). That URL and
  `NEON_API_KEY` live in `.env.migrate.local`, which only `db:migrate`
  loads (`node --env-file`); Next.js loads `.env.local` into `next dev` and
  a local `next start`, so keeping the owner (`BYPASSRLS` on Neon) there
  would have put it in the app's process even with no code reading it. When
  deploy is wired, the Cloud Run service gets only `DATABASE_URL` and the
  migration job only the unpooled URL. The app role has no grant on schema
  `drizzle` (the migration bookkeeping) and cannot create objects in
  `public`. Default privileges make every table a
  later migration creates usable by the app role without a new grant.
- *The server checks itself.* `src/instrumentation.ts` refuses to start if
  the connected role is a superuser, has `BYPASSRLS`, is a member of any
  role, or owns (directly or through membership) a table in `public`, so a
  wrong `DATABASE_URL` or a stray `grant neondb_owner to sculptors_app`
  fails the boot instead of silently switching RLS off. `dbEnv` likewise
  refuses to start while `DATABASE_URL_UNPOOLED` or `NEON_API_KEY` is set
  in the app's environment: keeping them in `.env.migrate.local` was a
  convention, and the template sat one copy away from `.env.local`, so the
  templates are now split too (`.env.example`, `.env.migrate.example`).
  Tables are not `FORCE ROW LEVEL SECURITY`: the only owner is
  `neondb_owner`, which has `BYPASSRLS` on Neon, so forcing would change
  nothing.
- *Only the data layer touches the database.* ESLint allows `drizzle-orm`,
  `pg` and `@/db/*` in `src/db`, `src/lib/identity` and tests; routes get
  `ctx.tenant` from `defineRoute`, never a handle. The fence checks the
  resolved file as well as the specifier, so a relative `../../db/client`
  is refused like `@/db/client`, and a dynamic `import('pg')` is refused too.
  Outside the data layer an `import()` or `require()` must name its module
  with a plain string: a template literal or variable has no value either
  rule can read, so `` import(`pg`) `` used to pass.

**Consequences.**
- Owner rights for `PATCH /api/organizations/[id]` are confirmed with
  WorkOS (`isOwnerInWorkOS`) before any change. The mirror's role is only
  refreshed at sign-in and by webhooks that applied, and the rename is made
  with the server's API key, so WorkOS would not refuse it for us; before
  this, an admin demoted or removed in WorkOS kept rename rights for the
  life of their session. The switch route needs no such check: WorkOS
  itself refuses an organization the user is not in.
- Membership sync at sign-in is one transaction now; a failure leaves the
  mirror as it was instead of half updated (a failed retire of stale rows
  used to be only a warning).
- The organization routes and the webhook use `defineRoute` /
  `definePublicRoute`. The route-guard ratchet has no exceptions left and
  lists public mutations separately, so the public wrapper is not a way
  around it.
- Applied migrations are never edited: Drizzle's migrator applies by
  timestamp, not by hash, so an edit would be silently skipped. CI checks
  the journal and fails on a schema change without a migration.
- Tests run the real migrations on in-process PGlite (same Postgres major);
  there is no Docker database and CI never connects to Neon.
- Neon's live catalog matched PGlite on 23 Sep, read as `sculptors_app`
  (the catalogs are world-readable, so the owner's URL is not needed for
  this): RLS on for all four `public` tables, one PERMISSIVE `ALL` policy
  each, `TO sculptors_app` only, no policy or table grant to `PUBLIC`, the
  app role's grants are exactly `SELECT/INSERT/UPDATE/DELETE`, default
  privileges from `neondb_owner` give later tables the same, and the role
  has `USAGE` without `CREATE` on `public` and nothing on `drizzle`.
  *(Superseded 2026-09-24 by "The app role cannot delete identity rows",
  below: the identity tables no longer grant DELETE.)*
- A WorkOS webhook whose apply step fails is answered 500, and WorkOS's
  retry is then acknowledged as a duplicate without being applied (the
  event id was recorded first). The failure is kept in
  `workos_webhook_events.error`; replaying it is a deliberate act, not
  automatic. This was already true on Supabase. *(Superseded the same day by
  "A failed webhook is applied again when WorkOS redelivers it", below.)*
- `.env.local` holds only keys the code reads. The 38 retired ones (the
  Supabase keys, the old `NEON_DATABASE_URL*` owner URLs, the deleted agent's
  Qdrant/ClickHouse/memory-worker/JWT/OpenAI settings) moved verbatim to
  `.env.archive.local`, ignored by git and not loaded by Next.js. Owner: rotate
  or revoke them at their providers; the Supabase secret key in particular
  still opens the v2 project. `.env.example` lists the names the app reads,
  `.env.migrate.example` the owner's.

## 2026-09-23 — A failed webhook is applied again when WorkOS redelivers it

**Decision.** `workos_webhook_events` rows whose `processed_at` is null are
applied again when WorkOS delivers the same event id. Recording is one
statement: `insert ... on conflict (id) do update set attempts = attempts + 1,
error = null where processed_at is null returning (xmax = 0)`. A new id is
'recorded', a known unprocessed one is a 'retry', a processed one returns no
row and is a 'duplicate', the only outcome acknowledged without applying.
`attempts` (migration `0003_webhook_attempts`) counts the deliveries.

**Why.** The bullet above made a failed apply permanent in practice: WorkOS
retries on a 500, the retry was acknowledged as a duplicate, and the fix was
"a deliberate replay" with no tool or runbook to do it. The mirror then
stayed wrong until the user's next sign-in, which for a membership removed
elsewhere is exactly the window that matters. Applying is idempotent (every
mirror write is an upsert), so applying twice is safe where acknowledging a
failure was not.

**Consequence.** An event that can never apply (a CHECK violation) is retried
for as long as WorkOS retries it and stays unprocessed with its error; the
error column shows the latest attempt's reason. Out-of-order deliveries are a
separate problem, handled by ordering mirror writes on WorkOS's own
timestamps.

## 2026-09-23 — One vocabulary; sign-in vs per-request session

**What.** The architecture pass after the Neon move, in one place:

- *One vocabulary.* The server, the client, the files and the JSON say
  organization; the 22 Sep compatibility names (`workspace`, `tenant_id`,
  `AppWorkspace`, `ensureWorkspaceAccess`) are gone.
- *Wire DTOs.* `OrganizationDto` and `SessionUserDto` (`src/types/api`) are
  camelCase, produced by one server mapper (`lib/workos/dto.ts`) and parsed
  with Zod in the browser (`lib/clients/*.client.ts`), never cast. Server
  and client are both ours, so a contract changes on both sides in one
  commit; there are no aliases for callers that do not exist. The two
  response envelopes (`{success, ...}` and `{error}`) stay as they are.
- *Sign-in vs per-request.* Only sign-in (`lib/auth/sign-in.ts`) upserts
  the user, syncs memberships from WorkOS, creates a first organization and
  binds the session. Every other request (`lib/auth/session.ts`
  `resolveSession`) reads the sealed session and the mirror, in a read-only
  transaction, and writes nothing but a last_seen_at at most every 15
  minutes. A suspension written to the mirror therefore sticks, and a GET
  never creates anything in WorkOS. Refreshing a session is the caller's
  choice: route handlers can store the rotated cookie; Server Components
  cannot and must not refresh.
- *The identity handle is opaque.* `IdentityDb` is a sealed value only a
  repository can unwrap (`lib/identity/internal/handle.ts`); a service
  holding one cannot run a query.
- *Resource checks run in the tenant.* `defineRoute`'s `resource` authz
  takes a branded `ResourceCheck` (`lib/tenancy/resource-check.ts`) that
  runs inside `withTenant`, so a resolver that bypasses RLS does not
  type-check.
- *Webhooks.* Events are the SDK's deserialized (camelCase) `Event` union;
  a redelivery of an event whose apply failed is applied again (see
  "A failed webhook is applied again when WorkOS redelivers it"); every
  mirror write is ordered by WorkOS's own `updatedAt` (`workos_updated_at`),
  and a deletion stamps its event time, so out-of-order deliveries and stale
  sign-in snapshots cannot undo a newer state.
- *Email is not unique.* The WorkOS user id is the identity; the unique
  index on `lower(email)` locked out a new user whose address a deleted one
  had held. A plain index remains for lookups.

**Why.** Each of these closed a gap that review alone was holding shut (a
service could query through the identity handle, a resolver could skip
RLS, a request could reactivate a suspended user) or a bug the tests could
not see because they fed each side of a seam with hand-made data (every
membership webhook was a silent no-op). The seams now have tests that cross
them: signed webhook payloads through the real SDK and route onto PGlite,
the real SDK over a two-page fake transport, and resolveSession on PGlite
with every repository call spied.

**Consequences.** Migrations `0003`-`0005` are applied to the Neon dev
branch. Webhook events already marked processed in dev were not re-applied;
each affected user's memberships resync at their next sign-in. Visible
changes were limited to two unreadable surfaces (the context panel heading
and the mobile header bar, both white on white).


## 2026-09-23 — Organizations have no category; setup is the login column

The screen shown after sign-in for an organization nobody has set up is now
the login column (components/auth/auth-column.tsx, shared with the login page
and, later, the password-reset page): "Welcome", "Set up your organization to
continue.", one floating-label field for the name, Continue, and a quiet
"Log out" under it. The v1 card (white panel, orange Next, "What are you
building?") is deleted, as are ui/button and ui/input, which only it used.

The organization category is gone end to end: the picker, the `category`
field of OrganizationDto and both request bodies, the service and repository
parameters, the sidebar switcher's second line ("E-commerce" / "Choose
organization type"), and the `organizations.category` column with its CHECK
(migration 0006_drop_organization_category).

**Why:** the owner's direction (23 Sep): there is no need to ask for
e-commerce any more. The category came from v1's three product lines
(e-commerce, mobile apps, mobile games); after v2 kept one, the question had
one answer and decided nothing, and a column nobody reads is a promise
nobody keeps. If the agent engine later needs an industry per organization
(grocery, marketplace, beauty), it is a different field set by us, not
chosen on a form.

**Consequence:** the organization request bodies are strict objects now, so a
client that still sends `category` (or any unknown field) gets a 400 instead
of having it silently dropped. The production Neon branch is at migration
0002; 0003–0006 are applied to `dev` only and go to production with the first
deploy's migration step.


## 2026-09-23 — The rail is the only navigation

The white panel that opened beside /products and /orders ("Agent Store":
Products, Orders) and beside /settings ("Settings": Health) is deleted, with
the two section configs that fed it (PRODUCTS_NAV_ITEM, SETTINGS_NAV_ITEM),
`NavItem.children`, and the panel's CSS tokens. Pages take the full width
beside the rail.

**Why:** the owner's direction (23 Sep): none of the pages will have it any
more. Every page it listed was already a rail entry, so it was a second copy
of the rail that cost every page it appeared on 292px.

**Consequence:** a rail entry is lit when it is the longest href that owns
the page, one rule for every entry including Settings. So /settings/health
lights Health alone (Settings used to light too, as its section), and a page
with no entry of its own lights the entry above it (a metric chart under
/dashboard lights Overview). The mobile header bar now names every rail page;
it used to fall back to "Overview" on pages outside the main group, such as
Integrations. If a section ever needs sub-pages again, they belong inside
the page (tabs), not in a second rail.


## 2026-09-23 — The rail's two sides are Store and Ads; Ads is not open yet

The switch at the top of the rail reads Store | Ads (it was Developers |
Guides). Store holds the pages the rail already had. Ads cannot be clicked;
its icon and label are lit by a slowly drifting rainbow and it carries a
small white "Soon" tag on its top corner. It gets pages, a route and a real
tab when the Ads side is defined. The switch keeps no state until then.

Integrations, API docs and Health were the Developers | Guides tabs' own
entries. They belong to neither side, so they moved to the rail's foot with
Settings, where they will stay visible on both sides.

**Why:** the owner's direction (23 Sep): split the switch into Store and
Ads, make Ads not reachable yet with a small white "Soon" tag in the top
corner, and light its icon and label in a Framer-like moving rainbow that
draws the eye without shouting.


## 2026-09-23 — The Store Events Panel runs on demo metrics

The rail's Overview is the Store Events Panel: nine tiles (engaged users,
revenue, add to cart, purchases, catalogs, comparison pages, discovery pages,
cancellations, refunds), each opening its own chart page, and a wide revenue
panel under them. It is `src/features/metrics`, the first feature slice.

- **Numbers are demo numbers**, from a deterministic generator behind a
  `MetricsSource` port: the same organization and hour always give the same
  figures, and they hang together as one funnel. A live source replaces it in
  `features/metrics/server.ts` and nothing else changes; every response says
  which answered in its `source` field. The page carries no "demo" label: the
  owner asked for the heading to be the panel's name alone.
- **Ranges** are RevenueCat's: Custom, Today, Yesterday, 7D, 30D, 3M, 6M,
  12M, in the URL. Time is kept in whole UTC hours so Today can be drawn by
  the hour; presets end at the midnight that starts today, and Today is
  compared with the same hours yesterday.
- **Clipped buckets** (a week or month the range's edge cuts) are drawn
  dotted and labelled partial, so a calendar edge does not read as a fall.
- **Dark cards on the white page**, after the WorkOS AuthKit tile: the
  number in a translucent brand-blue band. The owner tried light cards (with
  a solid blue band) for an afternoon and went back to these. Green and red
  are status colours and always come with an arrow and a sign. The heading
  is 32px bold.
- **No filters on the tiles themselves and no hover movement**, both at the
  owner's direction.

**Consequence:** `/api/metrics` and `/api/metrics/[metric]` are session-bound
GET routes (`defineRoute`, `session-organization`). Custom ranges are refused
when they end in the future or run past two years.


## 2026-09-23 — Dead ends get a page of their own

A missing page (404), a route that throws, a dashboard page that throws, and
a render error caught by the app's ErrorBoundary all show the same scene:
large block numerals (404 or 500) on a faint isometric grid, with a lantern
that follows the pointer and lights the blocks in the brand's button blue,
and beside them one sentence and the ways out (Try again, Back home). Inside
the dashboard the scene fills the content panel, so the rail stays usable.

**Why:** the owner asked for these pages to be impressive, pointing at
Cursor's 404. The idea is theirs (3D numerals, isometric ground, a lantern);
the drawing is ours: the numerals are generated from bitmaps as extruded
cubes (components/errors/voxel-scene.ts), not Cursor's artwork. The ground is
light, like the rest of the app. The ErrorBoundary used to say "Unable to
connect to Sculptors", which is not what a render error is.

**Consequence:** config/strings.ts and lib/image.ts lost their last callers
(the old error pages) and are deleted. public/clay.png is no longer
referenced from the app.


## 2026-09-23 — Log out is on the rail; the rail stays black

Log out is a row at the foot of the rail, under Profile. It existed only
inside the Profile menu, where the owner could not find it. The menu's item
says "Log out" too now, like the setup screen.

The rail spent the afternoon in light greys and white (after the HockeyStack
sidebar the owner pointed to), then the owner brought it back to black with
white text, and the dashboard panels back to the dark cards they had before
the light experiment (translucent blue bands included). The shell ground is
back to #f7f6f4 with them.

Then the content panel itself went dark (#0d0d0f, a step lighter than the
rail and a step darker than the cards): everything on it -- headings, the
range bar and its custom-range dialog, the bucket-size control, the metric
table, the in-panel loader and the in-panel error scene -- takes a dark
tone. The shared charts, the delta pill and the error scene each carry a
`tone` for this.


## 2026-09-23 — Two themes, a floating rail, and Settings holds the account

- **Themes.** Settings > Appearance offers Dark (the default) and Grey, kept
  in the browser (`hooks/use-dashboard-theme.ts`). The shell's root carries
  `data-dashboard-theme`; globals.css turns it into the rail, page, text and
  card tokens. Dark is a #1a1a1a rail over a #141414 page with dark cards and
  translucent blue bands; Grey is a #f1f1f1 rail over #f7f7f7 with light
  cards and solid brand-blue bands, and its active rail key is the landing's
  "Book a demo" button. Charts, delta pills and the error scene take the
  theme as a `tone`.
- **The rail floats.** Pinning it to the window's edge was tried and the
  owner wants it floating, rounded and lifted (their words: very important).
  The page around it has no frame: its ground is the page's own colour.
- **The rail's top is the wordmark**: the mark and "Sculptors" as the
  landing page sets it (Super Sans, weight 600, tight tracking).
- **Settings holds the account.** Switching and creating organizations, and
  Log out, moved off the rail into Settings (Organization, Account). The
  rail's Profile row opens Settings > Account. The rail's profile menu,
  organization switcher and the dropdown hook they shared are deleted.


## 2026-09-23 — No Profile row on the rail

The owner removed it: Settings, already in the rail's foot, reaches the
account, so the row only repeated it. Its avatar with the fallback to the
initial (`AvatarMark`) now draws the account in Settings, which before
showed a broken picture if the provider's image failed to load.


## 2026-09-23 — The Grey rail is greyer

At #f1f1f1 beside the #f7f7f7 page the Grey theme's rail read as white (the
owner: too close to white). It is #e8e8e8 now, so the rail, the lighter
page and the near-white raised block are three distinct steps. The Settings
picture of the theme follows it.


## 2026-09-23 — Ads shimmers in Bending Spoons' green

The owner asked for the Ads rainbow to go: purples first, then Bending
Spoons' green, the #C7FF9F bendingspoons.com sets its emphasis in. On the
dark rail it is that green with a paler glint passing; on the Grey rail,
where #C7FF9F would vanish, the same hue deepened (#3f7f14). The drift is
unchanged. The classes and the megaphone are named for a shimmer now
(`rail-shimmer-*`, `ShimmerMegaphone`), not a rainbow.


## 2026-09-23 — System Health: our own system, as a status page

The owner asked for Health to summarise our system the way status.cursor.com
does, on a panel like the Store Events Panel but in its own colours.

- **What it shows.** A banner with the state now and the 90-day uptime; six
  tiles (uptime, API p95 latency, error rate, agent first reply, first-try
  webhook delivery, events processed) for the last 30 complete days against
  the 30 before; every component with 90 days of status bars; the latest
  five incidents with their updates. Routes: `GET /api/health`
  (session-organization, no-store). Slice: `src/features/health`.
- **Emerald, not blue.** The tiles' bands, the banner and the bars are
  emerald where the Store Events Panel is blue, so the page is known at a
  glance; amber and red keep their status meaning.
- **A day's colour.** A declared incident says how bad its day was: minor
  is degraded (amber), major is an outage (red), as on a status page. A day
  without one is judged by its uptime (99.9% / 99%), since probes can see
  downtime nobody declared. The system's day is its worst component's.
- **Shares change in points.** Uptime, error rate and delivery show their
  change in percentage points (`+0.02 pp`): as a ratio 99.98% against
  99.95% reads "0.0%". `ChangeScale` in `lib/change.ts`, `scale` on the
  delta pill.
- **Uptime is bars, not a line.** As a sparkline it is flat at 100% with
  cliffs; its tile shows the 30 days as status bars instead.
- **Recent incidents, not the last seven days.** A week of "No incidents
  reported." said nothing; the list is the latest five of the 90 days.
- **Demo data.** Deterministic, about one day in five with an incident,
  never today. `source: 'demo'` in the response until probes and an
  incident log replace it in `health/server.ts`.


## 2026-09-23 — Agent Suite: the store's agent in four steps

The owner asked for Agent Suite as a demo: an Identifier where the agent's
name and model are set and simply updated, then Culture, Rules, and Skills
last. So the page is four numbered cards in that order:

- **Identifier**: the name (40 characters) and one of three models (Claude
  Opus 5.5, Sonnet 5 — the default — and Haiku 4.5), with the agent's mark,
  name, model and voice drawn live above them.
- **Culture**: a voice (Warm, Professional, Playful, Minimal) shown as the
  same answer spoken in it, and a few lines on how the store sees itself.
- **Rules**: up to 20, edited in place, removed with a click, each once.
- **Skills**: the six things an agent does in a store — product answers,
  catalogs, comparison pages, discovery pages, add to cart, order support —
  each a switch. They are the Store Events Panel's metrics, seen from the
  agent's side.

Every edit is a draft until **Save changes** in the bar that rises from the
foot of the page; **Discard** drops it, and a problem (no name, a duplicate
rule) says what is wrong and holds the save. The profile is kept in the
browser per organization behind an `AgentProfileStore` port
(`src/features/agents`): the agent API is not to be designed yet, and when
it is, it replaces the browser store and nothing above the port changes.


## 2026-09-23 — The chosen revenue figure rises as a key

The revenue panel marked its chosen figure with a 2px blue line along the
cell's top; the owner wanted a different effect. The chosen figure now sits
on a raised key inset in its cell -- a top-lit face, a ring light at the
top, a soft shadow, and a faint glow of the chart blue from above -- in the
rail's active-key idiom. Hovering another figure shows a faint key;
switching fades and settles it in (`KPI_KEY` in `metrics/ui/styles.ts`).


## 2026-09-23 — Ads takes no colour

The owner dropped the Ads shimmer altogether: the "Soon" tag says enough.
Ads is the lucide megaphone and the word in the rail's plain text; the
masked-SVG megaphone, the shimmer stops and the `rail-shimmer-*` CSS are
deleted.


## 2026-09-23 — No raised block around the rail's first three rows

Overview, Agent Suite and Pipelines sat in a raised block at the top of the
rail. The owner wanted the block gone and the raised key kept: whatever is
active (a row, Settings, the Store key) is still the top-lit key in Dark and
the "Book a demo" key in Grey. The three rows are ordinary rows now, set
apart from Products by a little space; the nav flag that marks them is
`lead`, no longer `raised`.


## 2026-09-23 — System Health is a status page, as Cursor's and Anthropic's are

The owner asked for Health to be the same as status.cursor.com and
status.claude.com, both Atlassian Statuspage pages. So it is that layout,
in the dashboard's theme: a flat banner with the state now ("All Systems
Operational", Cursor's #1E8542; orange or red when a part is degraded or
down); "Uptime over the past 90 days." over a bordered list of the seven
components, each with its status, 90 bars 3 units wide on a 5-unit step
(a hover tells the day: no downtime, or the status and the incidents), and
"90 days ago — 99.98 % uptime — Today"; then Past Incidents for the last
fifteen days, today first, each incident's title in its impact's colour
and its updates as "Resolved - …" over "Sep 17, 09:57 UTC".

It replaces the emerald health tiles, the gradient banner and the latest-
five incident list of the morning. With the tiles gone the health metrics
(latency, error rate, first reply, webhook delivery, events) and the
percentage-point change scale that only they used are deleted, not kept
unshown. The demo source has an incident about one day in three, near a
real status page's rhythm, so the page shows what an incident looks like.


## 2026-09-23 — Agent Suite is four cards you open, like the panel's tiles

The owner rejected Agent Suite as one long form of four numbered steps:
it should be cards that open, like the Store Events Panel's. So the page is
a 2×2 grid of cards in the tiles' own make -- a clean icon and the title at
the top, a glimpse of what is set in the middle (the agent's mark and
model, the culture's first lines, the first rules, the skills as chips),
and the one thing to know in the blue band at the foot (the name, the
voice, the number of rules, the skills on). Each opens
`/agent-center/<section>`, where that part is edited on a card with the
save bar under it; the back link asks before dropping unsaved changes.
The band moved to `components/ui/surfaces.ts`, since both slices use it.


## 2026-09-23 — Pipelines: a jobs-and-syncs list with Create

The owner showed a data platform's Jobs & Pipelines list and asked for the
same structure, with Create offering our sync and a New Job; the page will
be shaped further with them later. So `/pipelines` is that list: filter by
name or id, All | Jobs | Syncs, Owned by me | Accessible by me | Favorites,
Tags and Run as checklists, and Create on the right. The table has Name
(sortable, with a favorite star and the id), Type, Tags, Run as, Trigger and
Recent runs, a column picker, a row menu with Delete, and the reference's
empty state. Create > Sync asks for a name, what it keeps in step (products,
customers, orders), a trigger and tags; Create > New Job the same without
the data, and never continuous. Nothing runs yet ("No runs yet"), and the
list is kept in the browser per organization behind a `PipelineStore` port
until pipelines run for real. `Dropdown` and `Modal` (on the native
`<dialog>`) are new shared primitives in `components/ui/`.


## 2026-09-23 — Products, Customers and Orders as quiet cards

The owner asked for the three pages as simple, good-looking cards that are
not too colourful, with a search and default filters from the data, and
left the layout to us.

- **Products**: a card per product -- a picture, the name, category and
  SKU, the price, the stock, and what it did over 30 days: units sold and
  times viewed, with the share of views that became a sale. Filters:
  category (as chips with counts) and stock; sorts by sales, views, price
  and conversion. The pictures are the product drawn in one quiet line on a
  soft ground with a gradient floor shadow (no blur, no colour), until the
  store's own photos arrive with its sync; nothing is downloaded.
- **Customers**: the same make -- initials, name and place, segment (New,
  Returning, VIP), orders, spend and product views, and when they were last
  seen. Filters: segment and country; sorts by spend, orders, views and
  recency.
- **Orders**: a live tracking board. Each card is the order, then its way
  to the door as five stops (Ordered, Packed, Shipped, Out for delivery,
  Delivered): reached stops solid, the rest dotted, the current one a
  pulsing brand-blue stop, each with the time it was reached; the carrier,
  the tracking number and when it arrives underneath. The board asks again
  every 15 seconds and says when it last did; orders under 15 minutes old
  are tagged New. Filters: on the way, every step, all.

The data is deterministic demo data per organization from a
`CommerceSource` port, served by `GET /api/products`, `/api/customers` and
`/api/orders` (session-organization, no-store). An order comes in about
every twenty minutes and walks its steps within about half a day, each
step waiting on the one before, so the board moves while it is watched.

## 2026-09-24 — The hero's dashboard lies back on the white, HockeyStack's way

The owner sent HockeyStack's hero and asked for the product dashboard under
the hero copy to look like it, with the marketplace logos running under it,
and confirmed that the painted brush band behind the dashboard goes.

- **The sheet**: the dashboard is drawn flat at 1500x940 and the stylesheet
  tips it back and turns it -- `rotateX(55deg)` after `rotateZ(-30deg)`,
  measured off their hero (top edge climbing ~18deg, left edge falling
  ~45deg). No perspective: theirs is parallel, and parallel keeps the far
  side's text sharp. It scales with the page (stage width / 1560), so a
  phone gets the same picture smaller rather than a crop; a crop to a
  larger scale was tried on a phone and cut the journey chart in half.
  The scale is measured in script (`IsoStage`, a ResizeObserver) and
  written as a number. It was first computed in CSS with
  `tan(atan2(100cqw, 1560px))`, which works in Chromium, but the owner's
  Safari 26.2 showed an empty stage: with the scale pinned to a constant
  the sheet drew, and with the trick back (in `cqw` or `vw`) it vanished
  again. The stylesheet keeps stepped values for the first paint only.
- **The fade**: the stage is masked to white from 54% of its height and at
  the far right, so the sheet runs out instead of ending on an edge. It is
  pulled up under the buttons so its near corner rises beside them; the
  stage takes no pointer events, only the sheet does, so the buttons stay
  clickable.
- **What it shows**: the app's Grey rail (NAVIGATION_GROUPS, real links, the
  Store | Ads switch), the Overview's own metric names (Revenue, Purchases,
  Avg. order value, Engaged users), a conversation journey from six
  channels to Purchased / Dropped, the share of purchases agents closed
  alone, orders closed by month, and a marketplace table. All figures are
  illustrative and a "Demo data" chip in its header says so. The journey's
  geometry is computed (`journey-flow.ts`, tested), so ribbon widths always
  add up to their bars and the headline rate is the weighted one.
- **The strip**: the marketplace marquee moved from under the buttons to
  under the dashboard, with no top margin -- the faded foot is its air.

The old window (black rail, warm ground, slate bars) and its `--color-dash-*`
tokens are gone; so is the band's markup and CSS. `public/hero/brush-band.webp`
stays on disk until the owner says the band is not coming back.

## 2026-09-24 — The landing page gets a dark theme, switched from the footer

The owner asked for a light | dark switch on the landing page, at the very
bottom, to see how the page stands in dark.

- **The switch** sits in the footer's bottom row (Light | Dark, the chosen
  key raised like `.btn-ghost`). The choice is kept per browser under
  `sculptors.landing-theme`, the same shape as the dashboard's theme and
  separate from it. The server renders light; a browser that chose dark
  switches right after hydration, so a reload in dark shows light for a
  moment. If dark stays, a pre-paint script can remove that.
- **Tokens, not a second stylesheet**: three landing tokens
  (`--color-lp-ground`, `--color-lp-ink`, `--color-lp-raised`) in a
  non-inline `@theme` block, so the utilities (`bg-lp-ground`,
  `text-lp-ink/65`) read variables a subtree can swap -- the existing
  `@theme inline` tokens are baked into their utilities and cannot be.
  Every softer ink is a `color-mix` of `--color-lp-ink`. Dark swaps the
  three, supplies a dark raised key (`--key-*`, with the light key as the
  fallback so the error pages' `.btn-ghost` is unchanged), and gives the
  tilted dashboard its own dark surfaces.
- **What keeps its colour**: the blue cards with their light panels and the
  pastel action cards -- pictures of the product and its moments, which
  read on either ground.
- **Fixed on the way**: the action carousel's heading ("Turn customer
  intelligence into measurable sales.") was set in white for the black
  site of 20 Sep and stayed white when the ground turned white, so it was
  invisible; it now takes the page's ink and shows in both themes. The
  footer's oversized wordmark swallowed clicks on the row above it (its
  glyph box rises past line-height 0.82); it is decoration and now takes
  no pointer events.

## 2026-09-24 — The landing page gets faces of its own, after Groq's

The owner asked for better type, like Groq's, and singled out Groq's nav
(pixel capitals, a hairline under the header, a bar under the current item).

- **What was there**: nothing. The stack named "Super Sans VF", which no
  file or `@font-face` provides, and `--font-sans` is an inline theme token
  that never reaches `:root` -- so the page fell through to Tailwind's
  default stack, the system font (SF Pro on a Mac, Segoe UI on Windows).
  The eyebrows' `var(--font-mono)` was undefined for the same reason, and
  one undefined `var()` voids a whole `font-family`, so they were never in
  a mono either.
- **Groq's faces** are esBuild (words) and komuna (labels), both licensed.
  The open faces closest to them, chosen by setting candidates side by side
  against groq.com's own rendering: **Figtree** (warm geometric, round e/o,
  single-storey g) and **Bitcount Grid Single** at 300 (a thin pixel-grid
  mono). Both come through next/font, served from this origin.
- **Where**: Figtree for everything read on the landing; the pixel face,
  in capitals at 0.08em, for the nav, eyebrows, the logo strip's line, the
  footer's headings and small print, and the theme switch. The tilted
  dashboard keeps the sans (it is the product, not a label).
- **The nav**: items fill the header's height over a full-width hairline;
  the pointed-at one turns brand blue and a 2px bar grows onto the
  hairline under it.
- **Weights**: the body's `'wght' 460` setting (for the app's intended
  face) would pin every weight on a variable face to 460, so the landing
  resets it and maps the `super-*` classes to font-weights in the
  components layer, where a `font-*` utility still wins. Headlines are 500,
  as Groq's are; the hero's tracking opened from -0.06em to -0.045em.
- **Not done here**: the app itself (dashboard, auth) still falls through
  to the system font for the same reason.

## 2026-09-24 — Production logs are written by level, and the build keeps them

**Decision.** `next.config.ts` no longer sets `compiler.removeConsole`. The
logger's production branch (`src/lib/logger.ts`) writes one JSON object per
line through the console method of its level: errors through
`console.error` and warnings through `console.warn` (stderr), info through
`console.log` (stdout). Each line carries `severity` (`DEBUG`, `INFO`,
`WARNING`, `ERROR`, the names Cloud Logging reads) beside the old `level`,
and the logger's own keys (`timestamp`, `severity`, `level`, `message`)
are written after the context, so a context key cannot forge them. In the
browser bundle, production info and debug lines return early; errors and
warnings reach the visitor's console.

**Why.** removeConsole stripped every `console.log` from production builds
except `error` and `warn`, and the logger wrote every level, errors
included, with `console.log`. The built server chunk read
`if(this.isProduction)({timestamp:...,...r});else{...}`: the call was gone,
so route 500s, webhook apply failures, access denials and sign-in failures
logged nothing in production. The unit tests could not see it, because
Vitest never runs Next's compiler. The lint rule `no-console` (allowing
only `warn` and `error`, under `--max-warnings 0`) already keeps stray
`console.log` out of the source, so the build transform guarded nothing the
linter does not. Rejected: keeping removeConsole and widening its `exclude`
to `log` (or `info`), which leaves a setting whose only effect is a trap
for the next person who routes a line through another method; and
`process.stdout.write`, which does not exist in the browser bundle.

**Consequence.** Server logs appear in production for the first time, so
redaction now matters (the camelCase keys are a separate fix).
`src/next-config.test.ts` fails if removeConsole comes back, and
`logger.test.ts` pins the method and severity per level. The browser was
silent before; its console now shows sanitized errors and warnings, on
purpose, while info lines (user and organization ids from the auth and
organization contexts) stay out of it. `define-route.ts` logs a 4xx
AppError's text under `reason`, since a context `message` no longer
replaces the line's own.

## 2026-09-24 — Runtime dependencies are audited in CI

**Decision.** Next moves from 16.0.10 to 16.3.6 (`^16.3.6`), which brings
sharp 0.35.4 and Next's own postcss 8.5.23. `npm audit fix`, without
`--force`, lifts nanoid to 3.3.19 and a set of lint and build tools, and
vitest moves to 4.1.11. CI runs `npm audit --omit=dev --audit-level=high`
straight after `npm ci`. `next.config.ts` sets `agentRules: false`.

**Why.** On 24 Sep `npm audit --omit=dev` rated next 16.0.10 critical and
its nested postcss, sharp 0.34.4 and nanoid 3.3.17 high, all of them in
what the Docker image ships. The Dockerfile's `npm ci` would have
shipped them on the first deploy, and nothing in CI looked. Most of Next's
advisories do not reach this app (no `remotePatterns`, no Server Actions,
and a middleware that only checks the cookie is present, by design), but
GHSA-mg66, the Cache Components connection-exhaustion DoS, is scoped to
`cacheComponents: true`, which is ours, and the upgrade is a minor inside
the caret range. The gate omits dev dependencies so an advisory in a build
or test tool, which never reaches the image, does not fail every push, and
it stops at high so a moderate does not either. Rejected: `npm audit fix
--force`, which would take drizzle-kit back to 0.18 and break
`db:generate`; and Dependabot, which opens pull requests on its own and is
the owner's call. eslint-config-next stays at 16.0.10: 16.3 adds
`@next/next/no-location-assign-relative-destination`, which warns on the
four deliberate document navigations to route handlers
(`/api/auth/logout` in `auth-context.tsx` and `settings-screen.tsx`,
`/api/auth/workos/login` on the login page). Its remedy, `router.push`,
first fetches the target as an RSC request; the logout GET refuses any
`Sec-Fetch-Mode` but `navigate`, and the login route redirects to WorkOS,
so these stay document navigations. A disable comment, or an absolute URL
that hides the string from the rule, would be an escape hatch. It is a
dev dependency and in no advisory. Since 16.3,
`next dev` also writes AGENTS.md and a CLAUDE.md that loads it whenever it
detects an AI coding agent. Rejected: committing them, which would let a
dependency author the instructions every agent session reads.

**Consequence.** A new high or critical advisory in a runtime dependency
fails CI until it is upgraded; accepting one instead is an entry here and a
matching change to the gate. Dev-tool advisories are reviewed by hand, and
drizzle-kit's moderate esbuild advisory (through `@esbuild-kit`, its dev
server only) is accepted until drizzle-kit drops that package. `next dev`
now prints an instant-navigation notice for `/dashboard`, whose page
renders behind the client-side auth gate; the production build is
unchanged. npm 10 can no longer resolve a vitest upgrade by itself (its
peer resolver fails on vite's optional `@vitejs/devtools` peer, which
names `vitest@*`); the 4.1.11 entries came from npm 11's resolution and
were checked with npm 10's `npm ci`.

## 2026-09-24 — The client address is the rightmost forwarded hop, everywhere

**Decision.** `src/lib/security/client-ip.ts` exports `clientIpFrom(headers)`:
the rightmost non-empty `X-Forwarded-For` entry, else a non-empty
`X-Real-IP`, else null. The rate limiter's `getIdentifier` keys on it
(`ip:<address>`, or one shared `ip:unknown` bucket), and
`signInContextFrom` sends it to WorkOS as `ipAddress`, which is left out
when it is null. It trusts exactly one hop: Cloud Run, reached directly.

**Why.** There were two parsers with opposite trust rules. The limiter read
the rightmost entry, the one our edge appends; sign-in sent WorkOS the
leftmost, the one the caller writes, so the address WorkOS records and
checks at sign-in was whatever the caller chose. One helper keeps the two
from drifting apart again. The limiter's `request.ip` branch could never
run (Next 15 removed `NextRequest.ip`), and its last fallback keyed on the
`sub` of a Bearer token it decoded without verifying, a bucket the caller
names. Both are gone: a request without proxy headers lands in
`ip:unknown`, as one without a token already did. Rejected: a configurable
hop count now, with no deployment behind a second proxy to set it for; and
keeping the leftmost entry for WorkOS as "the real client", which holds
only while the client is honest.

**Consequence.** Behind an external load balancer or any other extra
proxy, the rightmost entry would be that proxy's address, for WorkOS and
the limiter alike; the hop count changes when the deploy is wired, and is
deferred until then. `client-ip.test.ts` pins the rightmost-hop rule, and
the password route test pins that WorkOS receives the appended address,
not a forged prefix. Keys for real traffic through the middleware are
unchanged.

## 2026-09-24 — Sign-in submissions are throttled, page views are not

**Decision.** `src/middleware.ts` puts
`POST /api/auth/workos/{password,email-verification,password-reset}` on one
budget, `RATE_LIMITS.AUTH_SUBMIT`: ten submissions per address per 15
minutes, the three routes together (one constant key, `auth-submit`, on the
`clientIpFrom` address). The eleventh is a 429 in the routes' own envelope,
`{ success: false, error: 'Too many attempts. Please wait a few minutes and
try again.' }`, with `Retry-After`. The path is matched after decoding:
Next 16.3's production route matcher also sends
`/api/auth/workos/%70assword` and `/api/auth/workos%2Fpassword` to the
password handler, while the middleware sees them as sent. The `LOGIN`
budget, five per 15 minutes on every `/auth/*` page view, is gone. The
webhook, the login GET, the callback, `me` and logout stay outside the
budget, and development still skips it. The two 429 answers share one
builder, `tooManyRequests`. Only a post that would pass the routes' own
`requireSameOrigin` is counted. A foreign or missing Origin spends nothing
and is left to the route's 403. As first written, the budget was spent
before that check, so any page the victim had open could send ten
cross-site form posts and lock their address, and everyone behind the same
NAT, out of sign-in for 15 minutes, without testing a credential.

**Why.** "Carried into the Neon phase" deferred this until the routes were
wired, and they are: the login page posts to all three, and nothing
throttled them, since `LOGIN` matched only `/auth/` pages and `API_READ`
skips `/api/auth/`. The page budget throttled nothing an attacker needs (a
page view checks no credential) and turned a sixth load of the login page
within 15 minutes into a 429. One bucket for the three routes means guesses
cannot be spread across them. The body is JSON because the login page reads
`response.json()` and toasts `error`. Rejected: a key per email (or per
pending token) as well. It needs the parsed body, so it belongs in the
routes, and with sign-in closed to a few allowlisted accounts a per-email
lock would let anyone who knows an address lock its owner out; on
per-instance counters it would not hold either. Rejected: a generous page
budget, which would still protect nothing.

**Consequence.** Users behind one NAT share ten attempts per 15 minutes.
The counters are in memory and per instance, so on Cloud Run each instance
keeps its own ten; a shared store (a Postgres table, or an edge rule in
front of these three paths) is what would make the budget hold across
instances, and what per-email keys wait for. `password-reset` still answers
`{ success: true }` until the budget is spent, and the login page does not
read that answer, so a throttled reset request shows the same neutral toast
as any other. WorkOS's own limits still apply behind this one.
`src/middleware.test.ts` pins the budget, the shared bucket, the key per
address, the encoded path, the development exemption, and that pages, the
webhook, the AuthKit round trip and foreign-origin posts spend none of it.

## 2026-09-24 — Log out ends the session at WorkOS

**Decision.** `GET` and `POST /api/auth/logout` revoke the WorkOS session
before they sign the browser out. `endWorkOSSession` in
`src/lib/workos/logout.ts` unseals the cookie locally
(`userManagement.getSessionFromCookie`), reads the `sid` claim from the
access token's payload without verifying the token, and calls
`userManagement.revokeSession({ sessionId })`, waiting at most three
seconds. Every failure (no cookie, a seal that does not open, a token
without a `sid`, a WorkOS error, the timeout) is logged by its error type
only and ends in the same answer as a success: the redirect to the app
root, at the same URL and status as before, with `wos-session` and
`wos-state` cleared through `lib/workos/cookies.ts`. The route's own copy
of the cookie attributes is gone. Both guards are unchanged: GET only as a
top-level navigation, POST only from our own origin, and neither refusal
reads the cookie.

**Why.** Logout cleared only the browser's cookie. WorkOS still held the
session as live, so a copy of the cookie taken before logout (it lives up
to 30 days) went on refreshing from anywhere. The session id is read
without verifying the access token because the seal is authenticated with
our cookie password, so what it holds is what WorkOS gave us, and an
expired access token still names its session; expired is the usual state
when logout follows a 401 from `/api/auth/me`. The SDK's
`CookieSession.authenticate` and `getLogoutUrl` refuse an expired token and
would skip exactly that case. Rejected: redirecting through WorkOS's hosted
logout URL (`userManagement.getLogoutUrl({ sessionId, returnTo })`). It
would end the session too and also clear AuthKit's own cookie in the
browser, which a server-to-server revocation cannot touch, but WorkOS
honours `returnTo` only when it is registered as a sign-out redirect in
that environment's dashboard. That cannot be checked from the code, and
without it every logout would land on a WorkOS error page. Rejected:
waiting on WorkOS without a bound, or failing the logout when it errors;
an outage must never keep someone signed in to the browser they are
leaving.

**Consequence.** A copied cookie can no longer be refreshed after logout.
The access token already inside it still authenticates until it expires
(WorkOS's access-token lifetime, minutes), because `resolveSession`
verifies that token locally. Logout makes one WorkOS call before the
redirect, three seconds at the worst. When two tabs log out at once (the
cross-tab broadcast in `auth-context.tsx`), the second may find the
session already revoked; that is a logged warning and nothing more.
Owner, to end AuthKit's browser session as well: register
`<NEXT_PUBLIC_APP_URL>/` as a sign-out redirect in every WorkOS
environment; then the redirect can go through `getLogoutUrl` with that
`returnTo`, a code change kept for then. `logout/route.test.ts` pins both
guards, the revocation, the expired token, each failure path, the
three-second bound and the Set-Cookie attributes production sends.

## 2026-09-24 — A membership is keyed by organization and user

**Decision.** `membershipsRepository.upsertMany` upserts on the pair
(`organization_id`, `user_id`), the existing
`organization_memberships_org_user_key`, instead of on the WorkOS
membership id. On a conflict the row takes the proposed id, WorkOS user
id, role, status and `workos_updated_at`, under the same ordering rule as
every mirror write: a proposal older than the stored state is ignored.
The row keeps its `created_at`. No schema change and no migration.

**Why.** WorkOS gives a member who is removed from an organization and
added again a new `om_` id. Upserting by id inserted that membership as a
second row for the same pair, which the unique constraint refused. The
sign-in sync (`syncMembershipsForUser`) then failed on every attempt, so
the user could no longer sign in, and the `organization_membership.created`
webhook answered 500 on every WorkOS retry. With the pair as the key the
new id takes the row over, because its `updatedAt` is later than the old
membership's removal; a late event for the old id carries an older time
and loses, whichever order the deliveries arrive in. Nothing references
`organization_memberships.id`, so rewriting it is safe. Rejected: a
partial unique index on the pair `where status = 'active'`, which would
keep one row per WorkOS id. A 'created' for the new id delivered before
the 'deleted' for the old one would find the old row still active and
violate that index, the same failure in a different order. Rejected:
deleting the old row before inserting the new one, which needs its own
ordering check and loses the row the history is kept in.

**Consequence.** One row per organization and user still records who was
where; the ids of earlier memberships of the same pair are not kept.
`retireStale` compares WorkOS's current ids, which a re-keyed row carries,
so the sync does not retire it. Two memberships for one pair in a single
upsert would fail, but WorkOS never lists two for one pair.
`memberships.repository.db.test.ts`, `organizations.db.test.ts` and the
webhook seam test pin the re-added member through the repository, the
sign-in sync and signed webhooks, and that the late event for the old id
changes nothing.

## 2026-09-24 — The Origin header decides, and production never guesses the app URL

**Decision.** `requireSameOrigin` in `src/lib/security/request-guards.ts`
decides on the Origin header alone whenever one is sent, the literal `null`
and an empty value included. It reads the Referer only when there is no
Origin at all, and refuses a request with neither. It compares the full
origin (scheme, host and port) with the origin of the configured app URL.
Outside production, loopback hosts (`localhost`, `127.0.0.1`, `[::1]`) pass
on any port; in production they never do. Every refusal is the same 403,
`{ error: 'Invalid or missing origin' }`. The app URL comes from one
accessor, `appUrl()` in `src/lib/app-url.ts`, which `getWorkOSEnv` uses
too: `NEXT_PUBLIC_APP_URL` when it is set; in production, an error when it
is not; elsewhere `http://localhost:3002`, the port `npm run dev` serves on.
It reads the variable on every call, never at module load. When production
has no usable app URL, the guard logs `NEXT_PUBLIC_APP_URL is not set or not
a URL; refusing state-changing requests` and refuses.

**Why.** An Origin of `null` fell through to the Referer, so a request the
browser marked as coming from an opaque origin (a sandboxed frame, a
`data:` page, a cross-origin redirect) was judged by the page address it
also sent. Only hosts were compared, so `http://` passed for an `https://`
app. The `http://localhost:3000` fallback was written twice, in the guard
and in the WorkOS client, with a port the dev server does not use, and in
production it put back the localhost origin the guard's own comment said
was gone: a deployment without the variable admitted `localhost:3000` as
same-origin and sent sign-in redirects there. The allowlist was built at
import, so no test could reach its production branch, and none was
written. Rejected: letting `Sec-Fetch-Site: same-origin` decide. Browsers
send Origin on every POST, and older browsers and non-browser clients do
not send `Sec-Fetch-*`, so it could only ever be a second signal. Rejected:
failing at module load or in `next build`. The Docker build has no
`NEXT_PUBLIC_APP_URL` (`.env*` is not copied into the image), and CI builds
with a placeholder on purpose.

**Consequence.** Production must set `NEXT_PUBLIC_APP_URL` (README,
`.env.example`). Without it, every state-changing request is refused with
a logged reason, and everything that calls `getWorkOSEnv` (the session
check, sign-in, the callback, logout) fails with the configuration error
instead of redirecting to localhost. The WorkOS client is built from the
credentials alone and never reads the app URL, so the webhook, which the
guard does not cover, keeps verifying and applying deliveries. As first
written the client was built through `getWorkOSEnv` as well, so the error
reached the webhook's signature check: every delivery was answered 401,
logged as a rejected signature and retried by WorkOS, and the guard's
line saying why was never written. Before, the posts were refused
silently and the redirects went to `localhost:3000`, so such a deployment
was already broken, only less visibly. Deferred: a server-only `APP_URL` read at runtime. Next.js
inlines a `NEXT_PUBLIC_*` value that is set at build time into the server
bundle as well, so the admitted origin is fixed per image; moving to
`APP_URL` changes the README contract and the CI build env, and waits for
the deploy to be wired. `request-guards.test.ts` pins the Origin-first
rule, the full-origin comparison, loopback on any port outside production
and never in it, and the logged refusal when production has no app URL.
`app-url.test.ts` pins the production error and the 3002 fallback, and
`src/lib/workos/client.test.ts` pins the callback default on port 3002, the
production error from `getWorkOSEnv` and a client that still builds without
the app URL.

## 2026-09-24 — The app role cannot delete identity rows

**Decision.** Migration `0007_app_role_keeps_identity_rows` revokes DELETE
on `users`, `organizations`, `organization_memberships` and
`workos_webhook_events` from `sculptors_app`, which keeps SELECT, INSERT
and UPDATE there. The default privileges from `0002` are unchanged, so a
table a later migration creates still gives the app role SELECT, INSERT,
UPDATE and DELETE, and never TRUNCATE or MAINTAIN. Tenant views must be
created `with (security_invoker = true)`, and there are no materialized
views over tenant data. `src/db/schema.db.test.ts` pins all of it: the
exact privileges on each identity table and on a table created later,
checked against every table privilege Postgres 18 has, that the
app role owns no table in `public`, that it cannot delete an
organization, that RLS is enabled on partitioned tables too, that
`public` holds no materialized view and that every view there runs as its
caller. `src/lib/identity/repositories/app-role.db.test.ts` runs every
exported repository function once as `sculptors_app` and reads the write
back. `db/bootstrap-roles.sql` no longer takes the password on psql's
command line: the operator writes a hex secret to an owner-only file
outside the checkout and sets it with psql's `\password`.

**Why.** The app never deletes an identity row: a user WorkOS deleted is
marked inactive, an organization is marked deleted, a membership WorkOS no
longer lists is retired, and webhook events are the log. Yet `0002`
granted DELETE on every table, and a DELETE on `organizations` cascades
(ON DELETE CASCADE) into its memberships and, once they exist, into the
tenant tables keyed to it, where the cascade runs past row level
security. No test looked at privileges, so a TRUNCATE grant, which skips
RLS altogether, would have passed every test, and so would MAINTAIN (new
in Postgres 17), which lets its holder LOCK a table in ACCESS EXCLUSIVE
mode, VACUUM, REINDEX or CLUSTER it. The privilege check first written
for this entry left MAINTAIN out, so a later grant of it would still have
passed. A view reads its tables as
its owner, whom RLS does not bind, unless it is `security_invoker`; a
materialized view is a copy taken by its owner that no policy can
protect. The default privileges would make either readable by the app
role, and the schema tests only looked at relkind `r`. Every repository
test ran as the PGlite superuser, so no statement the app actually sends
had met the grants or the policies. The old runbook put the password in
the process list, never showed it to the operator, used base64 (whose
`+`, `/` and `=` break a URL) and sent it in clear inside CREATE ROLE;
`\password` hashes it as SCRAM on the client. Rejected: splitting
`controlPlanePolicy` into per-command policies so RLS refuses deletes too.
The revoke already refuses them before any policy is consulted, and the
policy change would regenerate the identity schema for no further
protection. Rejected: revoking DELETE in the default privileges as well,
because tenant tables will need it.

**Consequence.** A purge of identity rows, if one is ever needed, runs as
the owner, like a migration. A repository function that deletes from an
identity table fails as the app role; a new repository function gets its
app-role run in `app-role.db.test.ts`. The production project's role already exists (created 23 Sep with
the earlier runbook); the new steps apply to a new project, and `\password`
alone rotates the password.

## 2026-09-24 — Pages send a static security policy, without script-src

**Decision.** Every path (`/:path*` in `next.config.ts` `headers()`) now
sends three more headers: `Content-Security-Policy: frame-ancestors 'self';
base-uri 'self'; object-src 'none'; form-action 'self'`,
`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(),
usb=()` and `Cross-Origin-Opener-Policy: same-origin`. Every header that
was already sent stays, `X-Frame-Options: SAMEORIGIN` included for
browsers that predate `frame-ancestors`. `/_next/image` keeps its own
sandboxed policy (`images.contentSecurityPolicy`): the optimizer sets it on
its response after the config headers, so it replaces the page policy
there, which a production build confirmed. The comments in
`sidebar.tsx` and `landing/fonts.ts` that spoke of a CSP `img-src` and a
`font-src 'self'` policy as if they existed now say that neither is set
yet.

**Why.** No page sent a CSP, a Permissions-Policy or COOP, and two
comments claimed a policy that was not there. These directives cannot
change what a page renders or loads, so they fit the static landing and
the `cacheComponents` shells as they are. `form-action 'self'` was checked
against every form: each one submits through a JS `onSubmit` that calls
`preventDefault`, no `<form>` has an `action`, the WorkOS sign-in hop is a
`window.location` navigation, and logout is reached by navigation, not a
form post, and redirects to this origin. No flow uses `window.opener`:
sign-in is a top-level redirect, not a popup, and external links carry
`rel="noopener noreferrer"`. No page uses the camera, microphone, location,
payments or USB. Rejected: a nonce-based `script-src`. A per-request nonce
forces every page to render dynamically, which `cacheComponents` and the
static landing rule out. Rejected for now: a static `script-src`,
`style-src` and `img-src`. Next streams its RSC payload in inline scripts
and the pages use inline `style` attributes, so both would need
`'unsafe-inline'` and protect little, and `img-src` would have to list
every avatar host (Google, GitHub, WorkOS), since avatars load straight
from the provider.

**Consequence.** Other sites cannot frame the app, inject a `<base>`,
embed plugins or post a form of ours elsewhere, and a cross-origin page
that opens the app, or that the app opens, gets no handle on its window
(`window.opener` is severed both ways). Script injection
is not yet contained by CSP. The next step is `script-src` with hashes
(Next's `experimental.sri`), which needs no nonce; an `img-src` that
lists the avatar hosts belongs with it, and an avatar on a host it does
not list falls back to the initial through `onFailed`. A cross-origin
form post or a popup sign-in flow would need this policy changed first.
`src/next-config.test.ts` pins the three values and `X-Frame-Options`.
A production build was checked in Chromium: the landing (fonts, hero
images, the theme switch) and `/auth/login` report no policy violation,
and `/_next/image` still serves under its own policy.

## 2026-09-24 — Webhook events keep ids and times; deleted users keep no profile

**Decision.** `recordWebhookEvent` (`src/lib/workos/webhook-sync.ts`) now
stores in `workos_webhook_events.payload` only the string values of
`object`, `id`, `organizationId`, `userId`, `status`, `createdAt` and
`updatedAt` from the event's data, plus a membership's `role` as its slug.
It is an allowlist, so an email, a name, a profile picture, metadata, an
IP address, a user agent, an impersonator, a one-time code or token, an
organization's name and any key a later SDK adds are never stored. On
`user.deleted`, `deactivateByWorkOSUserId` in `users.repository.ts` also
scrubs the user's row: `email` becomes `<WorkOS user id>@deleted.invalid`
(the column is NOT NULL and not unique; `.invalid` is reserved by RFC 2606
and reaches no mailbox), and `first_name`, `last_name` and `avatar_url`
become null. The row, its `id`, its `workos_user_id` and the 'inactive'
status stay, under the same `workos_updated_at` guard as before. No schema
change and no migration.

**Why.** The record step stored `{ ...event.data }` for every event WorkOS
sent, with no end date: the emails, names, pictures, IP addresses and user
agents of users the mirror never holds as well, since apply ignores a user
it has not seen. Nothing reads that copy back. A redelivery is applied
again from the event WorkOS sends, and the id alone is the idempotency
guard. A user WorkOS deleted also kept their email and names in `users`
for good. Rejected: a denylist of profile keys, because every new event
type or SDK field would then be stored by default. Rejected for now: a
retention job that empties old payloads and deletes processed rows once
WorkOS's redelivery horizon has passed. It needs the owner's retention
period and a scheduler the app does not have, and the event id has to
outlive WorkOS's redeliveries, since it is what marks a replay as a
duplicate. Rejected:
deleting the user row, because memberships and organizations reference it,
the app role cannot delete identity rows (`0007`), and the WorkOS id must
stay to order late events.

**Consequence.** A new row says which object an event touched and when,
not what it said; the full event is WorkOS's own record. Rows written
before this change keep their full payloads, and users deleted before it
keep their profile, until an owner-run cleanup or the retention job
clears them. A late `user.updated` from before a deletion loses on
`workos_updated_at` and cannot write the profile back, and a deleted
WorkOS user cannot sign in (WorkOS refuses them and the row is
'inactive'). `webhook-sync.db.test.ts` pins the stored shape for a user,
a membership and a session event, the scrub and the late update; the
webhook seam test pins the shape as the real SDK deserializes it;
`users.repository.db.test.ts` pins the scrub and its ordering guard.

## 2026-09-24 — defineRoute answers are not stored

**Decision.** The exit that both `defineRoute` and `definePublicRoute`
share (`finish()` in `src/lib/api/define-route.ts`) now sets
`Cache-Control: private, no-store` on every answer that has no
Cache-Control of its own, and on every answer that carries the
`wos-session` cookie whatever the handler set. The seven handlers that
wrote `no-store` by hand (metrics, one metric, orders, customers,
products, health and the organization list) no longer do, and return
plain objects instead. The middleware's 401 for an API call without a
session cookie and its 429s now say `no-store` too.
`/api/auth/me` keeps its own `NO_STORE`, because no wrapper serves it.

**Why.** No-store was each handler's job, and only the handlers that
answer with data did it. Every answer the wrapper built itself (a 401,
a 403, a 404, a 400 with field errors, a 500) and every handler that
returned a plain object went out with no cache directive, and `finish()`
stores a re-issued session cookie on all of them, refusals and errors
included, so a spent refresh token is never replayed. A shared cache
that kept one of those answers would hand the Set-Cookie to the next
caller. `no-store` alone already forbids storing anywhere; `private`
adds that the answer belongs to one user, for a shared cache or CDN rule
that overrides `no-store`. Rejected: keeping the header per handler and
adding it to the wrapper's own refusals only, because a new handler that
forgets it is the same hole again. Rejected: always overwriting the
handler's value, because a later public, cacheable answer (a static
list, say) should be able to ask for it; the one case that is never
allowed is a cacheable answer that sets the session cookie.

**Consequence.** The route convention "data responses carry
`Cache-Control: no-store`" is now the wrapper's, and a handler writes
Cache-Control only to ask for something else. The header value on the
data routes changes from `no-store` to `private, no-store`, which a
browser treats the same. `define-route.test.ts` pins the
header on a plain answer, a 401, a cross-origin 403 and a public route,
a handler's own value kept, and that value replaced when the answer
carries the session cookie; the route tests pin it on the data and
organization routes, and `middleware.test.ts` on the 401 and the 429.

## 2026-09-24 — Slice layers are checked on resolved paths; UI never reaches lib/workos

**Decision.** Which sibling layer a feature slice's file may import is now
an `import/no-restricted-paths` zone in `LOCKED_ZONES` (`eslint.config.mjs`):
`domain/` imports none of `application/`, `infrastructure/`, `api/` or
`ui/`, and `application/` and `infrastructure/` import neither `api/` nor
`ui/`. A third new zone keeps `components/`, `hooks/`, `contexts/`,
`providers/` and every slice's `ui/` off `src/lib/workos`. The per-layer
`@typescript-eslint/no-restricted-imports` blocks stay, for the packages a
layer must not use (`next/*`, `react`). No source file had to change: lint
was clean under the new zones on the first run.

**Why.** The sibling-layer rules were patterns on `@/features/*/...`
specifiers, but the slices import their own layers relatively
(`../application/ports`, `../domain/time`), so
`import { formatValue } from '../ui/format'` in a `domain/` file passed
lint; a probe against the old config confirmed it. A zone resolves the
import to a file before it compares, so the spelling does not matter, which
is why the database fence already has `DB_PATH_ZONE`. The zones sit in
`LOCKED_ZONES`, so the three blocks that restate it (every source file,
tests, and code outside the data layer) all carry them; flat config
replaces a rule's options instead of merging them, and a zone added to one
block alone would drop out of the others. The `lib/workos` fence closes the
item carried from 22 Sep. It is a zone of its own, not part of
`UI_NEVER_HOLDS_THE_DATABASE`, because that zone's target is all of `app/`,
and the routes in `app/api` are where `lib/workos` is used. Rejected:
adding relative forms such as `../ui/**` to the specifier patterns, because
a relative pattern depends on how deep the importing file sits, so
`../../ui/x` from a folder inside `domain/` would pass. Rejected for now: a
cross-slice rule on resolved paths. A zone cannot tie its target and its
`from` to the same slice name, so it would take one zone per slice, read
from `src/features/` when the config loads so that a new slice is not
missed. No slice reaches another relatively today, the `@/features/...`
deep path is refused by `CROSS_SLICE`, and the new zones already refuse
another slice's `api/` or `ui/` from `domain/`, `application/` or
`infrastructure/` however it is spelled.

**Consequence.** A layer violation fails `npm run lint` whichever way the
import is written, test files included, since a test sits in its layer and
is held to it. `src/eslint-config.test.ts` lints one probe import per rule
at a path that does not exist, through the real config, and fails if a zone
stops matching (a glob that never matches fails silently otherwise): every
forbidden layer pair, relatively and by alias, `lib/workos` from each UI
folder, and the imports that must stay allowed (`infrastructure/` to
`application/ports`, `ui/` to `api/`, `api/` to `application/`, a route and
`lib/` to `lib/workos`). `docs/architecture/boundaries.md` says how each
half of the slice rules is checked and lists the `lib/workos` row.
