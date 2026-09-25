/**
 * Error types for the application
 */

/**
 * Base application error
 *
 * A route answers with `statusCode` and the message alone
 * (lib/error-handler.ts), and the logger writes an error's name and
 * message, so `code` and `context` reach neither a client nor a log line.
 * `code` stays as the failure's stable name ('PAYLOAD_TOO_LARGE') for
 * whoever holds the error, a test or a debugger. Until 24 Sep the error
 * handler copied it into the object it built for a response, of which
 * defineRoute sent only the message.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation errors: a 400 whose message is written for the caller. A
 * request's field errors do not travel here: defineRoute answers a
 * ZodError with them itself. The `fields` this class used to take were
 * never attached by any code, and their last reader went on 24 Sep.
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
