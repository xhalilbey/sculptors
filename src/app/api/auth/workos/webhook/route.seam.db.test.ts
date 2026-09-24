import { WorkOS } from '@workos-inc/node';
import { sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import type * as Identity from '@/lib/identity';
import { wrap, type IdentityDb } from '@/lib/identity/internal/handle';
import { wireMembershipEvent, wireUserUpdatedEvent } from '@/lib/workos/webhook-events.test-utils';

/**
 * The webhook through its real seam: snake_case JSON as WorkOS POSTs it,
 * signed with the SDK's own computeSignature, verified and deserialized by
 * the real WorkOS client (constructEvent does both locally, no network),
 * applied by the real webhook-sync on PGlite.
 *
 * Every other webhook test fed hand-written events to one side of that
 * seam, which is how the mirror read `data.organization_id` from events the
 * SDK had already turned into `data.organizationId`: each membership event
 * was recorded, marked processed, and mirrored nothing.
 */

const SECRET = 'whsec_seam_test';
const workos = new WorkOS('sk_test_dummy', { clientId: 'client_seam_test' });

let t: TestDb;
/** Makes the next identity transaction throw, like a dropped connection would. */
let failNextTransaction = false;

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/workos/client', () => ({ getWorkOSClient: () => workos }));
vi.mock('@/lib/identity', async (importOriginal) => {
  const actual = await importOriginal<typeof Identity>();

  return {
    ...actual,
    identityDb: () => wrap(t.db),
    withIdentityTransaction: <T>(fn: (tx: IdentityDb) => Promise<T>) => {
      if (failNextTransaction) {
        failNextTransaction = false;

        return Promise.reject(new Error('Connection terminated unexpectedly'));
      }

      return t.db.transaction((tx) => fn(wrap(tx)));
    },
  };
});

const { POST } = await import('./route');

async function deliver(payload: Record<string, unknown>) {
  const timestamp = Date.now();
  const signature = await workos.webhooks.computeSignature(timestamp, payload, SECRET);

  return POST(
    new NextRequest('http://localhost/api/auth/workos/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'workos-signature': `t=${timestamp}, v1=${signature}` },
      body: JSON.stringify(payload),
    })
  );
}

async function one<T>(query: ReturnType<typeof sql>): Promise<T | undefined> {
  return (await t.db.execute(query)).rows[0] as T | undefined;
}

beforeAll(async () => {
  t = await createTestDb();
  await t.db.execute(sql`insert into users (id, workos_user_id, email, first_name)
    values ('00000000-0000-4000-8000-0000000000c1', 'user_seam', 'seam@example.com', 'Before')`);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await t.close();
});

