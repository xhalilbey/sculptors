import { z } from 'zod';
import type { OrganizationDto, SessionUserDto } from '@/types/api';

/**
 * Runtime parsers for the organization wire shapes, for the browser: a
 * response is parsed, never cast, so a server change that breaks the
 * contract fails where it lands instead of rendering `undefined`.
 */

export const organizationDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  onboardingCompletedAt: z.string().nullable(),
  role: z.enum(['owner', 'member']),
  isActive: z.boolean(),
  createdAt: z.string(),
}) satisfies z.ZodType<OrganizationDto>;

export const sessionUserDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
}) satisfies z.ZodType<SessionUserDto>;

/** GET /api/organizations */
export const organizationListResponseSchema = z.object({
  organizations: z.array(organizationDtoSchema),
});

/** POST /api/organizations and PATCH /api/organizations/[id] */
export const organizationResponseSchema = z.object({
  organization: organizationDtoSchema,
});

/** GET /api/auth/me */
export const sessionResponseSchema = z.object({
  user: sessionUserDtoSchema,
  organization: organizationDtoSchema,
});

/** The error body both envelopes share. */
export const errorResponseSchema = z.object({ error: z.string() });
