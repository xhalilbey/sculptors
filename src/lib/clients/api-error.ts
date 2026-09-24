import { errorResponseSchema } from '@/lib/validations/organizations.schema';

/**
 * A failed call to our own API, carrying the server's (already sanitized)
 * message when the body had one, so the UI can show it as it did before.
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Reads a JSON body, or undefined when there is none or it is not JSON. */
export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function toApiRequestError(response: Response, body: unknown, fallback: string): ApiRequestError {
  const parsed = errorResponseSchema.safeParse(body);

  return new ApiRequestError(parsed.success ? parsed.data.error : fallback, response.status);
}

/**
 * GETs one of our JSON endpoints with the session cookie, past the HTTP
 * cache, and hands back the body unparsed: each caller parses it with its
 * own wire schema. A non-2xx answer throws an ApiRequestError carrying the
 * server's message, or `failure` when the body has none. `signal` goes to
 * fetch as given, so an abort before the answer arrives rejects with the
 * browser's own AbortError. Commerce kept this as a private helper while
 * metrics and System Health wrote the same lines out by hand; it now lives
 * here once (24 Sep 2026).
 */
export async function getJson(
  path: string,
  failure: string,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await fetch(path, { credentials: 'include', cache: 'no-store', signal });
  const body = await readJson(response);

  if (!response.ok) throw toApiRequestError(response, body, failure);

  return body;
}