describe('POST /api/auth/workos/webhook, end to end', () => {
  it('mirrors a membership through created, updated and deleted', async () => {
    vi.stubEnv('WORKOS_WEBHOOK_SECRET', SECRET);
    const fields = { id: 'om_SEAM1', organizationId: 'org_SEAM1', userId: 'user_seam', organizationName: 'Seam Org' };

    let response = await deliver(wireMembershipEvent('organization_membership.created', 'event_seam_1', fields));

    expect(response.status).toBe(200);
    expect(await one(sql`select role, status, organization_id from organization_memberships where id = 'om_SEAM1'`)).toEqual({
      role: 'member',
      status: 'active',
      organization_id: 'org_SEAM1',
    });
    expect(await one(sql`select name from organizations where id = 'org_SEAM1'`)).toEqual({ name: 'Seam Org' });

    response = await deliver(
      wireMembershipEvent('organization_membership.updated', 'event_seam_2', { ...fields, role: 'admin' })
    );

    expect(response.status).toBe(200);
    expect(await one(sql`select role from organization_memberships where id = 'om_SEAM1'`)).toEqual({ role: 'admin' });

    response = await deliver(wireMembershipEvent('organization_membership.deleted', 'event_seam_3', fields));

    expect(response.status).toBe(200);
    expect(await one(sql`select status from organization_memberships where id = 'om_SEAM1'`)).toEqual({ status: 'inactive' });
    expect(await one(sql`select count(*)::int as n from workos_webhook_events where processed_at is not null and id like 'event_seam_%'`)).toEqual({ n: 3 });
  });

  it('writes the first name, last name and avatar of a user.updated', async () => {
    vi.stubEnv('WORKOS_WEBHOOK_SECRET', SECRET);

    const response = await deliver(
      wireUserUpdatedEvent('event_seam_user', {
        id: 'user_seam',
        email: 'seam@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        profilePictureUrl: 'https://example.com/ada.png',
      })
    );

    expect(response.status).toBe(200);
    expect(await one(sql`select first_name, last_name, avatar_url from users where workos_user_id = 'user_seam'`)).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      avatar_url: 'https://example.com/ada.png',
    });
  });

  it('applies a redelivery of an event whose apply failed, and counts the attempts', async () => {
    vi.stubEnv('WORKOS_WEBHOOK_SECRET', SECRET);
    const payload = wireMembershipEvent('organization_membership.created', 'event_seam_retry', {
      id: 'om_RETRY',
      organizationId: 'org_RETRY',
      userId: 'user_seam',
    });

    failNextTransaction = true;
    let response = await deliver(payload);

    expect(response.status).toBe(500);
    expect(await one(sql`select processed_at, error, attempts from workos_webhook_events where id = 'event_seam_retry'`)).toEqual({
      processed_at: null,
      error: 'Connection terminated unexpectedly',
      attempts: 1,
    });
    expect(await one(sql`select count(*)::int as n from organization_memberships where id = 'om_RETRY'`)).toEqual({ n: 0 });

    // WorkOS retries the same signed payload.
    response = await deliver(payload);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(await one(sql`select status from organization_memberships where id = 'om_RETRY'`)).toEqual({ status: 'active' });

    const row = await one<{ processed_at: Date | null; error: string | null; attempts: number }>(
      sql`select processed_at, error, attempts from workos_webhook_events where id = 'event_seam_retry'`
    );

    expect(row?.processed_at).not.toBeNull();
    expect(row?.error).toBeNull();
    expect(row?.attempts).toBe(2);
  });

  it('acknowledges a redelivery of a processed event without applying it again', async () => {
    vi.stubEnv('WORKOS_WEBHOOK_SECRET', SECRET);
    const payload = wireMembershipEvent('organization_membership.created', 'event_seam_once', {
      id: 'om_ONCE',
      organizationId: 'org_ONCE',
      userId: 'user_seam',
    });

    expect((await deliver(payload)).status).toBe(200);
    // A change made since (a later event, or by hand) must survive the replay.
    await t.db.execute(sql`update organization_memberships set role = 'admin' where id = 'om_ONCE'`);

    const response = await deliver(payload);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(await one(sql`select role from organization_memberships where id = 'om_ONCE'`)).toEqual({ role: 'admin' });
    expect(await one(sql`select attempts from workos_webhook_events where id = 'event_seam_once'`)).toEqual({ attempts: 1 });
  });

  it('refuses a payload whose signature was computed for other bytes', async () => {
    vi.stubEnv('WORKOS_WEBHOOK_SECRET', SECRET);
    const payload = wireMembershipEvent('organization_membership.created', 'event_seam_forged', {
      id: 'om_FORGED',
      organizationId: 'org_FORGED',
      userId: 'user_seam',
    });
    const timestamp = Date.now();
    const signature = await workos.webhooks.computeSignature(timestamp, { ...payload, id: 'other' }, SECRET);

    const response = await POST(
      new NextRequest('http://localhost/api/auth/workos/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'workos-signature': `t=${timestamp}, v1=${signature}` },
        body: JSON.stringify(payload),
      })
    );

    expect(response.status).toBe(401);
    expect(await one(sql`select count(*)::int as n from organization_memberships where id = 'om_FORGED'`)).toEqual({ n: 0 });
  });
});
