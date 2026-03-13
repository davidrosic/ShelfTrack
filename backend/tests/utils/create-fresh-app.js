/**
 * Fresh App Creator for Rate Limit Tests
 * 
 * This module creates a completely fresh Express app instance with
 * fresh rate limiters. This is necessary because express-rate-limit
 * stores are created when the module is loaded and cannot be reset.
 * 
 * Usage in tests:
 *   const { createFreshApp, closeFreshApp } = await import('./create-fresh-app.js');
 *   const { app, server } = await createFreshApp();
 *   // ... run tests ...
 *   await closeFreshApp(server);
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// Import routes
import authRoutes from "../../src/routes/auth.js";
import userRoutes from "../../src/routes/users.js";
import bookRoutes from "../../src/routes/books.js";
import userBookRoutes from "../../src/routes/userBooks.js";

// Import middleware
import { errorHandler, notFoundHandler } from "../../src/middleware/errorHandler.js";

// Import rate limiting (fresh instances each time this module is imported)
import rateLimit from "express-rate-limit";

// Validate config for rate limiters
const validateConfig = { keyGeneratorIpFallback: false };

/**
 * Determine if rate limiting should be skipped
 */
function shouldSkip() {
  if (process.env.ENABLE_RATE_LIMIT === "true") {
    return false;
  }
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

/**
 * Generate a unique key for rate limiting
 */
function generateKey(req) {
  if (req.user?.user_id) {
    return `user:${req.user.user_id}`;
  }
  return req.ip;
}

/**
 * Create fresh rate limiters
 * This function creates new rate limiter instances with clean stores
 */
function createFreshRateLimiters() {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skip: shouldSkip,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: "RateLimitError",
        message: "Too many attempts. Please try again in 15 minutes.",
      });
    },
  });

  const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
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

  const externalSearchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    skip: shouldSkip,
    keyGenerator: generateKey,
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

  const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    skip: shouldSkip,
    keyGenerator: generateKey,
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

  const readLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    skip: shouldSkip,
    keyGenerator: generateKey,
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

  const refreshLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
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

  return {
    authLimiter,
    searchLimiter,
    externalSearchLimiter,
    writeLimiter,
    readLimiter,
    refreshLimiter,
  };
}

/**
 * Create a fresh Express app with fresh rate limiters
 * @returns {Object} { app, server }
 */
export async function createFreshApp() {
  // Load environment variables
  dotenv.config();

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Create fresh rate limiters
  const {
    authLimiter,
    searchLimiter,
    externalSearchLimiter,
    writeLimiter,
    readLimiter,
    refreshLimiter,
  } = createFreshRateLimiters();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "https://covers.openlibrary.org", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
  }));

  app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }));

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Health check (no rate limiting)
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Apply rate limiters
  app.use("/api/auth/refresh", refreshLimiter);
  app.use("/api/users/login", authLimiter);
  app.use("/api/users/register", authLimiter);
  app.use("/api/books/search", searchLimiter);
  app.use("/api/books/search-universal", externalSearchLimiter);

  // Dynamic rate limiting based on method
  app.use((req, res, next) => {
    if (req.path === "/health") {
      return next();
    }

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return writeLimiter(req, res, next);
    }
    return readLimiter(req, res, next);
  });

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/books", bookRoutes);
  app.use("/api/user-books", userBookRoutes);

  // Error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Start server
  const server = await new Promise((resolve) => {
    const srv = app.listen(PORT, () => {
      console.log(`[FRESH SERVER] Started on port ${PORT}`);
      resolve(srv);
    });
  });

  return { app, server };
}

/**
 * Close the fresh app server
 * @param {http.Server} server 
 */
export async function closeFreshApp(server) {
  return new Promise((resolve) => {
    // Remove the closePool callback to prevent interfering with test setup
    server.close(() => {
      console.log("[FRESH SERVER] Closed");
      resolve();
    });
  });
}

// Override graceful shutdown to not close the database pool
// The test setup manages the pool lifecycle
process.removeAllListeners('SIGTERM');
process.removeAllListeners('SIGINT');
