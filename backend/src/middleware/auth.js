/**
 * Authentication Middleware
 *
 * Design Decisions:
 *
 * 1. JWT TOKEN STRATEGY
 *    - Stateless authentication (no server-side sessions)
 *    - Token contains user_id only (minimal payload)
 *    - 24 hour expiration for security
 *
 * 2. AUTHORIZATION PATTERN
 *    - Middleware verifies token and attaches user to req
 *    - Routes check req.user.user_id against resource ownership
 *    - Separation of authentication (who) from authorization (permissions)
 *
 * 3. ERROR HANDLING
 *    - 401 for missing/invalid tokens (authentication required)
 *    - 403 for valid token but insufficient permissions
 *    - Clear error messages for debugging
 *
 * 4. TOKEN EXTRACTION
 *    - Supports Authorization: Bearer <token> header
 *    - No cookie support (SPA/mobile friendly)
 *    - Simple to test with curl/Postman
 */

import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

/**
 * JWT secret from environment
 * SECURITY: Must be at least 32 characters, use strong random value in production
 * Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
 */
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("[FATAL] JWT_SECRET environment variable is required");
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.error("[FATAL] JWT_SECRET must be at least 32 characters long");
  process.exit(1);
}

/**
 * Token expiration time
 * @type {string}
 */
const TOKEN_EXPIRES_IN = "15m";

/**
 * Generate JWT token for user
 * @param {Object} user - User object (must have user_id)
 * @returns {string} JWT token
 */
export function generateToken(user) {
  return jwt.sign({ user_id: user.user_id }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN,
  });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Authentication middleware
 * Verifies JWT and attaches user to req.user
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Missing or invalid Authorization header. Use: Bearer <token>",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Token expired",
          message: "Please log in again",
        });
      }
      return res.status(401).json({
        error: "Invalid token",
        message: "Token verification failed",
      });
    }

    // Verify user still exists (prevents using tokens for deleted users)
    const user = await User.findById(decoded.user_id);
    if (!user) {
      return res.status(401).json({
        error: "User not found",
        message: "The user associated with this token no longer exists",
      });
    }

    // Attach user to request for route handlers
    req.user = user;
    next();
  } catch (err) {
    console.error("[AUTH] Authentication error:", err.message);
    res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token valid, continues regardless
 * Useful for routes that work for both logged-in and anonymous users
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.user_id);

    if (user) {
      req.user = user;
    }

    next();
  } catch {
    // Invalid token, but that's okay for optional auth
    next();
  }
}

/**
 * Authorization middleware factory
 * Creates middleware that checks if authenticated user matches resource owner
 *
 * @param {string} paramName - URL parameter containing the user ID to check
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.get('/:userId/books', authenticate, authorizeOwnResource('userId'), handler)
 */
export function authorizeOwnResource(paramName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const resourceUserId = parseInt(req.params[paramName], 10);
    const authenticatedUserId = req.user.user_id;

    if (resourceUserId !== authenticatedUserId) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own resources",
      });
    }

    next();
  };
}
