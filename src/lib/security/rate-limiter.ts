/**
 * In-Memory Rate Limiter
 * Protects against brute force and DDoS attacks
 * Uses sliding window algorithm
 */

import { clientIpFrom } from './client-ip';

interface RateLimitEntry {
  resetTime: number;
  attempts: number[];
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

// In-memory storage (consider Redis for production multi-instance)
const store = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL = 60000; // 1 minute
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Authentication endpoints
  LOGIN: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // API endpoints
  API_READ: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Start cleanup interval to remove expired entries
 */
const startCleanup = () => {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => store.delete(key));

    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL);
};

/**
 * Generate rate limit key from identifier and endpoint
 */
const generateKey = (identifier: string, endpoint: string): string => {
  return `${endpoint}:${identifier}`;
};

/**
 * Check rate limit with sliding window algorithm
 */
const checkRateLimit = (
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): RateLimitResult => {
  const key = generateKey(identifier, endpoint);
  const now = Date.now();

  // Start cleanup if not running (ensure first entry schedules cleanup)
  startCleanup();

  // Get or create entry
  let entry = store.get(key);

  // Create new entry if doesn't exist or expired
  if (!entry || now > entry.resetTime) {
    entry = {
      resetTime: now + config.windowMs,
      attempts: [],
    };
    store.set(key, entry);
  }

  // Sliding window: Remove attempts outside the window
  const windowStart = now - config.windowMs;

  entry.attempts = entry.attempts.filter(
    (timestamp) => timestamp > windowStart
  );

  // Check if limit exceeded
  const currentCount = entry.attempts.length;
  const allowed = currentCount < config.maxAttempts;

  if (allowed) {
    // Add current attempt
    entry.attempts.push(now);
  }

  return {
    allowed,
    remaining: Math.max(0, config.maxAttempts - currentCount - (allowed ? 1 : 0)),
    resetTime: entry.resetTime,
  };
};

/**
 * Rate limit middleware helper
 */
export const rateLimit = (
  identifier: string,
  endpoint: string,
  configKey: keyof typeof RATE_LIMITS = 'API_READ'
): RateLimitResult => {
  const config = RATE_LIMITS[configKey];

  return checkRateLimit(identifier, endpoint, config);
};

/**
 * The rate-limit key for a request: the caller's address as our edge saw it
 * (clientIpFrom, which trusts one hop), or one shared 'ip:unknown' bucket
 * when no proxy header names an address.
 *
 * Before 24 Sep this also preferred `request.ip`, which Next 15 removed from
 * NextRequest, so the branch never ran; and without proxy headers it keyed
 * on the `sub` of a Bearer token it decoded without verifying, a key the
 * caller chose.
 */
export const getIdentifier = (request: Request): string => {
  const ip = clientIpFrom(request.headers);

  return ip ? `ip:${ip}` : 'ip:unknown';
};
