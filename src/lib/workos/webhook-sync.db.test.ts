import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import type * as Identity from '@/lib/identity';
import { wrap, type IdentityDb } from '@/lib/identity/internal/handle';
import { AT, event, membership, organization, user } from './webhook-events.test-utils';

/**
 * The webhook's apply step against the real schema: what each event writes,
 * and that the events it must ignore write nothing. The record step keeps
 * an event's ids and times, never a profile, and a deleted user keeps none.
 */

let t: TestDb;

vi.mock('@/lib/identity', async (importOriginal) => {
  const actual = await importOriginal<typeof Identity>();

  return {
    ...actual,
    identityDb: () => wrap(t.db),
    withIdentityTransaction: <T>(fn: (tx: IdentityDb) => Promise<T>) => t.db.transaction((tx) => fn(wrap(tx))),
  };
});

const { applyWebhookEvent, markWebhookEventFailed, markWebhookEventProcessed, recordWebhookEvent } = await import(
  './webhook-sync'
);

beforeAll(async () => {
  t = await createTestDb();
  await t.db.execute(sql`insert into users (id, workos_user_id, email, first_name)
    values ('00000000-0000-4000-8000-0000000000a1', 'user_known', 'known@example.com', 'Known')`);
});

afterAll(async () => {
  await t.close();
});

async function one<T>(query: ReturnType<typeof sql>): Promise<T | undefined> {
  return (await t.db.execute(query)).rows[0] as T | undefined;
}

async function storedPayload(eventId: string): Promise<unknown> {
  return (await one<{ payload: unknown }>(sql`select payload from workos_webhook_events where id = ${eventId}`))?.payload;
}

