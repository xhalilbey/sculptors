/**
 * Secure production-ready logger utility
 * Provides structured logging with sensitive data filtering
 */
/* eslint-disable no-console */

import { maskEmail } from './security/crypto-utils';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Sensitive keys that should be masked in logs
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'apiKey',
  'api_key',
  'apikey',
  'secret',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'idToken',
  'id_token',
  'authorization',
  'auth',
  'Bearer',
  'sessionId',
  'session_id',
  'cookie',
  'csrf',
  'ssn',
  'creditCard',
  'credit_card',
  'cvv',
  'pin',
]);

type QueryError = Error & { query: string; params: unknown[] };

/**
 * Drizzle reports a failed query as an Error whose message is
 * `Failed query: <sql>\nparams: <values>`. Those values are user data
 * (emails, names, whole webhook payloads) that the key-based masking above
 * never sees, and the actual reason sits on `.cause`. Recognised by shape,
 * not by class: this file is also bundled for the browser, where
 * drizzle-orm must not be.
 */
function isQueryError(error: Error): error is QueryError {
  const candidate = error as Partial<QueryError>;

  return typeof candidate.query === 'string' && Array.isArray(candidate.params);
}

function serializeError(error: Error, includeStack: boolean): LogContext {
  if (!isQueryError(error)) {
    return {
      name: error.name,
      message: error.message,
      // Don't log stack traces in production
      stack: includeStack ? error.stack : undefined,
    };
  }

  // The driver's `detail` stays out: for a unique violation it echoes the key's value.
  const cause = error.cause instanceof Error ? (error.cause as Error & { code?: unknown; constraint?: unknown }) : undefined;

  return {
    name: error.name,
    message: 'Failed query',
    query: error.query,
    cause: cause && {
      name: cause.name,
      message: cause.message,
      code: typeof cause.code === 'string' ? cause.code : undefined,
      constraint: typeof cause.constraint === 'string' ? cause.constraint : undefined,
    },
    // The stack opens with the message, values included (over two lines);
    // keep only the frames.
    stack: includeStack
      ? error.stack?.split('\n').filter((line) => line.trimStart().startsWith('at ')).join('\n')
      : undefined,
  };
}

/**
 * Cloud Logging's LogSeverity for each level, spelled out: upper-casing
 * would give 'WARN', which is not a severity Cloud Logging knows.
 */
const SEVERITY = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
} as const satisfies Record<LogLevel, string>;

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isTest = process.env.NODE_ENV === 'test';
  private isProduction = process.env.NODE_ENV === 'production';
  private isBrowser = typeof window !== 'undefined';

  /**
   * Sanitize context object to remove/mask sensitive data
   */
  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) {
      return undefined;
    }

    const sanitized: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();

      // Check if key is sensitive
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Special handling for email
      if (lowerKey === 'email' && typeof value === 'string') {
        sanitized[key] = this.isProduction ? maskEmail(value) : value;
        continue;
      }

      // Special handling for nested objects
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error)) {
        sanitized[key] = this.sanitizeContext(value as LogContext);
        continue;
      }

      // Special handling for error objects
      if (value instanceof Error) {
        sanitized[key] = serializeError(value, this.isDevelopment);
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }

  /**
   * Format a readable development line. The context arrives already
   * sanitized: output() sanitizes once for both branches.
   */
  private formatMessage(level: LogLevel, message: string, sanitizedContext?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = sanitizedContext ? ` ${JSON.stringify(sanitizedContext)}` : '';

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  /**
   * Output log (one JSON object per line in production, a readable line in
   * development and tests)
   */
  private output(level: LogLevel, message: string, context?: LogContext): void {
    // This file is also bundled for the browser. Its production console was
    // silent until 24 Sep 2026, because the build stripped the console.log
    // every level used. Errors and warnings now reach it on purpose; info
    // lines, which carry user and organization ids, stay quiet.
    if (this.isProduction && this.isBrowser && (level === 'info' || level === 'debug')) {
      return;
    }

    const sanitizedContext = this.sanitizeContext(context);

    if (this.isProduction) {
      // Cloud Run hands every line written to stdout or stderr to Cloud
      // Logging, which parses one JSON object per line and files it by
      // `severity` (`level` stays for anything that already reads it). The
      // fixed keys go last, so a context key cannot forge them.
      const line = JSON.stringify({
        ...sanitizedContext,
        timestamp: new Date().toISOString(),
        severity: SEVERITY[level],
        level,
        message,
      });

      // Errors and warnings go to stderr. Every level used to go through
      // console.log, which next.config's removeConsole compiled away, so
      // production wrote nothing at all.
      switch (level) {
        case 'error':
          console.error(line);
          break;
        case 'warn':
          console.warn(line);
          break;
        default:
          console.log(line);
      }
    } else {
      // Readable lines for development and tests
      const formattedMessage = this.formatMessage(level, message, sanitizedContext);

      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'debug':
          console.debug(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.output('debug', message, context);
    }
  }

  /**
   * Log info messages
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment || this.isTest || this.isProduction) {
      this.output('info', message, context);
    }
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    this.output('warn', message, context);
  }

  /**
   * Log error messages
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      error: error instanceof Error ? serializeError(error, this.isDevelopment) : error,
    };

    this.output('error', message, errorContext);
  }

  /**
   * Log authentication events
   */
  auth(message: string, context?: LogContext): void {
    this.output('info', `[AUTH] ${message}`, context);
  }
}

// Export singleton instance
export const logger = new Logger();
