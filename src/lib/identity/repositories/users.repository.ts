import 'server-only';

import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { users, type UserRow } from '@/db/schema';
import type { UserId } from '@/types/ids';
import { RowNotReturnedError } from '../database-error';
import { unwrap, type IdentityDb } from '../internal/handle';
import { fromProposedIfNotOlder, laterStamp, storedIsNotNewer } from './mirror-order';

/** What WorkOS told us about a user at sign-in. */
export type WorkOSProfile = {
  workosUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  /** The WorkOS user's updatedAt, when the caller has it. */
  workosUpdatedAt: Date | null;
};

/**
 * Insert or refresh the user WorkOS just authenticated (sign-in only). A new
 * row starts 'active'; an existing row's `status` is NEVER touched -- it is
 * ours (a suspension, or a deletion WorkOS reported), and signing in must not
 * undo it. `last_seen_at` is refreshed; the profile fields only when this
 * snapshot is not older than the stored one (mirror-order.ts). `id` and
 * `created_at` are never touched, so the user keeps their identity.
 */
export async function upsertFromWorkOS(handle: IdentityDb, profile: WorkOSProfile, seenAt = new Date()): Promise<UserRow> {
  const db = unwrap(handle);

  const [row] = await db
    .insert(users)
    .values({ ...profile, status: 'active', lastSeenAt: seenAt })
    .onConflictDoUpdate({
      target: users.workosUserId,
      set: {
        email: fromProposedIfNotOlder('users', 'email'),
        firstName: fromProposedIfNotOlder('users', 'first_name'),
        lastName: fromProposedIfNotOlder('users', 'last_name'),
        avatarUrl: fromProposedIfNotOlder('users', 'avatar_url'),
        workosUpdatedAt: laterStamp('users'),
        lastSeenAt: sql`excluded.last_seen_at`,
      },
    })
    .returning();

  if (!row) throw new RowNotReturnedError('users.upsertFromWorkOS');

  return row;
}

/** What per-request session resolution reads about a user: identity, status, profile. */
export type UserSnapshot = Pick<
  UserRow,
  'id' | 'workosUserId' | 'email' | 'firstName' | 'lastName' | 'avatarUrl' | 'status' | 'lastSeenAt'
>;

export async function findByWorkOSUserId(handle: IdentityDb, workosUserId: string): Promise<UserSnapshot | null> {
  const db = unwrap(handle);

  const [row] = await db
    .select({
      id: users.id,
      workosUserId: users.workosUserId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      status: users.status,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .where(eq(users.workosUserId, workosUserId))
    .limit(1);

  return row ?? null;
}

/** How stale last_seen_at may get before a request writes it again. */
export const LAST_SEEN_RESOLUTION_MS = 15 * 60 * 1000;

/**
 * Record activity, at most once per LAST_SEEN_RESOLUTION_MS per user: the
 * only write the per-request path makes, and a no-op for most requests.
 */
export async function touchLastSeen(handle: IdentityDb, userId: UserId, now = new Date()): Promise<void> {
  const db = unwrap(handle);
  const threshold = new Date(now.getTime() - LAST_SEEN_RESOLUTION_MS);

  await db
    .update(users)
    .set({ lastSeenAt: now })
    .where(and(eq(users.id, userId), or(isNull(users.lastSeenAt), lt(users.lastSeenAt, threshold))));
}

export async function findIdByWorkOSUserId(handle: IdentityDb, workosUserId: string): Promise<UserId | null> {
  const db = unwrap(handle);

  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workosUserId, workosUserId))
    .limit(1);

  return row?.id ?? null;
}

/**
 * Apply a profile change WorkOS reported by webhook. Only fields that carry a
 * value are written: WorkOS sends null for "not set", and a null must not
 * erase what the last sign-in cached. `at` is the WorkOS user's updatedAt;
 * a row written from a newer state is left alone.
 */
export async function updateProfileByWorkOSUserId(
  handle: IdentityDb,
  workosUserId: string,
  patch: { email?: string | null; firstName?: string | null; lastName?: string | null; avatarUrl?: string | null },
  at: Date
): Promise<void> {
  const db = unwrap(handle);

  const set = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== null && value !== undefined)
  ) as Partial<Pick<UserRow, 'email' | 'firstName' | 'lastName' | 'avatarUrl'>>;

  if (Object.keys(set).length === 0) return;

  await db
    .update(users)
    .set({ ...set, workosUpdatedAt: at })
    .where(and(eq(users.workosUserId, workosUserId), storedIsNotNewer(users.workosUpdatedAt, at)));
}

/** A user deleted in WorkOS at `at`. The stamp makes a late 'updated' from before it lose. */
export async function deactivateByWorkOSUserId(handle: IdentityDb, workosUserId: string, at: Date): Promise<void> {
  const db = unwrap(handle);

  await db
    .update(users)
    .set({ status: 'inactive', workosUpdatedAt: at })
    .where(and(eq(users.workosUserId, workosUserId), storedIsNotNewer(users.workosUpdatedAt, at)));
}
