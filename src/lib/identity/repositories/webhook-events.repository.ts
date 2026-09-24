import 'server-only';

import { eq, sql } from 'drizzle-orm';
import { workosWebhookEvents } from '@/db/schema';
import { unwrap, type IdentityDb } from '../internal/handle';

export type RecordOutcome = 'recorded' | 'retry' | 'duplicate';

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
 * leave an older state behind.
 */
export async function record(
  handle: IdentityDb,
  event: { id: string; type: string; payload: Record<string, unknown> }
): Promise<RecordOutcome> {
  const db = unwrap(handle);

  const rows = await db
    .insert(workosWebhookEvents)
    .values(event)
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
