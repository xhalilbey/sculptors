import { describe, expect, it } from 'vitest';
import { organizationNameSchema } from './organizations.schema';

/**
 * The organization name both routes accept: only what the mirror can store
 * (no NUL, at most 100 code points, the unit of the database's CHECK) and
 * what reads as what it is (no control or text-direction characters).
 */

const LENGTH = 'Organization name must be between 1 and 100 characters';
const UNSAFE = 'Organization name cannot contain control or text-direction characters';

function refusal(value: string): string[] {
  const result = organizationNameSchema.safeParse(value);

  return result.success ? [] : result.error.issues.map(issue => issue.message);
}

describe('organizationNameSchema', () => {
  it('accepts a plain name, an emoji ZWJ sequence and 100 emoji', () => {
    const emoji = '\u{1F600}'.repeat(100);

    expect(organizationNameSchema.parse('Acme')).toBe('Acme');
    expect(organizationNameSchema.parse('\u{1F469}\u{200D}\u{1F4BB} Studio')).toBe('\u{1F469}\u{200D}\u{1F4BB} Studio');
    // 200 UTF-16 units, 100 code points: the old .max(100) refused it.
    expect(organizationNameSchema.parse(emoji)).toBe(emoji);
  });

  it('trims and normalises to NFC', () => {
    expect(organizationNameSchema.parse('  Acme  ')).toBe('Acme');
    expect(organizationNameSchema.parse('Caf\u{65}\u{301}')).toBe('Caf\u{E9}');
  });

  it('refuses a NUL, a line break and a right-to-left override', () => {
    expect(refusal('A\u{0}B')).toEqual([UNSAFE]);
    expect(refusal('A\nB')).toEqual([UNSAFE]);
    expect(refusal('\u{202E}evil')).toEqual([UNSAFE]);
  });

  it('refuses more than 100 code points and a name that is only whitespace', () => {
    expect(refusal('x'.repeat(101))).toEqual([LENGTH]);
    expect(refusal('\u{1F600}'.repeat(101))).toEqual([LENGTH]);
    expect(refusal('   ')).toEqual([LENGTH]);
  });
});