describe('applyWebhookEvent', () => {
  it('mirrors organization names without touching our own fields', async () => {
    await applyWebhookEvent(event('organization.created', 'e1', organization({ id: 'org_W1', name: 'First' })));
    await t.db.execute(sql`update organizations set plan = 'pro' where id = 'org_W1'`);
    await applyWebhookEvent(event('organization.updated', 'e2', organization({ id: 'org_W1', name: 'Second' })));

    expect(await one(sql`select name, plan from organizations where id = 'org_W1'`)).toEqual({ name: 'Second', plan: 'pro' });
  });

  it('records and mirrors a name the table could not hold instead of failing every retry', async () => {
    const renamed = event('organization.updated', 'e2b', organization({ id: 'org_W1b', name: `Acme\u{0} ${'x'.repeat(150)}` }));

    // In the route's order: recording the NUL used to throw before apply ran.
    expect(await recordWebhookEvent(renamed)).toBe('recorded');
    await applyWebhookEvent(renamed);

    expect(await one(sql`select name from organizations where id = 'org_W1b'`)).toEqual({ name: `Acme ${'x'.repeat(95)}` });
    // The record keeps the organization's id and times, not its name.
    expect(await storedPayload('e2b')).toEqual({ object: 'organization', id: 'org_W1b', createdAt: AT, updatedAt: AT });
  });

  it('soft deletes an organization', async () => {
    await applyWebhookEvent(event('organization.created', 'e3', organization({ id: 'org_W2', name: 'Doomed' })));
    await applyWebhookEvent(event('organization.deleted', 'e4', organization({ id: 'org_W2' })));

    expect(await one(sql`select status from organizations where id = 'org_W2'`)).toEqual({ status: 'deleted' });
  });

  it('mirrors a membership for a known user, creating a placeholder organization', async () => {
    await applyWebhookEvent(
      event(
        'organization_membership.created',
        'e5',
        membership({ id: 'om_W1', organizationId: 'org_W3', userId: 'user_known', role: 'admin' })
      )
    );

    expect(await one(sql`select role, status from organization_memberships where id = 'om_W1'`)).toEqual({
      role: 'admin',
      status: 'active',
    });
    expect(await one(sql`select name from organizations where id = 'org_W3'`)).toEqual({ name: 'org_W3' });

    await applyWebhookEvent(
      event('organization_membership.deleted', 'e6', membership({ id: 'om_W1', organizationId: 'org_W3', userId: 'user_known' }))
    );

    expect(await one(sql`select status from organization_memberships where id = 'om_W1'`)).toEqual({ status: 'inactive' });
  });

  it('names a placeholder organization from the membership event when WorkOS sends the name', async () => {
    await applyWebhookEvent(
      event(
        'organization_membership.created',
        'e5b',
        membership({ id: 'om_W1b', organizationId: 'org_W3b', userId: 'user_known', organizationName: 'Named' })
      )
    );

    expect(await one(sql`select name from organizations where id = 'org_W3b'`)).toEqual({ name: 'Named' });
  });

  it('ignores a membership for a user it has never seen, and malformed ids', async () => {
    await applyWebhookEvent(
      event('organization_membership.created', 'e7', membership({ id: 'om_W2', organizationId: 'org_W4', userId: 'user_unknown' }))
    );
    await applyWebhookEvent(
      event(
        'organization_membership.created',
        'e8',
        membership({ id: 'not_a_membership', organizationId: 'org_W4', userId: 'user_known' })
      )
    );

    expect(await one(sql`select count(*)::int as n from organization_memberships where organization_id = 'org_W4'`)).toEqual({ n: 0 });
    expect(await one(sql`select count(*)::int as n from organizations where id = 'org_W4'`)).toEqual({ n: 0 });
  });

  it('updates a profile without letting null erase it, and deactivates on delete', async () => {
    await applyWebhookEvent(
      event('user.updated', 'e9', user({ id: 'user_known', email: 'new@example.com', firstName: null, lastName: 'Last' }))
    );

    expect(await one(sql`select email, first_name, last_name from users where workos_user_id = 'user_known'`)).toEqual({
      email: 'new@example.com',
      first_name: 'Known',
      last_name: 'Last',
    });

    await applyWebhookEvent(
      event('organization_membership.created', 'e10', membership({ id: 'om_W3', organizationId: 'org_W5', userId: 'user_known' }))
    );
    await applyWebhookEvent(event('user.deleted', 'e11', user({ id: 'user_known' })));

    expect(await one(sql`select status from users where workos_user_id = 'user_known'`)).toEqual({ status: 'inactive' });
    expect(await one(sql`select status from organization_memberships where id = 'om_W3'`)).toEqual({ status: 'inactive' });
  });

  it('writes the avatar a user.updated carries', async () => {
    await applyWebhookEvent(
      event(
        'user.updated',
        'e9b',
        user({ id: 'user_known', email: 'new@example.com', profilePictureUrl: 'https://example.com/a.png' })
      )
    );

    expect(await one(sql`select avatar_url from users where workos_user_id = 'user_known'`)).toEqual({
      avatar_url: 'https://example.com/a.png',
    });
  });

  it("scrubs a deleted user's profile, keeping the row inactive", async () => {
    await t.db.execute(sql`insert into users (id, workos_user_id, email, first_name, last_name, avatar_url)
      values ('00000000-0000-4000-8000-0000000000a2', 'user_scrub', 'scrub@example.com', 'Scrub', 'Me', 'https://example.com/s.png')`);

    await applyWebhookEvent(event('user.deleted', 'e11b', user({ id: 'user_scrub', email: 'scrub@example.com', firstName: 'Scrub' })));

    expect(
      await one(sql`select id, email, first_name, last_name, avatar_url, status from users where workos_user_id = 'user_scrub'`)
    ).toEqual({
      id: '00000000-0000-4000-8000-0000000000a2',
      email: 'user_scrub@deleted.invalid',
      first_name: null,
      last_name: null,
      avatar_url: null,
      status: 'inactive',
    });
  });

  it('fails loudly on a status the schema does not allow', async () => {
    await t.db.execute(sql`update users set status = 'active' where workos_user_id = 'user_known'`);
    const bad = membership({ id: 'om_W4', organizationId: 'org_W6', userId: 'user_known' });

    await expect(
      applyWebhookEvent(
        // A status outside the SDK's union: what an API change would look like.
        event('organization_membership.updated', 'e12', { ...bad, status: 'banana' as 'active' })
      )
    ).rejects.toThrow();
    // The transaction rolled back the placeholder organization too.
    expect(await one(sql`select count(*)::int as n from organizations where id = 'org_W6'`)).toEqual({ n: 0 });
  });
});

