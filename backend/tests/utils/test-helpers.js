/**
 * Test Helpers
 * 
 * Utility functions for creating test data and authentication tokens.
 * Following the pattern of using unique identifiers to prevent test collisions.
 * 
 * Research: https://github.com/goldbergyoni/javascript-testing-best-practices
 * - Use unique identifiers for test data
 * - Sign real JWTs with app secret (don't mock auth)
 */

import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';

/**
 * Generate a unique identifier for test data
 * Combines timestamp with random number to prevent collisions
 */
export function generateUniqueId() {
  return `${Date.now()}-${randomInt(1000, 9999)}`;
}

/**
 * Generate a unique test email address
 */
export function generateTestEmail() {
  return `test-${generateUniqueId()}@example.com`;
}

/**
 * Generate a unique test username
 */
export function generateTestUsername() {
  return `user${generateUniqueId()}`;
}

/**
 * Generate a valid password that passes the app's validation rules
 * Must contain: uppercase, lowercase, number, special char
 */
export function generateValidPassword() {
  return 'SecurePass123!';
}

/**
 * Generate an invalid password (for negative testing)
 */
export function generateInvalidPassword() {
  return '123'; // Too short, no uppercase, no special char
}

/**
 * Get JWT secret from environment or use test default
 */
function getJWTSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fallback for tests - matches the test environment
    return 'test-secret-minimum-32-characters-long-2025';
  }
  return secret;
}

/**
 * Create a valid JWT token for testing
 * Uses the same secret as the application
 * 
 * @param {Object} payload - Token payload (typically { user_id })
 * @param {Object} options - Additional jwt.sign options
 * @returns {string} JWT token
 */
export function createTestJWT(payload, options = {}) {
  const secret = getJWTSecret();
  return jwt.sign(payload, secret, {
    expiresIn: '15m',
    ...options,
  });
}

/**
 * Create an expired JWT token for testing token expiry
 * 
 * @param {Object} payload - Token payload
 * @returns {string} Expired JWT token
 */
export function createExpiredJWT(payload) {
  const secret = getJWTSecret();
  // Set issued at time to 2 hours ago
  const pastTimestamp = Math.floor(Date.now() / 1000) - 7200;
  
  return jwt.sign(
    { ...payload, iat: pastTimestamp },
    secret,
    { expiresIn: '1h' } // Expired 1 hour ago relative to iat
  );
}

/**
 * Create a JWT signed with wrong secret
 * Used to test signature verification failures
 * 
 * @param {Object} payload - Token payload
 * @returns {string} JWT with invalid signature
 */
export function createWrongSecretJWT(payload) {
  return jwt.sign(payload, 'wrong-secret-that-is-also-32-characters-long', {
    expiresIn: '15m',
  });
}

/**
 * Create a JWT with algorithm 'none'
 * Used to test algorithm confusion attacks
 * Manually constructed because jsonwebtoken rejects 'none' algorithm with a secret
 *
 * @param {Object} payload - Token payload
 * @returns {string} JWT with alg: none (no signature)
 */
export function createNoneAlgorithmJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payloadData = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  };
  const body = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
  // 'none' algorithm has no signature - just header.payload.
  return `${header}.${body}.`;
}

/**
 * Create a tampered JWT payload
 * The signature will be invalid because payload was modified
 * 
 * @param {Object} originalPayload - Original payload
 * @returns {string} Tampered JWT
 */
