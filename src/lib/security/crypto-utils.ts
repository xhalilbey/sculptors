/**
 * Cryptographic Utilities
 * Masking helpers for values that must not reach logs in full
 */

/**
 * Mask email for logging
 * Example: john.doe@example.com -> j***e@example.com
 */
export const maskEmail = (email: string): string => {
  const [local = '', domain] = email.split('@');

  if (!domain || local.length <= 2) {
    return email.replace(/./g, '*');
  }

  const maskedLocal = `${local[0]}${'*'.repeat(Math.max(local.length - 2, 1))}${local[local.length - 1]}`;

  return `${maskedLocal}@${domain}`;
};
