import 'server-only';

import { eq, sql } from 'drizzle-orm';
import { workosWebhookEvents } from '@/db/schema';
import { unwrap, type IdentityDb } from '../internal/handle';

export type RecordOutcome = 'recorded' | 'retry' | 'duplicate';

/**
 * A payload as a jsonb column can hold it: U+0000 removed from every string
 * and key, at any depth. JSON.stringify writes a NUL as the escape \u0000,
 * which Postgres refuses in jsonb ("unsupported Unicode escape sequence").
 * While the whole of an event's data was stored, one NUL in it (an
 * organization name or a metadata value set through the WorkOS API) failed
 * this insert, and with it every retry of that event, before apply was
 * reached.
 *
 * Since 24 Sep the only caller, recordWebhookEvent, passes auditPayload: a
 * flat record of WorkOS ids, status, times and a role slug, with no name,
 * metadata, array or nested object (webhook-sync.ts; DECISIONS, "Webhook
 * events keep ids and times; deleted users keep no profile"). The walk over
 * keys, arrays and nested objects stays as a guard for what `record`
 * accepts, any record, not because such payloads arrive. A NUL in an organization name is handled where the name
 * is mirrored (mirroredName in organizations.repository.ts), not here.
 * Anything that is not a string, an array or a plain object is left for
 * JSON.stringify.
 */
function storable(value: unknown): unknown {
  if (typeof value === 'string') return value.replaceAll('\u0000', '');

  if (Array.isArray(value)) return value.map(storable);

  if (isPlainObject(value)) return storableObject(value);

  return value;
}

function storableObject(value: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key.replaceAll('\u0000', ''), storable(inner)])
  );
}

function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false;

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * Record an event by its WorkOS id before applying it, in one statement:
 *
 * - a new id is inserted: 'recorded', apply it;
 * - a known id whose apply never finished (processed_at is null, e.g. the
 *   last attempt threw and was answered 500) counts one more attempt and
 *   clears the old error: 'retry', apply it again;
 * - a known id that was applied: the WHERE refuses the update, no row comes
 *   back: 'duplicate', acknowledge it without applying.
 *
 * `xmax = 0` is true only for a row this statement inserted (an updated row
 * version carries the updating transaction's id). Applying is idempotent
 * (every mirror write is an upsert ordered by workos_updated_at), so a retry
 * converges on the same rows and two concurrent retries of one event cannot
 * leave an older state behind. The payload is stored without NULs
 * (storable, above).
 */
export async function record(
  handle: IdentityDb,
  event: { id: string; type: string; payload: Record<string, unknown> }
): Promise<RecordOutcome> {
  const db = unwrap(handle);

  const rows = await db
    .insert(workosWebhookEvents)
    .values({ ...event, payload: storableObject(event.payload) })
    .onConflictDoUpdate({
      target: workosWebhookEvents.id,
      set: { attempts: sql`${sql.raw('workos_webhook_events.attempts')} + 1`, error: null },
      where: sql`${sql.raw('workos_webhook_events.processed_at')} is null`,
    })
    .returning({ inserted: sql<boolean>`(xmax = 0)` });

  const [row] = rows;

  if (!row) return 'duplicate';

  return row.inserted ? 'recorded' : 'retry';
}

export async function markProcessed(handle: IdentityDb, id: string, at = new Date()): Promise<void> {
  const db = unwrap(handle);

  await db.update(workosWebhookEvents).set({ processedAt: at }).where(eq(workosWebhookEvents.id, id));
}

/** Keeps why the last attempt failed. The message is truncated: it is a note, not a log. */
export async function markFailed(handle: IdentityDb, id: string, message: string): Promise<void> {
  const db = unwrap(handle);

  await db
    .update(workosWebhookEvents)
    .set({ error: message.slice(0, 500) })
    .where(eq(workosWebhookEvents.id, id));
}
