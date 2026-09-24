/**
 * Pins what the route-guard ratchet (scripts/check-route-guards.mjs) does
 * with the verdicts classify.test.mjs pins: which files it reads and which
 * verdicts fail the run. The script runs as `npm run check:routes` does,
 * from a fixture app under the system temp directory, because the real
 * src/app holds no route.tsx, no route file outside api/, no re-export and
 * no unlisted definePublicRoute. Against the real tree, a walk narrowed back
 * to src/app/api, a walk that skipped route.tsx, an 'unanalysable' export
 * let through or a PUBLIC list no longer consulted would all still pass;
 * here each one leaves a violation unreported.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve('scripts/check-route-guards.mjs');

let root;

const writeRoute = (file, source) => {
  const full = path.join(root, 'src/app', file);

  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, source);
};

const runCheck = () =>
  spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: 'utf8', timeout: 20_000 });

describe('check-route-guards', () => {
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'route-guards-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('fails on handlers in route.tsx and outside api/, re-exports and unlisted public routes', () => {
    writeRoute(
      '(dashboard)/probe/route.tsx',
      'export function POST() { return new Response(null); }\n'
    );
    writeRoute(
      'probe/route.ts',
      'const handler = () => new Response(null);\nexport { handler as DELETE };\n'
    );
    writeRoute(
      'api/probe/route.ts',
      "export const PATCH = definePublicRoute({ justification: 'x' });\n"
    );
    writeRoute('api/ok/route.ts', 'export const POST = defineRoute({});\n');

    const { status, stderr } = runCheck();

    expect(status).toBe(1);
    expect(stderr).toContain('src/app/(dashboard)/probe/route.tsx:1 (POST: unguarded)');
    expect(stderr).toContain('src/app/probe/route.ts:2 (DELETE: unanalysable)');
    expect(stderr).toContain('src/app/api/probe/route.ts:1 (PATCH: public, not listed in PUBLIC)');
    expect(stderr).not.toContain('api/ok/');
  });

  it('passes guarded handlers and the public route listed in PUBLIC', () => {
    writeRoute('api/ok/route.ts', 'export const POST = defineRoute({});\n');
    writeRoute(
      'api/auth/workos/webhook/route.ts',
      "export const POST = definePublicRoute({ justification: 'x' });\n"
    );

    const { status, stderr } = runCheck();

    expect(stderr).toBe('');
    expect(status).toBe(0);
  });
});
