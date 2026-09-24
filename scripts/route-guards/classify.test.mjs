/**
 * Pins how the route-guard ratchet reads a route file. A handler is guarded
 * only as a direct defineRoute const or behind the requireSameOrigin
 * preamble; definePublicRoute is reported as 'public' for the PUBLIC list;
 * and every export form the checker cannot follow fails as 'unanalysable'.
 * Several fixtures are shapes the regular expression used before 24 Sep 2026
 * let through: a non-async function, `export let`, a re-export, and a guard
 * named only in a string or a comment.
 */

import { describe, expect, it } from 'vitest';
import { classifyRouteSource } from './classify.mjs';

const kinds = (source, fileName = 'route.ts') =>
  classifyRouteSource(source, fileName).map(({ verb, kind }) => ({ verb, kind }));

const SAME_ORIGIN_PREAMBLE = `
  const originFailure = requireSameOrigin(request);

  if (originFailure) {
    return originFailure;
  }
`;

describe('classifyRouteSource', () => {
  it('reports a defineRoute const as guarded, with its line', () => {
    const source = [
      "import { defineRoute } from '@/lib/api/define-route';",
      '',
      'export const POST = defineRoute({',
      "  authz: { kind: 'session-organization' },",
      '  handler: async () => ({}),',
      '});',
    ].join('\n');

    expect(classifyRouteSource(source, 'route.ts')).toEqual([
      { verb: 'POST', kind: 'define-route', line: 3 },
    ]);
  });

  it('reports a definePublicRoute const as public', () => {
    expect(kinds("export const POST = definePublicRoute({ justification: 'x' });")).toEqual([
      { verb: 'POST', kind: 'public' },
    ]);
  });

  it('reports an async function that opens with the requireSameOrigin preamble as guarded', () => {
    const source = `export async function POST(request: NextRequest) {${SAME_ORIGIN_PREAMBLE}
  return handle(request);
}`;

    expect(kinds(source)).toEqual([{ verb: 'POST', kind: 'same-origin' }]);
  });

  it('accepts the preamble with an unbraced return', () => {
    const source = `export async function DELETE(request: Request) {
  const failure = requireSameOrigin(request);
  if (failure) return failure;
  return handle(request);
}`;

    expect(kinds(source)).toEqual([{ verb: 'DELETE', kind: 'same-origin' }]);
  });

  it('reports a non-async export function without a guard as unguarded', () => {
    expect(kinds('export function POST() { return new Response(null); }')).toEqual([
      { verb: 'POST', kind: 'unguarded' },
    ]);
  });

  it('reports a const that does not call a guard directly as unguarded', () => {
    expect(kinds('export const PATCH = wrap(defineRoute({}));')).toEqual([
      { verb: 'PATCH', kind: 'unguarded' },
    ]);
  });

  it('reports export let as unanalysable, since it can be reassigned', () => {
    expect(kinds('export let POST = defineRoute({});')).toEqual([
      { verb: 'POST', kind: 'unanalysable' },
    ]);
  });

  it('reports export { handler as POST } as unanalysable', () => {
    const source = 'const handler = () => new Response(null);\nexport { handler as POST };';

    expect(kinds(source)).toEqual([{ verb: 'POST', kind: 'unanalysable' }]);
  });

  it('reports a named re-export from another module as unanalysable', () => {
    expect(kinds("export { PUT, GET } from './handlers';")).toEqual([
      { verb: 'PUT', kind: 'unanalysable' },
    ]);
  });

  it('reports export * as unanalysable', () => {
    expect(kinds("export * from './handlers';")).toEqual([{ verb: '*', kind: 'unanalysable' }]);
  });

  it('reports a destructured export as unanalysable', () => {
    expect(kinds('export const { POST } = handlers;')).toEqual([
      { verb: 'POST', kind: 'unanalysable' },
    ]);
  });

  it('does not count requireSameOrigin named in a string or a comment', () => {
    const source = `export async function POST(request: Request) {
  // requireSameOrigin(request) is not needed here
  const note = 'requireSameOrigin(request)';

  return new Response(note);
}`;

    expect(kinds(source)).toEqual([{ verb: 'POST', kind: 'unguarded' }]);
  });

  it('does not count requireSameOrigin called after other statements', () => {
    const source = `export async function POST(request: Request) {
  await sideEffect(request);
${SAME_ORIGIN_PREAMBLE}
  return new Response(null);
}`;

    expect(kinds(source)).toEqual([{ verb: 'POST', kind: 'unguarded' }]);
  });

  it('does not count a preamble that returns something other than the failure', () => {
    const source = `export async function POST(request: Request) {
  const failure = requireSameOrigin(request);

  if (failure) {
    log(failure);
  }

  return new Response(null);
}`;

    expect(kinds(source)).toEqual([{ verb: 'POST', kind: 'unguarded' }]);
  });

  it('classifies each handler in a file on its own', () => {
    const source = `export const POST = defineRoute({});
export async function DELETE() {
  return new Response(null);
}`;

    expect(kinds(source)).toEqual([
      { verb: 'POST', kind: 'define-route' },
      { verb: 'DELETE', kind: 'unguarded' },
    ]);
  });

  it('ignores handlers that do not change state', () => {
    const source = `export async function GET() {
  return new Response(null);
}
export const HEAD = GET;
export { GET as OPTIONS };`;

    expect(kinds(source)).toEqual([]);
  });

  it('parses a route.tsx source', () => {
    const source = `export const POST = defineRoute({
  handler: async () => new Response(renderToString(<p className="note">Done</p>)),
});`;

    expect(kinds(source, 'route.tsx')).toEqual([{ verb: 'POST', kind: 'define-route' }]);
  });

  it('parses a route.tsx source as TSX, so JSX text cannot hide an unguarded handler', () => {
    // The fixture above classifies the same whichever way it is parsed. This
    // one does not: read as plain TypeScript, `<p>Say` is a type assertion and
    // the backtick opens a template that runs to the end of the file, so the
    // POST below is never seen and the check would pass with nothing to report.
    const source = [
      'const note = <p>Say `hi</p>;',
      'export function POST() { return new Response(null); }',
    ].join('\n');

    expect(kinds(source, 'route.tsx')).toEqual([{ verb: 'POST', kind: 'unguarded' }]);
  });
});
