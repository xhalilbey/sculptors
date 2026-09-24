import { z } from 'zod';
import type { OrganizationDto, SessionUserDto } from '@/types/api';

/**
 * The organization wire shapes, both ways. The response parsers are for the
 * browser: a response is parsed, never cast, so a server change that breaks
 * the contract fails where it lands instead of rendering `undefined`.
 * organizationNameSchema, at the end, is the request half: the name rule
 * POST /api/organizations and PATCH /api/organizations/[id] validate with
 * on the server. The characters it refuses (UNSAFE_NAME_CHARACTERS) are
 * the ones the server's mirror drops from WorkOS names.
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

/**
 * Characters no organization name may carry: every control character (NUL,
 * which a Postgres text column cannot hold, and the line breaks among them),
 * the bidi marks, embeddings, overrides and isolates that make a name read
 * differently from what it is, and the line and paragraph separators. ZWJ
 * and ZWNJ stay allowed: emoji sequences and some scripts need them.
 *
 * The request schema below refuses them, and the organizations repository
 * drops the same set from every name it mirrors (mirroredName), so a
 * mirrored name the setup screen prefills is one the schema accepts.
 */
export const UNSAFE_NAME_CHARACTERS = /[\p{Cc}\u{61C}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{2028}\u{2029}]/u;

/**
 * An organization name from a request (POST /api/organizations and PATCH
 * /api/organizations/[id]), written once so the two cannot drift. Trimmed
 * and NFC-normalised, then limited to 1..100 code points, the unit of the
 * database's CHECK (char_length), where the routes used to count UTF-16
 * units. The routes used to accept any trimmed string, so a NUL went to
 * WorkOS first and only then failed the mirror write.
 */
export const organizationNameSchema = z
  .string()
  .trim()
  .normalize('NFC')
  .refine(
    value => {
      const length = [...value].length;

      return length >= 1 && length <= 100;
    },
    'Organization name must be between 1 and 100 characters'
  )
  .refine(
    value => !UNSAFE_NAME_CHARACTERS.test(value),
    'Organization name cannot contain control or text-direction characters'
  );
