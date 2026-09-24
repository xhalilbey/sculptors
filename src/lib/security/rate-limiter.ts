/**
 * In-Memory Rate Limiter
 * Protects against brute force and DDoS attacks
 * Uses sliding window algorithm
 */

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
 * Extract identifier from request (IP or user ID)
 */
export const getIdentifier = (request: Request & { ip?: string | null }): string => {
  // Prefer platform-provided IP (Next.js sets request.ip when behind trusted proxy)
  if (request.ip) {
    return `ip:${request.ip}`;
  }

  // Fall back to standard reverse proxy headers.
  //
  // Take the LAST entry, not the first. X-Forwarded-For is append-only: each
  // proxy adds the address it received the request from, so the rightmost
  // entry is the one written by our own edge and the leftmost is whatever the
  // client claimed. Reading the first entry let a caller pick its own
  // rate-limit key by sending its own X-Forwarded-For, which made the login
  // limiter bypassable by rotating one header.
  //
  // This trusts exactly one hop. If the deployment ever sits behind an
  // additional proxy, this needs to skip that many entries from the right.
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    const hops = forwardedFor
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const clientIp = hops.at(-1);

    if (clientIp) {
      return `ip:${clientIp}`;
    }
  }

  const realIp = request.headers.get('x-real-ip');

  if (realIp) {
    return `ip:${realIp}`;
  }

  // As a last resort, fall back to auth subject if present
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1] ?? '', 'base64').toString()
      );

      if (payload.sub) {
        return `user:${payload.sub}`;
      }
    } catch {
      // Ignore malformed tokens for rate limiting purposes
    }
  }

  // Final fallback
  return 'ip:unknown';
};
