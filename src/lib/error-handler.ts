import { isAppError, isValidationError } from '@/lib/type-guards';
import type { ValidationError } from '@/types/errors';

/**
 * Error handling utilities
 * Converts technical errors to user-friendly messages for API responses
 */

/**
 * Convert error to user-friendly message for display in UI
 * Maps technical errors to localized, non-technical messages
 *
 * @param error - Error object to convert
 * @returns User-friendly error message
 */
function getUserFriendlyMessage(error: Error): string {
  if (isValidationError(error)) {
    const validationError = error as ValidationError;

    // If validation error has field-specific errors, show the first one
    const firstError = Object.values(validationError.fields ?? {})[0]?.[0];

    if (firstError) {
      return firstError;
    }

    return 'Please check your input and try again.';
  }

  // Handle network errors
  if (error.message?.toLowerCase().includes('network') ||
      error.message?.toLowerCase().includes('fetch') ||
      error.message?.toLowerCase().includes('connection')) {
    return 'Network connection failed. Please check your internet connection.';
  }

  // Handle timeout errors
  if (error.message?.toLowerCase().includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Handle generic AppError with custom message
  if (isAppError(error) && error.message) {
    return error.message;
  }

  // Fallback to generic message
  return 'Something went wrong. Please try again.';
}

/**
 * Format error for API responses
 * Returns a sanitized error object safe to send to clients
 *
 * @param error - Error object to format
 * @returns Sanitized error response object
 */
export function formatErrorResponse(error: Error): {
  error: string;
  code?: string;
  statusCode?: number;
} {
  const userMessage = getUserFriendlyMessage(error);

  const response: {
    error: string;
    code?: string;
    statusCode?: number;
  } = {
    error: userMessage,
  };

  if (isAppError(error)) {
    response.code = error.code;
    response.statusCode = error.statusCode;
  }

  return response;
}
