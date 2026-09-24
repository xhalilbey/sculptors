import { describe, expect, it } from 'vitest';
import type { OrganizationRow } from '@/lib/identity';
import { displayNameOf, toOrganizationListDto } from './dto';

describe('toOrganizationListDto', () => {
  const organization = (id: string, createdAt: string, isDefault = false) => ({
    id: id as OrganizationRow['id'],
    name: id,
    onboardingCompletedAt: null,
    createdAt: new Date(createdAt),
    role: 'member' as const,
    isDefault,
  });

  it('puts the default organization first, then the newest', () => {
    const listed = toOrganizationListDto(
      [
        organization('org_old', '2026-01-01T00:00:00Z'),
        organization('org_new', '2026-03-01T00:00:00Z'),
        organization('org_default', '2026-02-01T00:00:00Z', true),
      ],
      'org_old'
    );

    expect(listed.map((o) => [o.id, o.isActive])).toEqual([
      ['org_default', false],
      ['org_new', false],
      ['org_old', true],
    ]);
  });
});

describe('displayNameOf', () => {
  it.each([
    [{ firstName: 'Ada', lastName: 'Lovelace' }, 'Ada Lovelace'],
    [{ firstName: 'Ada', lastName: null }, 'Ada'],
    [{ firstName: null, lastName: null }, 'ada'],
  ])('names %o as %s', (name, expected) => {
    expect(displayNameOf({ email: 'ada@example.com', ...name })).toBe(expected);
  });

  it('says User when there is nothing else', () => {
    expect(displayNameOf({ email: '@example.com', firstName: null, lastName: null })).toBe('User');
  });
});
