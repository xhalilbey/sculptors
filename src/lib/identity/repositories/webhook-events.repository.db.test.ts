import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import { wrap, type IdentityDb } from '../internal/handle';
import * as webhookEvents from './webhook-events.repository';

let t: TestDb;
/** The PGlite handle, sealed the way services hand it to repositories. */
let db: IdentityDb;

beforeAll(async () => {
  t = await createTestDb();
  db = wrap(t.db);
});

afterAll(async () => {
  await t.close();
});

async function read(id: string) {
  const result = await t.db.execute<{ type: string; payload: unknown; processed_at: string | null; error: string | null; attempts: number }>(
    sql`select type, payload, processed_at, error, attempts from workos_webhook_events where id = ${id}`
  );

  return result.rows;
}

describe('webhookEvents.record', () => {
  it('records a new event with its payload as JSON', async () => {
    const outcome = await webhookEvents.record(db, {
      id: 'event_new',
      type: 'organization.updated',
      payload: { id: 'org_1', tags: ['a', 'b'] },
    });

    expect(outcome).toBe('recorded');
    expect(await read('event_new')).toEqual([
      { type: 'organization.updated', payload: { id: 'org_1', tags: ['a', 'b'] }, processed_at: null, error: null, attempts: 1 },
    ]);
  });

  it('stores a payload holding a NUL, in a value or a key at any depth, without it', async () => {
    // jsonb refuses the \u0000 escape JSON.stringify writes for a NUL, so
    // this insert used to throw and the route answered every retry 500.
    // The payload here pins what record() accepts, any record. The webhook
    // itself stores only auditPayload's ids and times, never a name,
    // domains or metadata (webhook-sync.db.test.ts pins that shape).
    const outcome = await webhookEvents.record(db, {
      id: 'event_nul',
      type: 'organization.updated',
      payload: { name: 'Acme\u{0} Ltd', domains: [{ domain: 'a\u{0}.example' }], metadata: { 'k\u{0}ey': 'v\u{0}' }, count: 2 },
    });

    expect(outcome).toBe('recorded');
    expect((await read('event_nul'))[0]?.payload).toEqual({
      name: 'Acme Ltd',
      domains: [{ domain: 'a.example' }],
      metadata: { key: 'v' },
      count: 2,
    });
  });

  it('reports a redelivery of an unprocessed event as a retry, counts it and clears the error', async () => {
    await webhookEvents.record(db, { id: 'event_retry', type: 'user.updated', payload: { v: 1 } });
    await webhookEvents.markFailed(db, 'event_retry', 'constraint violated');

    expect(await webhookEvents.record(db, { id: 'event_retry', type: 'user.updated', payload: { v: 1 } })).toBe('retry');
    expect(await webhookEvents.record(db, { id: 'event_retry', type: 'user.updated', payload: { v: 1 } })).toBe('retry');
    expect(await read('event_retry')).toEqual([
      { type: 'user.updated', payload: { v: 1 }, processed_at: null, error: null, attempts: 3 },
    ]);
  });

  it('reports a redelivery of a processed event as a duplicate and writes nothing', async () => {
    await webhookEvents.record(db, { id: 'event_dup', type: 'user.updated', payload: { v: 1 } });
    await webhookEvents.markProcessed(db, 'event_dup');
    const before = await read('event_dup');

    const outcome = await webhookEvents.record(db, { id: 'event_dup', type: 'user.deleted', payload: { v: 2 } });

    expect(outcome).toBe('duplicate');
    expect(await read('event_dup')).toEqual(before);
  });
});

describe('webhookEvents.markProcessed / markFailed', () => {
  it('stamps processing and keeps a truncated failure note', async () => {
    await webhookEvents.record(db, { id: 'event_ok', type: 'x', payload: {} });
    await webhookEvents.record(db, { id: 'event_bad', type: 'x', payload: {} });

    await webhookEvents.markProcessed(db, 'event_ok');
    await webhookEvents.markFailed(db, 'event_bad', 'e'.repeat(800));

    expect((await read('event_ok'))[0]?.processed_at).not.toBeNull();

    const [bad] = await read('event_bad');

    expect(bad?.processed_at).toBeNull();
    expect(bad?.error).toHaveLength(500);
  });
});
