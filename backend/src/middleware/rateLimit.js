/**
 * Rate Limiting Middleware
 *
 * Design Decisions:
 *
 * 1. TIERED LIMITING STRATEGY
 *    - Auth endpoints: Very strict (5 per 15 min) - prevents brute force
 *    - Search endpoints: Moderate (30 per min) - expensive DB operations
 *    - Write operations: Moderate (30 per min per user) - prevents spam
 *    - Read operations: Generous (100 per min) - normal usage
 *
 * 2. USER-BASED vs IP-BASED
 *    - Authenticated requests use user_id as key (fairness in shared networks)
 *    - Unauthenticated requests fall back to IP address
 *
 * 3. SKIP IN DEVELOPMENT
 *    - Rate limiting disabled in development for easier testing
 *    - Can be enabled by setting ENABLE_RATE_LIMIT in .env
 *
 * 4. STANDARDIZED RESPONSES
 *    - 429 status with clear error message
 *    - Retry-After header for client handling
 */

import rateLimit from "express-rate-limit";

// Disable IPv6 keyGenerator fallback validation - we intentionally use a custom
// keyGenerator that prioritizes user_id for authenticated users
const validateConfig = { keyGeneratorIpFallback: false };

/**
 * Determine if rate limiting should be skipped
 * Skipped in development unless explicitly enabled
 */
function shouldSkip() {
  if (process.env.ENABLE_RATE_LIMIT === "true") {
    return false;
  }
  return process.env.NODE_ENV === "development";
}

/**
 * Generate a unique key for rate limiting
 * Uses user_id for authenticated requests, IP for anonymous
 */
function generateKey(req) {
  // Use user_id if authenticated (fairness for shared networks)
  if (req.user?.user_id) {
    return `user:${req.user.user_id}`;
  }
  // Fall back to IP for unauthenticated requests
  return req.ip;
}

/**
 * Auth endpoint rate limiter
 * Strictest limits - prevents brute force attacks
 * Applies to: login, register
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  skip: shouldSkip,
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: (req, res) => {
    res.status(429).json({
      error: "RateLimitError",
      message: "Too many attempts. Please try again in 15 minutes.",
    });
  },
});

/**
 * Refresh token endpoint rate limiter
 * Detects potential token theft
 * Applies to: POST /api/auth/refresh
 */
export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts per minute (should be rare - once per 14 min normally)
  skip: shouldSkip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "RateLimitError",
      message: "Too many refresh attempts. Please try again later.",
    });
  },
});

/**
 * Search endpoint rate limiter
 * Search uses ILIKE with wildcards - expensive DB operation
 * Applies to: GET /api/books/search
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  skip: shouldSkip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "RateLimitError",
      message: "Search rate limit exceeded. Please slow down.",
    });
  },
});

/**
 * Write operation rate limiter
 * Prevents spam and abuse
 * Applies to: POST, PUT, PATCH, DELETE operations
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 write operations per minute
  skip: shouldSkip,
  keyGenerator: generateKey, // Per-user limiting
  validate: validateConfig,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "RateLimitError",
      message: "Too many write operations. Please try again in a minute.",
    });
  },
});

/**
 * General API read rate limiter
 * Generous limit for normal usage
 * Applies to: GET operations (not search)
 */
export const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 reads per minute
  skip: shouldSkip,
  keyGenerator: generateKey, // Per-user limiting for authenticated requests
  validate: validateConfig,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "RateLimitError",
      message: "Too many requests. Please slow down.",
    });
  },
});

/**
 * External search rate limiter
 * Stricter limits since it hits external API (Open Library)
 * Applies to: GET /api/books/search-universal with source=external
 */
export const externalSearchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 external searches per minute (OL API is rate limited)
  skip: shouldSkip,
  keyGenerator: generateKey, // Per-user limiting
  validate: validateConfig,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "RateLimitError",
      message: "External search rate limit exceeded. Please slow down.",
    });
  },
});

/**
 * Health check should NOT have rate limiting
 * Monitoring systems need consistent access
 */
export const skipHealthCheck = (req) => req.path === "/health";
