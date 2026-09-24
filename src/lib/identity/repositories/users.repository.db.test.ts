import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '@/db/testing/pglite';
import { wrap, type IdentityDb } from '../internal/handle';
import { seedUser } from '../testing.test-utils';
import * as users from './users.repository';

let t: TestDb;
/** The PGlite handle, sealed the way services hand it to repositories. */
let db: IdentityDb;
/** Every write here comes from the same WorkOS moment unless a test says otherwise. */
const T0 = new Date('2026-09-01T00:00:00Z');

beforeAll(async () => {
  t = await createTestDb();
  db = wrap(t.db);
});

afterAll(async () => {
  await t.close();
});

describe('users.upsertFromWorkOS', () => {
  it('creates the user active and seen', async () => {
    const row = await users.upsertFromWorkOS(db, {
      workosUserId: 'user_new',
      email: 'new@example.com',
      firstName: 'Ada',
      lastName: null,
      avatarUrl: null,
      workosUpdatedAt: null,
    });

    expect(row).toMatchObject({ workosUserId: 'user_new', email: 'new@example.com', firstName: 'Ada', status: 'active' });
    expect(row.lastSeenAt).toBeInstanceOf(Date);
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it('refreshes profile and last_seen_at but keeps status, id and created_at', async () => {
    const first = await users.upsertFromWorkOS(db, {
      workosUserId: 'user_refresh',
      email: 'old@example.com',
      firstName: 'Old',
      lastName: 'Name',
      avatarUrl: 'https://example.com/a.png',
      workosUpdatedAt: null,
    });

    await t.db.execute(sql`update users set status = 'inactive', created_at = now() - interval '2 days' where id = ${first.id}`);
    const createdBefore = (
      await t.db.execute<{ created_at: string }>(sql`select created_at::text from users where id = ${first.id}`)
    ).rows[0]?.created_at;

    const later = new Date(Date.now() + 60_000);
    const second = await users.upsertFromWorkOS(
      db,
      { workosUserId: 'user_refresh', email: 'renamed@example.com', firstName: 'New', lastName: null, avatarUrl: null, workosUpdatedAt: null },
      later
    );
    const createdAfter = (
      await t.db.execute<{ created_at: string }>(sql`select created_at::text from users where id = ${first.id}`)
    ).rows[0]?.created_at;

    expect(createdBefore).toBeDefined();

    expect(second.id).toBe(first.id);
    expect(createdAfter).toBe(createdBefore);
    // Status is ours: a sign-in does not undo what was set on the row.
    expect(second).toMatchObject({ email: 'renamed@example.com', firstName: 'New', lastName: null, avatarUrl: null, status: 'inactive' });
    expect(second.lastSeenAt?.getTime()).toBe(later.getTime());
  });

  it('lets a new WorkOS user sign in with the address of a deleted one', async () => {
    // User A, deleted in WorkOS (user.deleted marks the row inactive).
    await seedUser(db, { workosUserId: 'user_reused_a', email: 'Reused@Example.com' });
    await users.deactivateByWorkOSUserId(db, 'user_reused_a', T0);

    // User B, a different WorkOS identity with the same address.
    const b = await users.upsertFromWorkOS(db, {
      workosUserId: 'user_reused_b',
      email: 'reused@example.com',
      firstName: null,
      lastName: null,
      avatarUrl: null,
      workosUpdatedAt: null,
    });

    expect(b).toMatchObject({ workosUserId: 'user_reused_b', status: 'active' });
    expect(await users.findIdByWorkOSUserId(db, 'user_reused_a')).not.toBe(b.id);
  });
});

describe('users.upsertFromWorkOS, ordered', () => {
  it('keeps a newer profile when a sign-in carries an older snapshot', async () => {
    const newer = new Date('2026-09-20T00:00:00Z');
    const older = new Date('2026-09-10T00:00:00Z');

    await users.upsertFromWorkOS(db, {
      workosUserId: 'user_order',
      email: 'order-new@example.com',
      firstName: 'New',
      lastName: null,
      avatarUrl: null,
      workosUpdatedAt: newer,
    });
    const row = await users.upsertFromWorkOS(db, {
      workosUserId: 'user_order',
      email: 'order-old@example.com',
      firstName: 'Old',
      lastName: 'Stale',
      avatarUrl: null,
      workosUpdatedAt: older,
    });

    expect(row).toMatchObject({ email: 'order-new@example.com', firstName: 'New', lastName: null, workosUpdatedAt: newer });
  });
});

describe('users lookups and webhook writes', () => {
  it('finds a user by WorkOS id, null when missing', async () => {
    const id = await seedUser(db, { workosUserId: 'user_lookup', firstName: 'Look' });

    expect(await users.findByWorkOSUserId(db, 'user_lookup')).toMatchObject({ id, status: 'active', firstName: 'Look' });
    expect(await users.findIdByWorkOSUserId(db, 'user_lookup')).toBe(id);
    expect(await users.findIdByWorkOSUserId(db, 'user_nobody')).toBeNull();
    expect(await users.findByWorkOSUserId(db, 'user_nobody')).toBeNull();
  });

  it('keeps a suspended user suspended when they sign in again', async () => {
    const id = await seedUser(db, { workosUserId: 'user_suspended' });

    await t.db.execute(sql`update users set status = 'suspended' where id = ${id}`);
    const row = await users.upsertFromWorkOS(db, {
      workosUserId: 'user_suspended',
      email: 'person-suspended@example.com',
      firstName: null,
      lastName: null,
      avatarUrl: null,
      workosUpdatedAt: null,
    });

    expect(row.status).toBe('suspended');
  });

  it('writes last_seen_at at most once per resolution window', async () => {
    const id = await seedUser(db, { workosUserId: 'user_seen' });
    const now = new Date('2026-09-23T12:00:00Z');

    await t.db.execute(sql`update users set last_seen_at = ${new Date(now.getTime() - 5 * 60_000).toISOString()} where id = ${id}`);
    await users.touchLastSeen(db, id, now);

    const recent = (await users.findByWorkOSUserId(db, 'user_seen'))?.lastSeenAt;

    expect(recent?.getTime()).toBe(now.getTime() - 5 * 60_000);

    await t.db.execute(sql`update users set last_seen_at = ${new Date(now.getTime() - 20 * 60_000).toISOString()} where id = ${id}`);
    await users.touchLastSeen(db, id, now);

    expect((await users.findByWorkOSUserId(db, 'user_seen'))?.lastSeenAt?.getTime()).toBe(now.getTime());
  });

  it('applies only the profile fields that carry a value', async () => {
    const id = await seedUser(db, { workosUserId: 'user_patch', firstName: 'Keep', lastName: 'Me' });

    await users.updateProfileByWorkOSUserId(db, 'user_patch', { firstName: 'Changed', lastName: null, email: undefined }, T0);
    await users.updateProfileByWorkOSUserId(db, 'user_patch', {}, T0);

    const [row] = (await t.db.execute<{ first_name: string; last_name: string }>(
      sql`select first_name, last_name from users where id = ${id}`
    )).rows;

    expect(row).toEqual({ first_name: 'Changed', last_name: 'Me' });
  });

  it('deactivates by WorkOS id and scrubs the profile, keeping the row and its identity', async () => {
    const id = await seedUser(db, {
      workosUserId: 'user_gone',
      email: 'gone@example.com',
      firstName: 'Gone',
      lastName: 'Away',
      avatarUrl: 'https://example.com/gone.png',
    });

    await users.deactivateByWorkOSUserId(db, 'user_gone', T0);

    expect(await users.findByWorkOSUserId(db, 'user_gone')).toMatchObject({
      id,
      workosUserId: 'user_gone',
      email: 'user_gone@deleted.invalid',
      firstName: null,
      lastName: null,
      avatarUrl: null,
      status: 'inactive',
    });
  });

  it('leaves a profile newer than the deletion as it is', async () => {
    const later = new Date(T0.getTime() + 60_000);

    await seedUser(db, { workosUserId: 'user_stale_delete', email: 'kept@example.com', firstName: 'Kept', workosUpdatedAt: later });
    await users.deactivateByWorkOSUserId(db, 'user_stale_delete', T0);

    expect(await users.findByWorkOSUserId(db, 'user_stale_delete')).toMatchObject({
      email: 'kept@example.com',
      firstName: 'Kept',
      status: 'active',
    });
  });
});