describe('applyWebhookEvent, delivered out of order', () => {
  const T1 = '2026-09-23T11:00:00.000Z';
  const T2 = '2026-09-23T12:00:00.000Z';
  const T3 = '2026-09-23T13:00:00.000Z';

  beforeAll(async () => {
    await t.db.execute(sql`insert into users (workos_user_id, email, first_name)
      values ('user_order', 'order@example.com', 'Stored')`);
  });

  it('keeps a membership deleted at t2 inactive when an update from t1 arrives late, and revives it at t3', async () => {
    const fields = { id: 'om_ORD', organizationId: 'org_ORD', userId: 'user_order' };

    await applyWebhookEvent(event('organization_membership.created', 'o1', membership({ ...fields, updatedAt: T1 }), T1));
    await applyWebhookEvent(event('organization_membership.deleted', 'o2', membership({ ...fields, updatedAt: T1 }), T2));
    // The update WorkOS made at t1, delivered after the deletion.
    await applyWebhookEvent(
      event('organization_membership.updated', 'o3', membership({ ...fields, role: 'admin', updatedAt: T1 }), T1)
    );

    expect(await one(sql`select status, role from organization_memberships where id = 'om_ORD'`)).toEqual({
      status: 'inactive',
      role: 'member',
    });

    await applyWebhookEvent(event('organization_membership.updated', 'o4', membership({ ...fields, updatedAt: T3 }), T3));

    expect(await one(sql`select status from organization_memberships where id = 'om_ORD'`)).toEqual({ status: 'active' });
  });

  it('ignores a user.updated older than the stored profile', async () => {
    await applyWebhookEvent(event('user.updated', 'o5', user({ id: 'user_order', email: 'order@example.com', firstName: 'Newer', updatedAt: T2 })));
    await applyWebhookEvent(event('user.updated', 'o6', user({ id: 'user_order', email: 'old@example.com', firstName: 'Older', updatedAt: T1 })));

    expect(await one(sql`select email, first_name from users where workos_user_id = 'user_order'`)).toEqual({
      email: 'order@example.com',
      first_name: 'Newer',
    });
  });

  it("does not restore a deleted user's profile from a late user.updated older than the deletion", async () => {
    await t.db.execute(sql`insert into users (workos_user_id, email, first_name)
      values ('user_order_gone', 'gone@example.com', 'Gone')`);

    await applyWebhookEvent(event('user.deleted', 'o10', user({ id: 'user_order_gone', updatedAt: T1 }), T2));
    // The change WorkOS made at t1, delivered after the deletion.
    await applyWebhookEvent(
      event('user.updated', 'o11', user({ id: 'user_order_gone', email: 'late@example.com', firstName: 'Late', updatedAt: T1 }), T1)
    );

    expect(await one(sql`select email, first_name, status from users where workos_user_id = 'user_order_gone'`)).toEqual({
      email: 'user_order_gone@deleted.invalid',
      first_name: null,
      status: 'inactive',
    });
  });

  it('does not rename an organization with an update older than its deletion', async () => {
    await applyWebhookEvent(event('organization.created', 'o7', organization({ id: 'org_ORD2', name: 'Kept', updatedAt: T1 }), T1));
    await applyWebhookEvent(event('organization.deleted', 'o8', organization({ id: 'org_ORD2', name: 'Kept', updatedAt: T1 }), T2));
    await applyWebhookEvent(event('organization.updated', 'o9', organization({ id: 'org_ORD2', name: 'Late', updatedAt: T1 }), T1));

    expect(await one(sql`select name, status from organizations where id = 'org_ORD2'`)).toEqual({ name: 'Kept', status: 'deleted' });
  });
});

