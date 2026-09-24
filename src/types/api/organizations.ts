/**
 * The organization and session-user shapes on the wire, shared by the route
 * handlers that produce them (through lib/workos/dto.ts, the one mapper) and
 * the browser clients that parse them (lib/validations/organizations.schema.ts).
 *
 * Pure types, camelCase, dates as ISO strings. The server and the client
 * both belong to this repository, so a contract change edits both sides in
 * one commit rather than keeping aliases for a caller that does not exist.
 */

export interface OrganizationDto {
  id: string;
  name: string;
  /** ISO timestamp, or null until the onboarding card was completed. */
  onboardingCompletedAt: string | null;
  /** The caller's role: 'owner' when their WorkOS role is the admin slug. */
  role: 'owner' | 'member';
  /** Whether the caller's session is bound to this organization. */
  isActive: boolean;
  createdAt: string;
}

export interface SessionUserDto {
  id: string;
  email: string;
  /** First and last name, else the email's local part, else "User". */
  displayName: string;
  avatarUrl: string | null;
}
