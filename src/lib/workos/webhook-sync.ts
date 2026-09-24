import 'server-only';

import type { Event } from '@workos-inc/node';
import {
  databaseFailureNote,
  identityDb,
  isMembershipId,
  isOrganizationId,
  membershipsRepository,
  organizationsRepository,
  usersRepository,
  webhookEventsRepository,
  withIdentityTransaction,
} from '@/lib/identity';

/**
 * WorkOS webhook events, applied to the mirror.
 *
 * The route verifies the signature and then calls these in order:
 * record -> apply -> markProcessed (or markFailed). Recording first by the
 * WorkOS event id is the idempotency guard: a redelivery of an applied event
 * is 'duplicate' and is acknowledged without being applied again; one whose
 * apply failed is a 'retry' and is applied again.
 *
 * Events are the SDK's `Event` union, as webhooks.constructEvent returns
 * them: DESERIALIZED, so camelCase (organizationId, firstName). The wire
 * payload WorkOS signs is snake_case; reading those keys here is what left
 * every membership event a silent no-op until 23 Sep (the seam test in
 * app/api/auth/workos/webhook drives real signed payloads through the SDK).
 *
 * Applying only ever MIRRORS. It never creates access: a membership event
 * writes a row the session layer may read, and the session layer still asks
 * WorkOS before binding a session to that organization.
 */

export function recordWebhookEvent(event: Event) {
  return webhookEventsRepository.record(identityDb(), {
    id: event.id,
    type: event.event,
    // Kept for replay and audit, in the deserialized shape apply reads.
    payload: { ...event.data },
  });
}

export function markWebhookEventProcessed(eventId: string) {
  return webhookEventsRepository.markProcessed(identityDb(), eventId);
}

/**
 * Keep why applying failed, until a redelivery applies it. The note is the
 * database's reason, never the failed statement or its values, which for a
 * user event would be the user's email and name.
 */
export function markWebhookEventFailed(eventId: string, error: unknown) {
  return webhookEventsRepository.markFailed(identityDb(), eventId, databaseFailureNote(error));
}

/**
 * When WorkOS deleted the object: the event's own time. A deleted object's
 * updatedAt is its last change BEFORE the deletion, so stamping with it
 * would let an 'updated' event from between the two revive the row.
 */
function deletedAt(event: Event): Date {
  return new Date(event.createdAt);
}

/**
 * Apply one event. Events we subscribe to but do not act on are no-ops
 * (they are still recorded). Each event's writes form one transaction, so a
 * membership is never mirrored without the organization row its FK needs.
 */
export async function applyWebhookEvent(event: Event): Promise<void> {
  switch (event.event) {
    case 'organization.created':
    case 'organization.updated': {
      const { id, name, updatedAt } = event.data;

      if (!isOrganizationId(id) || !name) return;

      await organizationsRepository.upsertNames(identityDb(), [{ id, name, workosUpdatedAt: new Date(updatedAt) }]);

      return;
    }

    case 'organization.deleted': {
      const { id } = event.data;

      if (!isOrganizationId(id)) return;

      await organizationsRepository.markDeleted(identityDb(), id, deletedAt(event));

      return;
    }

    case 'organization_membership.created':
    case 'organization_membership.updated':
    case 'organization_membership.deleted': {
      const { id, organizationId, organizationName, userId: workosUserId, role } = event.data;
      const deleted = event.event === 'organization_membership.deleted';
      // An unknown status is passed through for the CHECK constraint to
      // refuse: the event then fails loudly instead of being mirrored wrong.
      const status = deleted ? 'inactive' : event.data.status;
      const workosUpdatedAt = deleted ? deletedAt(event) : new Date(event.data.updatedAt);

      if (!isMembershipId(id) || !isOrganizationId(organizationId) || !workosUserId) return;

      await withIdentityTransaction(async (tx) => {
        // The membership can only be mirrored for a user we have seen. One we
        // have not will be picked up by the sync at their first sign-in.
        const userId = await usersRepository.findIdByWorkOSUserId(tx, workosUserId);

        if (!userId) return;

        // The organization row must exist for the FK; a membership event can
        // arrive before we have seen the organization by name.
        await organizationsRepository.insertIfMissing(tx, {
          id: organizationId,
          name: organizationName || organizationId,
        });
        await membershipsRepository.upsertMany(tx, [
          { id, organizationId, userId, workosUserId, role: role?.slug ?? 'member', status, workosUpdatedAt },
        ]);
      });

      return;
    }

    case 'user.updated': {
      const { id: workosUserId, email, firstName, lastName, profilePictureUrl, updatedAt } = event.data;

      if (!workosUserId) return;

      await usersRepository.updateProfileByWorkOSUserId(
        identityDb(),
        workosUserId,
        { email, firstName, lastName, avatarUrl: profilePictureUrl },
        new Date(updatedAt)
      );

      return;
    }

    case 'user.deleted': {
      const workosUserId = event.data.id;

      if (!workosUserId) return;

      const at = deletedAt(event);

      await withIdentityTransaction(async (tx) => {
        await usersRepository.deactivateByWorkOSUserId(tx, workosUserId, at);
        await membershipsRepository.deactivateByWorkOSUserId(tx, workosUserId, at);
      });

      return;
    }

    default:
      return;
  }
}
