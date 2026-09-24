import {
  organizationListResponseSchema,
  organizationResponseSchema,
} from '@/lib/validations/organizations.schema';
import type { OrganizationDto } from '@/types/api';
import { getJson, readJson, toApiRequestError } from './api-error';

/**
 * Browser calls to /api/organizations. Every response is parsed with the
 * wire schema (never cast), and every failure is an ApiRequestError with the
 * server's message, so callers show one thing and log one thing.
 */

export async function listOrganizations(signal?: AbortSignal): Promise<OrganizationDto[]> {
  const body = await getJson('/api/organizations', 'Failed to load organizations', signal);

  return organizationListResponseSchema.parse(body).organizations;
}

/** Creates the organization; the server also switches the session into it. */
export async function createOrganization(input: { name: string }): Promise<OrganizationDto> {
  const response = await fetch('/api/organizations', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name.trim() }),
  });
  const body = await readJson(response);

  if (!response.ok) throw toApiRequestError(response, body, 'Failed to create organization');

  return organizationResponseSchema.parse(body).organization;
}

export async function updateOrganization(
  organizationId: string,
  patch: { name?: string; completeOnboarding?: boolean }
): Promise<OrganizationDto> {
  const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...patch, name: patch.name?.trim() }),
  });
  const body = await readJson(response);

  if (!response.ok) throw toApiRequestError(response, body, 'Failed to update organization');

  return organizationResponseSchema.parse(body).organization;
}

/** Asks the server to re-issue the session for another organization. */
export async function selectOrganization(organizationId: string): Promise<void> {
  const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/select`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw toApiRequestError(response, await readJson(response), 'Failed to switch organization');
  }
}

export { ApiRequestError } from './api-error';
