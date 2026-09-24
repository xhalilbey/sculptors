/**
 * In-memory fixed-window rate limiter, one store per server instance.
 *
 * A key's window opens at its first attempt and lasts `windowMs`. Up to
 * `maxAttempts` are admitted in it; after that every attempt is refused
 * until the window ends, and the next attempt opens a new one. Each
 * instance counts only the requests it serves.
 *
 * Before 24 Sep this header said 'sliding window', and each entry kept an
 * array of attempt timestamps that every call filtered by age. But the
 * entry was also replaced once its resetTime had passed, so inside a live
 * window the filter had nothing to drop: it was already this fixed window,
 * with an array standing in for a counter.
 */

import { clientIpFrom } from './client-ip';

interface RateLimitEntry {
  resetTime: number;
  count: number;
}

/** One budget: at most `maxAttempts` per `windowMs`. */
export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

/** The answer to one attempt, with the time its window resets. */
export interface RateLimitResult {
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
  // Every credential submission from one address, across the password,
  // email-code and password-reset routes together (src/middleware.ts).
  // Before 24 Sep this was LOGIN, 5 per 15 minutes, spent on /auth/* page
  // views, where no credential is checked, while the POSTs went unthrottled.
  AUTH_SUBMIT: {
    maxAttempts: 10,
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
 * Count one attempt against the key's current window. A key with no entry,
 * or whose window has passed its resetTime, opens a new window of
 * `config.windowMs` at this attempt. Only admitted attempts are counted,
 * and a window's end never moves, so refused retries cannot extend it.
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

  let entry = store.get(key);

  // Open a new window if there is none or the last one has ended
  if (!entry || now > entry.resetTime) {
    entry = {
      resetTime: now + config.windowMs,
      count: 0,
    };
    store.set(key, entry);
  }

  const allowed = entry.count < config.maxAttempts;

  if (allowed) {
    entry.count += 1;
  }

  return {
    allowed,
    remaining: allowed ? config.maxAttempts - entry.count : 0,
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
