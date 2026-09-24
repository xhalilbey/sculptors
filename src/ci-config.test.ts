import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The Docker image, CI and package.json name one supported Node major, and
 * CI's token can only read. Until 24 Sep 2026 all three Dockerfile stages and
 * CI ran Node 20, past its end of life on 30 Apr 2026, while local
 * development ran 22, and Intl output differs between engines (883a449). The
 * workflow also ran with the repository's default token permissions and left
 * the token in .git/config after checkout, although no step writes. Nothing
 * else reads these files, so a drift in any of them would go unnoticed.
 */

const OLDEST_SUPPORTED_MAJOR = 22;

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function majors(text: string, pattern: RegExp): number[] {
  return [...text.matchAll(pattern)].map(match => Number(match[1]));
}

describe('Node version', () => {
  it('is one supported major in every image stage, in CI and in engines', () => {
    const image = majors(read('Dockerfile'), /^FROM node:(\d+)-/gm);
    const ci = majors(read('.github/workflows/ci.yml'), /node-version:\s*(\d+)\s*$/gm);
    const manifest = JSON.parse(read('package.json')) as { engines?: { node?: string } };
    const [major] = image;

    expect(image).toHaveLength(3);
    expect(ci).toHaveLength(1);
    expect(new Set([...image, ...ci])).toEqual(new Set([major]));
    expect(major).toBeGreaterThanOrEqual(OLDEST_SUPPORTED_MAJOR);
    expect(manifest.engines?.node).toBe(`>=${major}`);
  });
});

describe('CI workflow', () => {
  const workflow = read('.github/workflows/ci.yml');

  it('gives the job token read access to contents and nothing more', () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n(?! )/m);
    expect(workflow.match(/permissions:/g)).toHaveLength(1);
    expect(workflow).not.toMatch(/:\s*write\b/);
  });

  it('does not leave the token in .git/config after checkout', () => {
    const checkouts = [
      ...workflow.matchAll(
        /uses: actions\/checkout@\S+\n(?:\s+with:\n\s+persist-credentials: (\S+)\n)?/g
      ),
    ];

    expect(checkouts.length).toBeGreaterThan(0);

    for (const checkout of checkouts) expect(checkout[1]).toBe('false');
  });
});
