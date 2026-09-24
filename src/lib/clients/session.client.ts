import { type z } from 'zod';
import { sessionResponseSchema } from '@/lib/validations/organizations.schema';
import { readJson } from './api-error';

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/**
 * What GET /api/auth/me answered: a session, or the status that says why
 * there is none. A union, so a caller cannot hold a 2xx without a session
 * (the old `{ status, session? }` shape needed a branch for that, which
 * could never run).
 */
type SessionResult = { ok: true; session: SessionResponse } | { ok: false; status: number };

/**
 * GET /api/auth/me. A non-2xx status is returned rather than thrown: 401 is
 * an answer (signed out), not a failure. A 2xx body that does not match the
 * contract throws, which the provider treats as signed out and logs.
 */
export async function fetchSession(): Promise<SessionResult> {
  const response = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });

  if (!response.ok) return { ok: false, status: response.status };

  return { ok: true, session: sessionResponseSchema.parse(await readJson(response)) };
}
