import { AppError } from '@/types/errors';

/**
 * What a route tells the client when something it ran threw.
 *
 * One invariant: the raw text of an error the codebase did not throw on
 * purpose never reaches the client. A DrizzleQueryError's message holds the
 * SQL and its bound values, and a pg or WorkOS error can name hosts and
 * internals, so anything that is not an AppError is answered with one
 * generic sentence. An AppError, ValidationError included, was written for
 * the caller ('Request body must be valid JSON', 'Invalid organization id')
 * and keeps its own message.
 *
 * Until 24 Sep this module guessed instead. Every ValidationError became
 * 'Please check your input and try again.', because it looked for field
 * errors that no code attaches, and any message mentioning network, fetch
 * or connection became 'Please check your internet connection', so a 500
 * from `TypeError('fetch failed')` or pg's 'Connection terminated' blamed
 * the user's network for our outage.
 */

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * The message a route answers with for `error`, sent with `status`. A server
 * failure (5xx) always gets the generic sentence, an AppError's included:
 * the fault is ours and its details are not the caller's to act on.
 */
export function clientMessage(error: Error, status: number): string {
  if (status >= 500) return GENERIC_MESSAGE;

  return error instanceof AppError && error.message ? error.message : GENERIC_MESSAGE;
}
