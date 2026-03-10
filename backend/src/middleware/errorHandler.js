/**
 * Global Error Handler Middleware
 *
 * Design Decisions:
 *
 * 1. ERROR CLASSIFICATION
 *    - ValidationError (400): Bad user input
 *    - NotFoundError (404): Resource doesn't exist
 *    - ForbiddenError (403): Valid auth, but no permission
 *    - Default (500): Server errors
 *
 * 2. ERROR RESPONSE SHAPE
 *    - Consistent JSON structure across all errors
 *    - error: Machine-readable error code
 *    - message: Human-readable description
 *    - details: Additional context (validation errors, etc.)
 *
 * 3. SECURITY
 *    - Stack traces only in development
 *    - Generic 500 messages in production
 *    - SQL errors sanitized (no leaking table names, etc.)
 *
 * 4. LOGGING
 *    - Structured logging to stderr
 *    - Error stack for debugging
 *    - Request context (method, URL)
 */

import { ValidationError, NotFoundError } from "../models/User.js";

/**
 * Global error handling middleware
 * Must have 4 parameters to be recognized as error handler
 */
export function errorHandler(err, req, res, _next) {
  const timestamp = new Date().toISOString();

  // Log error details
  console.error(`[${timestamp}] [ERROR] ${req.method} ${req.url}`);
  console.error(`[${timestamp}] [ERROR] ${err.name}: ${err.message}`);

  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  // Handle specific error types
  if (err instanceof ValidationError) {
    return res.status(err.statusCode || 400).json({
      error: "ValidationError",
      message: err.message,
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(err.statusCode || 404).json({
      error: "NotFoundError",
      message: err.message,
    });
  }

  if (err.name === "ForbiddenError" || err.statusCode === 403) {
    return res.status(403).json({
      error: "ForbiddenError",
      message: err.message || "Access denied",
    });
  }

  // Handle PostgreSQL errors
  if (err.code) {
    // Unique constraint violation
    if (err.code === "23505") {
      return res.status(409).json({
        error: "ConflictError",
        message: "Resource already exists",
      });
    }

    // Foreign key violation
    if (err.code === "23503") {
      return res.status(400).json({
        error: "ReferenceError",
        message: "Referenced resource does not exist",
      });
    }

    // Check constraint violation
    if (err.code === "23514") {
      return res.status(400).json({
        error: "ConstraintError",
        message: "Invalid data violates database constraints",
      });
    }
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "AuthenticationError",
      message: "Invalid token",
    });
  }

  // Default: Internal Server Error
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message;

  res.status(500).json({
    error: "InternalServerError",
    message,
  });
}

/**
 * 404 Not Found handler
 * Catches requests to undefined routes
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "NotFoundError",
    message: `Route ${req.method} ${req.path} not found`,
  });
}
