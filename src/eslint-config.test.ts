import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * The layer fences in eslint.config.mjs fire on the file an import resolves
 * to, whichever way it is spelled. Until 24 Sep 2026 a slice's sibling
 * layers were fenced by patterns on `@/features/...` specifiers only, while
 * the slices import their own layers relatively, so `../ui/x` in a domain/
 * file passed lint. The same change fenced lib/workos (the server key and the
 * session layer) off from UI. A glob zone that stops matching fails silently,
 * so this lints one import per rule at a path that does not exist, with the
 * real config, and reads which rule answered.
 */

const eslint = new ESLint();

async function boundaryErrors(filePath: string, source: string): Promise<string[]> {
  const results = await eslint.lintText(`${source}\n`, { filePath });

  return results
    .flatMap(result => result.messages)
    .filter(message => message.ruleId === 'import/no-restricted-paths')
    .map(message => message.message);
}

describe('eslint.config.mjs slice layers', () => {
  it.each([
    ['domain', 'ui', "import { formatValue } from '../ui/format';"],
    ['domain', 'application', "import type { MetricsSource } from '../application/ports';"],
    ['domain', 'infrastructure', "import { createDemoMetricsSource } from '../infrastructure/demo-metrics-source';"],
    ['domain', 'api', "import { fetchOverview } from '../api/client';"],
    ['application', 'api', "import { fetchOverview } from '../api/client';"],
    ['application', 'ui', "import { formatValue } from '../ui/format';"],
    ['infrastructure', 'api', "import type { OverviewDto } from '../api/schemas';"],
    ['infrastructure', 'ui', "import { formatValue } from '../ui/format';"],
  ])('refuses a relative import from %s/ into %s/', async (layer, _into, source) => {
    const errors = await boundaryErrors(`src/features/metrics/${layer}/probe.ts`, source);

    expect(errors).toHaveLength(1);
  });

  it('refuses the same import spelled with the alias, and in a test file', async () => {
    const aliased = await boundaryErrors(
      'src/features/metrics/domain/probe.ts',
      "import { formatValue } from '@/features/metrics/ui/format';"
    );
    const inTest = await boundaryErrors(
      'src/features/metrics/domain/probe.test.ts',
      "import { formatValue } from '../ui/format';"
    );

    expect(aliased).toHaveLength(1);
    expect(inTest).toHaveLength(1);
  });

  it.each([
    ['infrastructure', "import type { MetricsSource } from '../application/ports';"],
    ['ui', "import { fetchOverview } from '../api/client';"],
    ['api', "import { SOURCE_KINDS } from '../application/ports';"],
  ])('lets %s/ import inward', async (layer, source) => {
    const errors = await boundaryErrors(`src/features/metrics/${layer}/probe.ts`, source);

    expect(errors).toEqual([]);
  });
});

describe('eslint.config.mjs lib/workos fence', () => {
  it.each([
    ['src/components/probe.tsx', "import { WORKOS_SESSION_COOKIE } from '@/lib/workos/constants';"],
    ['src/components/ui/probe.tsx', "import { WORKOS_SESSION_COOKIE } from '../../lib/workos/constants';"],
    ['src/hooks/probe.ts', "import { WORKOS_SESSION_COOKIE } from '@/lib/workos/constants';"],
    ['src/contexts/probe.tsx', "import { WORKOS_SESSION_COOKIE } from '@/lib/workos/constants';"],
    ['src/providers/probe.tsx', "import { WORKOS_SESSION_COOKIE } from '@/lib/workos/constants';"],
    ['src/features/metrics/ui/probe.tsx', "import { WORKOS_SESSION_COOKIE } from '@/lib/workos/constants';"],
  ])('refuses lib/workos in %s', async (filePath, source) => {
    const errors = await boundaryErrors(filePath, source);

    expect(errors).toEqual([expect.stringContaining('lib/workos')]);
  });

  it('lets a route and lib/ import lib/workos', async () => {
    const source = "import { WORKOS_SESSION_COOKIE } from '@/lib/workos/constants';";

    expect(await boundaryErrors('src/app/api/probe/route.ts', source)).toEqual([]);
    expect(await boundaryErrors('src/lib/auth/probe.ts', source)).toEqual([]);
  });
});
