/**
 * Runtime guards for the application's error hierarchy.
 *
 * error-handler.ts uses them to map a thrown error to a response. The chat,
 * navigation and API-envelope guards that used to live here went with the
 * product they described (22 Sep 2026).
 */

import { AppError, ValidationError } from '@/types/errors';

/**
 * Check if error is an AppError instance
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if error is a ValidationError instance
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
