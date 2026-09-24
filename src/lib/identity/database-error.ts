import { DrizzleQueryError } from 'drizzle-orm';

/**
 * Why a query failed, without the query's values.
 *
 * Drizzle wraps every driver error in a DrizzleQueryError whose message is
 * `Failed query: <sql>\nparams: <values>`. The values are user data (emails,
 * names, whole webhook payloads) and the SQL is not the reason; Postgres's own
 * message, SQLSTATE and constraint are on `.cause`. The driver's `detail` is
 * left out on purpose: for a unique violation it echoes the key's value.
 */
export type DatabaseFailure = {
  reason: string;
  code?: string;
  constraint?: string;
};

export function describeDatabaseFailure(error: unknown): DatabaseFailure {
  if (error instanceof DrizzleQueryError) {
    // Without a cause the only text is the SQL and its values; say nothing.
    if (!(error.cause instanceof Error)) return { reason: 'query failed' };

    return fromDriverError(error.cause);
  }

  if (error instanceof Error) return fromDriverError(error);

  return { reason: 'unknown error' };
}

/**
 * A statement that must return a row returned none: `insert ... on conflict
 * do update ... returning` always yields one, so this is a driver or schema
 * surprise, reported as such instead of a row typed as present.
 */
export class RowNotReturnedError extends Error {
  constructor(operation: string) {
    super(`${operation} returned no row`);
    this.name = 'RowNotReturnedError';
  }
}

/** One line for a stored note, such as workos_webhook_events.error. */
export function databaseFailureNote(error: unknown): string {
  const { reason, code } = describeDatabaseFailure(error);

  return code ? `${reason} (SQLSTATE ${code})` : reason;
}

function fromDriverError(error: Error): DatabaseFailure {
  // pg's DatabaseError and PGlite's both carry these; neither is typed on Error.
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };

  return {
    reason: error.message,
    ...(typeof code === 'string' && { code }),
    ...(typeof constraint === 'string' && { constraint }),
  };
}
