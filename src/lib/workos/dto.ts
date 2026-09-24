import 'server-only';

import type { OrganizationRow } from '@/lib/identity';
import type { OrganizationDto, SessionUserDto } from '@/types/api';

/**
 * The one place server data becomes wire data (src/types/api). Routes call
 * these instead of building JSON by hand, so a field is renamed, added or
 * dropped here once, and a row's internal columns (plan, region, status,
 * created_by, the WorkOS role slug, member counts) never leave by accident.
 */

type OrganizationFields = Pick<OrganizationRow, 'name' | 'onboardingCompletedAt' | 'createdAt'> & {
  id: string;
};

export function toOrganizationDto(
  organization: OrganizationFields,
  access: { role: 'owner' | 'member'; isActive: boolean }
): OrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    onboardingCompletedAt: organization.onboardingCompletedAt?.toISOString() ?? null,
    role: access.role,
    isActive: access.isActive,
    createdAt: organization.createdAt.toISOString(),
  };
}

/**
 * The switcher's order: the user's default organization (their first
 * membership) first, then the newest. It used to be sorted in the browser;
 * the server owns it now so every client lists the same way.
 */
export function toOrganizationListDto(
  organizations: (OrganizationFields & { role: 'owner' | 'member'; isDefault: boolean })[],
  activeOrganizationId: string
): OrganizationDto[] {
  return [...organizations]
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;

      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .map((organization) =>
      toOrganizationDto(organization, {
        role: organization.role,
        isActive: organization.id === activeOrganizationId,
      })
    );
}

export function displayNameOf(user: { email: string; firstName: string | null; lastName: string | null }): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  return fullName || user.email.split('@')[0] || 'User';
}

export function toSessionUserDto(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}): SessionUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: displayNameOf(user),
    avatarUrl: user.avatarUrl,
  };
}