export function createTamperedJWT(originalPayload) {
  const secret = getJWTSecret();
  const token = jwt.sign(originalPayload, secret, { expiresIn: '15m' });
  
  // Decode and modify payload
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  
  // Tamper with the payload
  payload.user_id = 99999;
  
  // Re-encode payload (signature is now invalid)
  const modifiedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${parts[0]}.${modifiedPayload}.${parts[2]}`;
}

/**
 * Create malformed JWT strings for testing
 */
export const malformedJWTs = {
  // No Bearer prefix format
  noPrefix: 'invalid.token.here',
  
  // Only two parts
  twoParts: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxfQ',
  
  // Invalid base64
  invalidBase64: 'Bearer not.valid.base64',
  
  // Empty token
  empty: 'Bearer ',
  
  // Wrong number of segments
  wrongSegments: 'Bearer too.many.segments.here.extra',
};

/**
 * Factory for creating test user data
 * 
 * @param {Object} overrides - Fields to override
 * @returns {Object} Valid user registration data
 */
export function createTestUserData(overrides = {}) {
  return {
    email: generateTestEmail(),
    username: generateTestUsername(),
    password: generateValidPassword(),
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };
}

/**
 * Factory for creating test book data
 * 
 * @param {Object} overrides - Fields to override
 * @returns {Object} Valid book creation data
 */
export function createTestBookData(overrides = {}) {
  const uniqueId = generateUniqueId();
  return {
    title: `Test Book ${uniqueId}`,
    author: `Test Author ${uniqueId}`,
    ...overrides,
  };
}

/**
 * Factory for creating Open Library style book data
 * 
 * @param {Object} overrides - Fields to override
 * @returns {Object} Book data with Open Library ID
 */
export function createTestOpenLibraryBookData(overrides = {}) {
  const uniqueId = generateUniqueId();
  return {
    openLibraryId: `OL${randomInt(100000, 999999)}W`,
    title: `Test Book ${uniqueId}`,
    author: `Test Author ${uniqueId}`,
    coverUrl: null,
    firstPublishYear: 2020,
    isCustom: false,
    ...overrides,
  };
}

/**
 * Factory for creating user book shelf entry data
 * 
 * @param {number} bookId - Book ID to add
 * @param {Object} overrides - Fields to override
 * @returns {Object} Valid shelf entry data
 */
export function createShelfEntryData(bookId, overrides = {}) {
  return {
    bookId,
    status: 'want_to_read',
    ...overrides,
  };
}

/**
 * Parse a Set-Cookie header and return cookie value
 * 
 * @param {string} setCookieHeader - The Set-Cookie header value
 * @param {string} cookieName - Name of cookie to extract
 * @returns {string|null} Cookie value or null
 */
export function extractCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) return null;
  
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  
  for (const cookie of cookies) {
    const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Extract refresh token from response cookies
 * 
 * @param {Object} response - Supertest response
 * @returns {string|null} Refresh token or null
 */
export function extractRefreshToken(response) {
  const setCookie = response.headers['set-cookie'];
  return extractCookie(setCookie, 'refresh_token');
}

/**
 * Standard request headers for authenticated requests
 * Includes CSRF protection header
 */
export function getAuthHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'X-Requested-With': 'XMLHttpRequest',
  };
}

/**
 * Standard CSRF header for state-changing operations
 */
export const csrfHeader = {
  'X-Requested-With': 'XMLHttpRequest',
};

/**
 * SQL Injection test payloads for security testing
 */
export const sqlInjectionPayloads = [
  "' OR '1'='1",
  "' OR 1=1 --",
  "'; DROP TABLE users; --",
  "1'; DELETE FROM users WHERE '1'='1",
  "' UNION SELECT * FROM users --",
  "' OR 1=1#",
  "' OR 1=1/*",
];

/**
 * XSS test payloads for security testing
 */
export const xssPayloads = [
  "<script>alert('xss')</script>",
  "<img src=x onerror=alert('xss')>",
  "<svg onload=alert('xss')>",
  "javascript:alert('xss')",
  "<body onload=alert('xss')>",
];

/**
 * Mass assignment test payloads
 */
export const massAssignmentPayloads = {
  user: {
    role: 'admin',
    isAdmin: true,
    user_id: 1,
    password_hash: 'hacked',
    created_at: '2020-01-01',
  },
  book: {
    book_id: 1,
    created_at: '2020-01-01',
  },
};
