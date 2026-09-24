#!/usr/bin/env node
/**
 * Route guard ratchet.
 *
 * Every route handler that changes state (POST/PATCH/PUT/DELETE) must go
 * through one of the shared guards. Before this check existed,
 * `requireSameOrigin` was present on 27 of 55 route files and absent on 28 —
 * a ratio that only stays fixed if something enforces it.
 *
 * This is a ratchet, not a migration: existing offenders are listed in
 * ALLOWED below and the list is meant to shrink. Adding a new unguarded route
 * fails the build; it cannot be added to ALLOWED without a deliberate edit
 * here, which is the point.
 *
 * Run: node scripts/check-route-guards.mjs
 */

import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const API_DIR = path.join(process.cwd(), 'src/app/api');

const GUARDS = ['defineRoute', 'definePublicRoute', 'requireSameOrigin'];

/**
 * Known exceptions. Each needs a reason. Shrink this list; never grow it
 * without one.
 */
const ALLOWED = new Map([
  // Empty since 23 Sep 2026: the WorkOS webhook moved onto definePublicRoute.
]);

/**
 * State-changing handlers that are deliberately unauthenticated
 * (definePublicRoute). definePublicRoute counts as a guard, so without this
 * list a new public mutation would pass as quietly as a guarded one. Adding
 * one needs an entry here as well as the justification the wrapper demands.
 */
const PUBLIC = new Map([
  [
    'auth/workos/webhook/route.ts',
    'WorkOS webhook receiver: no session cookie or Origin; every event is ' +
      'authenticated by its WorkOS-Signature header before anything is written.',
  ],
]);

async function* routeFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* routeFiles(full);
    } else if (entry.name === 'route.ts') {
      yield full;
    }
  }
}

/**
 * Comments are not guards. `requireSameOrigin` appearing in a sentence about
 * why a route is exempt used to satisfy this check as readily as the call
 * itself, which is the one thing a ratchet must never accept.
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Guards are checked per handler, not per file. A file exporting a guarded
 * POST and an unguarded DELETE passed the old whole-file test.
 */
function stateChangingHandlers(source) {
  const pattern = /export\s+(?:async\s+function|const)\s+(POST|PATCH|PUT|DELETE)\b/g;
  const found = [];
  let match;

  while ((match = pattern.exec(source)) !== null) {
    found.push({ verb: match[1], start: match.index });
  }
  return found.map((handler, index) => ({
    verb: handler.verb,
    body: source.slice(
      handler.start,
      index + 1 < found.length ? found[index + 1].start : source.length
    ),
  }));
}

const violations = [];
const staleAllowances = [];
const seen = new Set();
const publicSeen = new Set();

for await (const file of routeFiles(API_DIR)) {
  const rel = path.relative(API_DIR, file);
  const source = withoutComments(readFileSync(file, 'utf8'));

  seen.add(rel);

  const handlers = stateChangingHandlers(source);

  if (handlers.length === 0) {
    continue;
  }

  // A guard called inside one handler covers only that one.
  const unguarded = handlers.filter(
    (handler) => !GUARDS.some((guard) => handler.body.includes(guard))
  );
  const guarded = unguarded.length === 0;

  const isPublic = handlers.some((handler) => handler.body.includes('definePublicRoute'));

  if (isPublic) {
    publicSeen.add(rel);

    if (!PUBLIC.has(rel)) {
      violations.push(`${rel} (public state-changing handler not listed in PUBLIC)`);
    }
  }

  if (guarded && ALLOWED.has(rel)) {
    staleAllowances.push(rel);
  } else if (!guarded && !ALLOWED.has(rel)) {
    violations.push(`${rel} (${unguarded.map((handler) => handler.verb).join(', ')})`);
  }
}

// An allowance pointing at a deleted route is dead weight that makes the
// exception list look larger than the real one.
for (const rel of ALLOWED.keys()) {
  if (!seen.has(rel)) {
    staleAllowances.push(`${rel} (route no longer exists)`);
  }
}

for (const rel of PUBLIC.keys()) {
  if (!publicSeen.has(rel)) {
    staleAllowances.push(`${rel} (no longer a public state-changing route)`);
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
    console.error(`  ✗ src/app/api/${rel}`);
  }
  console.error(
    `\nEach must use defineRoute (src/lib/api/define-route.ts), or call ` +
      `requireSameOrigin.\n` +
      `A deliberately public route uses definePublicRoute with a justification\n` +
      `and an entry in PUBLIC in this script.\n`
  );
  process.exit(1);
}

console.log(
  `Route guards OK — every state-changing handler is guarded ` +
    `(${ALLOWED.size} documented exception${ALLOWED.size === 1 ? '' : 's'}, ` +
    `${PUBLIC.size} deliberately public).`
);
