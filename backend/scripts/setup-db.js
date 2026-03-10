#!/usr/bin/env node
/**
 * Database Setup Script - DEVELOPMENT ONLY
 *
 * PURPOSE:
 *   Creates the database if it doesn't exist, then runs migrations.
 *   This is a convenience script for local development ONLY.
 *
 * IN PRODUCTION:
 *   - Run: node scripts/migrate.js
 *
 * USAGE:
 *   node scripts/setup-db.js
 *
 * EXIT CODES:
 *   0 - Database ready and migrations applied
 *   1 - Error (wrong environment, connection failed, migration failed)
 */

import pg from "pg";
import dotenv from "dotenv";
import { runMigrations } from "./migrate.js";

const { Pool } = pg;
dotenv.config();

/**
 * Structured logging helper
 */
function log(level, message) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [SETUP] [${level}] ${message}`);
}

/**
 * Validate that we're not running in production
 */
function validateEnvironment() {
  const env = process.env.NODE_ENV;

  if (env === "production") {
    log(
      "ERROR",
      "This script is for development only. Database creation in production violates infrastructure-as-code principles.",
    );
    log(
      "INFO",
      "To run migrations in production, use: node scripts/migrate.js",
    );
    process.exit(1);
  }

  const required = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

/**
 * Determine SSL configuration
 */
function getSslConfig() {
  const host = process.env.PGHOST;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  return isLocalhost ? false : { rejectUnauthorized: false };
}

/**
 * Create the target database if it doesn't exist
 * Connects to 'postgres' system database to execute CREATE DATABASE
 */
async function createDatabaseIfNotExists() {
  const targetDb = process.env.PGDATABASE;

  // Connect to default 'postgres' database to create our target DB
  const pool = new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT, 10),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: "postgres", // System database for administrative commands
    ssl: getSslConfig(),
  });

  try {
    // Check if database already exists
    const result = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetDb],
    );

    if (result.rowCount === 0) {
      log("INFO", `Creating database "${targetDb}"...`);
      // PostgreSQL doesn't support parameterized queries for CREATE DATABASE
      // We validate the database name to prevent SQL injection
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetDb)) {
        throw new Error(`Invalid database name: ${targetDb}`);
      }
      await pool.query(`CREATE DATABASE "${targetDb}"`);
      log("SUCCESS", `Database "${targetDb}" created`);
    } else {
      log("INFO", `Database "${targetDb}" already exists`);
    }
  } finally {
    await pool.end();
  }
}

/**
 * Main setup orchestrator
 */
async function main() {
  log("INFO", "Starting database setup (development mode)");

  try {
    validateEnvironment();
    await createDatabaseIfNotExists();

    log("INFO", "Running migrations...");
    const { applied, skipped } = await runMigrations();

    log("SUCCESS", "Setup complete");
    log("INFO", `Migrations: ${applied} applied, ${skipped} skipped`);
  } catch (err) {
    log("ERROR", err.message);
    process.exit(1);
  }
}

main();