describe('recordWebhookEvent', () => {
  it('reports a redelivery as a retry until the event is processed, then as a duplicate', async () => {
    const recorded = event('user.updated', 'event_rec', user({ id: 'user_rec' }));

    expect(await recordWebhookEvent(recorded)).toBe('recorded');
    expect(await recordWebhookEvent(recorded)).toBe('retry');
    await markWebhookEventProcessed(recorded.id);
    expect(await recordWebhookEvent(recorded)).toBe('duplicate');
  });

  it("records an event's ids and times, never the profile", async () => {
    const updatedAt = '2026-09-23T10:30:00.000Z';
    const updated = event(
      'user.updated',
      'event_audit_user',
      user({ id: 'user_audit', email: 'audit@example.com', firstName: 'Audit', lastName: 'Me', profilePictureUrl: 'https://example.com/p.png', updatedAt })
    );

    await recordWebhookEvent(updated);

    expect(await storedPayload('event_audit_user')).toEqual({ object: 'user', id: 'user_audit', createdAt: AT, updatedAt });
  });

  it("keeps a membership's role as its slug, and not the organization's name", async () => {
    const created = event(
      'organization_membership.created',
      'event_audit_membership',
      membership({ id: 'om_AUDIT', organizationId: 'org_AUDIT', userId: 'user_audit', organizationName: 'Audit Ltd', role: 'admin' })
    );

    await recordWebhookEvent(created);

    expect(await storedPayload('event_audit_membership')).toEqual({
      object: 'organization_membership',
      id: 'om_AUDIT',
      organizationId: 'org_AUDIT',
      userId: 'user_audit',
      status: 'active',
      role: 'admin',
      createdAt: AT,
      updatedAt: AT,
    });
  });

  it('keeps no IP address, user agent or impersonator from an event it does not apply', async () => {
    const session = event('session.created', 'event_audit_session', {
      object: 'session',
      id: 'session_AUDIT',
      userId: 'user_audit',
      ipAddress: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      organizationId: 'org_AUDIT',
      impersonator: { email: 'support@example.com', reason: 'Audit' },
      authMethod: 'password',
      status: 'active',
      expiresAt: AT,
      endedAt: null,
      createdAt: AT,
      updatedAt: AT,
    });

    await recordWebhookEvent(session);

    expect(await storedPayload('event_audit_session')).toEqual({
      object: 'session',
      id: 'session_AUDIT',
      userId: 'user_audit',
      organizationId: 'org_AUDIT',
      status: 'active',
      createdAt: AT,
      updatedAt: AT,
    });
  });
});

describe('markWebhookEventFailed', () => {
  it('keeps the database reason for a replay, without the statement or its values', async () => {
    // A status the CHECK refuses, carrying a value that must not be kept.
    // This used to be an organization name over 100 characters, which the
    // mirror now stores cut to 100 instead of failing.
    const bad = membership({ id: 'om_FAIL', organizationId: 'org_FAIL', userId: 'user_known' });
    const failing = event('organization_membership.created', 'event_fail', { ...bad, status: 'Secret-status' as 'active' });

    await recordWebhookEvent(failing);

    const failure = await applyWebhookEvent(failing).then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).not.toBeNull();
    await markWebhookEventFailed(failing.id, failure);

    const row = await one<{ error: string }>(sql`select error from workos_webhook_events where id = 'event_fail'`);

    expect(row?.error).toContain('organization_memberships_status_check');
    expect(row?.error).toContain('SQLSTATE 23514');
    expect(row?.error).not.toMatch(/Secret|Failed query|params/i);
  });
});
