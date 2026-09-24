#!/usr/bin/env node
/**
 * Route guard ratchet.
 *
 * Every route handler that changes state (POST/PATCH/PUT/DELETE) must go
 * through one of the shared guards. Before this check existed,
 * `requireSameOrigin` was present on 27 of 55 route files and absent on 28 —
 * a ratio that only stays fixed if something enforces it.
 *
 * It began as a ratchet: existing offenders were listed in ALLOWED and the
 * list was meant to shrink. It has been empty since 23 Sep 2026, when the
 * WorkOS webhook moved onto definePublicRoute, and it must stay empty; a new
 * unguarded handler is fixed, not listed. PUBLIC is the allow list now, for
 * handlers that are deliberately unauthenticated.
 *
 * Since 24 Sep 2026 the check reads each route file's syntax tree
 * (scripts/route-guards/classify.mjs) instead of its text. The regular
 * expression before it saw only `export async function VERB` and
 * `export const VERB`, so `export function POST`, `export let POST` and
 * `export { handler as POST }` were never checked, and it took a guard's
 * name anywhere after the export, a string literal included, as proof of the
 * call. A handler now passes only as `export const VERB = defineRoute(...)`,
 * or as an exported function whose first two statements are
 * `const x = requireSameOrigin(request); if (x) return x;`. An export the
 * check cannot follow (a re-export, `export let`, `export *`) fails instead
 * of passing unseen. It walks all of src/app, not only src/app/api, because
 * Next serves a route.ts or route.tsx from anywhere under it.
 *
 * Run: node scripts/check-route-guards.mjs
 */

import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { classifyRouteSource } from './route-guards/classify.mjs';

const APP_DIR = path.join(process.cwd(), 'src/app');

/** The kinds classifyRouteSource gives a guarded handler. */
const GUARDED = new Set(['define-route', 'same-origin']);

/**
 * Known exceptions, keyed `<file under src/app>#VERB`. Empty, and it stays
 * empty (see the header).
 */
const ALLOWED = new Map([
  // Empty since 23 Sep 2026: the WorkOS webhook moved onto definePublicRoute.
]);

/**
 * State-changing handlers that are deliberately unauthenticated
 * (definePublicRoute), keyed like ALLOWED. definePublicRoute is a wrapper
 * like defineRoute, so without this list a new public mutation would pass as
 * quietly as a guarded one. Adding one needs an entry here as well as the
 * justification the wrapper demands.
 */
const PUBLIC = new Map([
  [
    'api/auth/workos/webhook/route.ts#POST',
    'WorkOS webhook receiver: no session cookie or Origin; every event is ' +
      'authenticated by its WorkOS-Signature header before anything is written.',
  ],
]);

async function* routeFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* routeFiles(full);
    } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
      yield full;
    }
  }
}

const violations = [];
const staleAllowances = [];
const seen = new Set();
const publicSeen = new Set();

for await (const file of routeFiles(APP_DIR)) {
  const rel = path.relative(APP_DIR, file);

  // Guards are checked per handler, not per file: a guarded POST says
  // nothing about the DELETE beside it.
  for (const { verb, kind, line } of classifyRouteSource(readFileSync(file, 'utf8'), rel)) {
    const key = `${rel}#${verb}`;

    seen.add(key);

    if (kind === 'public') {
      publicSeen.add(key);

      if (!PUBLIC.has(key)) {
        violations.push(`${rel}:${line} (${verb}: public, not listed in PUBLIC)`);
      }
    } else if (GUARDED.has(kind)) {
      if (ALLOWED.has(key)) {
        staleAllowances.push(key);
      }
    } else if (!ALLOWED.has(key)) {
      // 'unguarded' or 'unanalysable'; anything the classifier does not
      // vouch for fails.
      violations.push(`${rel}:${line} (${verb}: ${kind})`);
    }
  }
}

// An allowance pointing at a deleted handler is dead weight that makes the
// exception list look larger than the real one.
for (const key of ALLOWED.keys()) {
  if (!seen.has(key)) {
    staleAllowances.push(`${key} (handler no longer exists)`);
  }
}

for (const key of PUBLIC.keys()) {
  if (!publicSeen.has(key)) {
    staleAllowances.push(`${key} (no longer a public state-changing handler)`);
  }
}

if (staleAllowances.length > 0) {
  console.log('Route guard allowances that are no longer needed (remove them):');
  for (const rel of staleAllowances) {
    console.log(`  - ${rel}`);
  }
  console.log('');
}

if (violations.length > 0) {
  console.error('Unguarded state-changing route handlers:\n');
  for (const rel of violations) {
    console.error(`  ✗ src/app/${rel}`);
  }
  console.error(
    `\nEach must be \`export const VERB = defineRoute(...)\` (src/lib/api/define-route.ts),\n` +
      `or an exported function that opens with\n` +
      `\`const x = requireSameOrigin(request); if (x) return x;\`.\n` +
      `A deliberately public route uses definePublicRoute with a justification\n` +
      `and an entry in PUBLIC in this script. A handler the check cannot follow\n` +
      `(re-exported, \`export let\`, \`export *\`) is 'unanalysable': export it directly.\n`
  );
  process.exit(1);
}

console.log(
  `Route guards OK — every state-changing handler is guarded ` +
    `(${ALLOWED.size} documented exception${ALLOWED.size === 1 ? '' : 's'}, ` +
    `${PUBLIC.size} deliberately public).`
);
