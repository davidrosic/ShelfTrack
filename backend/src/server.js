/**
 * ShelfTrack API Server
 *
 * Architecture Overview:
 *
 * 1. LAYERED ARCHITECTURE
 *    - Routes: HTTP handling, input validation, response formatting
 *    - Middleware: Cross-cutting concerns (auth, error handling, logging)
 *    - Models: Data access layer (SQL queries)
 *    - Config: External service configuration (database, etc.)
 *
 * 2. SECURITY MEASURES
 *    - Helmet: Security headers (XSS, CSP, etc.)
 *    - CORS: Controlled cross-origin access
 *    - JWT: Stateless authentication
 *    - Input validation: Schema-based request validation
 *    - Parameterized queries: SQL injection prevention
 *
 * 3. ERROR HANDLING
 *    - Async route wrapper catches all errors
 *    - Centralized error handler formats responses
 *    - No stack traces in production
 *
 * 4. ENVIRONMENT CONFIGURATION
 *    - All config via environment variables
 *    - Sensible defaults for development
 *    - Strict validation in production
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// Import routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import bookRoutes from "./routes/books.js";
import userBookRoutes from "./routes/userBooks.js";

// Import middleware
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Load environment variables
dotenv.config();

// Validate required environment variables in production
if (process.env.NODE_ENV === "production") {
  const required = ["JWT_SECRET", "PGHOST", "PGUSER", "PGPASSWORD", "PGDATABASE"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

/**
 * Helmet: Sets security headers
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Content-Security-Policy: restrict resource loading
 */
app.use(helmet());

/**
 * CORS: Cross-Origin Resource Sharing
 * Allow frontend to communicate with API
 */
const corsOrigin = process.env.NODE_ENV === 'production'
  ? process.env.FRONTEND_URL 
  : (process.env.FRONTEND_URL || "http://localhost:5173");

if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.error('[FATAL] FRONTEND_URL required in production');
  process.exit(1);
}

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// ============================================
// REQUEST PARSING
// ============================================

// Cookie parser - needed for refresh token handling
app.use(cookieParser());

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================
// REQUEST LOGGING (development only)
// ============================================

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// HEALTH CHECK
// ============================================

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

// ============================================
// API ROUTES
// ============================================

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/user-books", userBookRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const server = app.listen(PORT, () => {
  console.log(`[SERVER] ShelfTrack API running on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

function gracefulShutdown(signal) {
  console.log(`[SERVER] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log("[SERVER] HTTP server closed");

    try {
      // Close database pool
      const { closePool } = await import("./config/database.js");
      await closePool();
      console.log("[SERVER] Database connections closed");
    } catch (err) {
      console.error("[SERVER] Error during shutdown:", err.message);
    }

    console.log("[SERVER] Shutdown complete");
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error("[SERVER] Forced shutdown due to timeout");
    process.exit(1);
  }, 30000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
