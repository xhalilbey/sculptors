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
