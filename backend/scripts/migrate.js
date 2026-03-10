#!/usr/bin/env node
/**
 * Database Migration Script
 *
 * PURPOSE:
 *   Runs schema migrations on an existing database.
 *   Safe for ALL environments: development, staging, production.
 *
 * USAGE:
 *   node scripts/migrate.js          # Run pending migrations
 *   node scripts/migrate.js --dry-run # Preview without applying
 *
 * EXIT CODES:
 *   0 - Success (no migrations or all applied successfully)
 *   1 - Error (database connection failed, migration failed, etc.)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const { Pool } = pg;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, "../migrations");
const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Structured logging helper
 * Uses stderr for logs so stdout can be used for machine-readable output
 */
function log(level, message) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [MIGRATE] [${level}] ${message}`);
}

/**
 * Validate environment configuration
 */
function validateEnvironment() {
  const required = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

/**
 * Determine SSL configuration based on host
 */
function getSslConfig() {
  const host = process.env.PGHOST;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  return isLocalhost ? false : { rejectUnauthorized: false };
}

/**
 * Create a database connection pool
 */
function createPool() {
  return new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT, 10),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: getSslConfig(),
    connectionTimeoutMillis: 10000, // 10 seconds for migrations
  });
}

/**
 * Ensure the migrations tracking table exists
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Get list of already-applied migrations
 */
async function getAppliedMigrations(client) {
  const { rows } = await client.query(
    "SELECT filename FROM _migrations ORDER BY applied_at",
  );
  return new Set(rows.map((r) => r.filename));
}

/**
 * Read and validate migration files from disk
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Execute a single migration within a transaction
 */
async function runMigration(client, filename, sql) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [
      filename,
    ]);
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

/**
 * Main migration runner
 */
async function runMigrations() {
  log("INFO", `Starting migrations (dry-run: ${DRY_RUN})`);

  validateEnvironment();

  const pool = createPool();
  let appliedCount = 0;
  let skippedCount = 0;

  try {
    // Test connection first
    await pool.query("SELECT 1");
    log(
      "INFO",
      `Connected to database: ${process.env.PGDATABASE}@${process.env.PGHOST}`,
    );

    const client = await pool.connect();
    try {
      await ensureMigrationsTable(client);
      const appliedSet = await getAppliedMigrations(client);
      const files = getMigrationFiles();

      if (files.length === 0) {
        log("INFO", "No migration files found");
        return { applied: 0, skipped: 0 };
      }

      log("INFO", `Found ${files.length} migration file(s)`);

      for (const filename of files) {
        if (appliedSet.has(filename)) {
          log("INFO", `Skipping ${filename} (already applied)`);
          skippedCount++;
          continue;
        }

        const filepath = path.join(MIGRATIONS_DIR, filename);
        const sql = fs.readFileSync(filepath, "utf8");

        if (DRY_RUN) {
          log("INFO", `[DRY-RUN] Would apply ${filename}`);
          continue;
        }

        log("INFO", `Applying ${filename}...`);
        await runMigration(client, filename, sql);
        log("SUCCESS", `Applied ${filename}`);
        appliedCount++;
      }

      return { applied: appliedCount, skipped: skippedCount };
    } finally {
      client.release();
    }
  } catch (err) {
    log("ERROR", err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

// Execute if called directly
if (import.meta.url === fileURLToPath(import.meta.resolve("./migrate.js"))) {
  runMigrations()
    .then(({ applied, skipped }) => {
      if (DRY_RUN) {
        log("INFO", "Dry run complete - no changes made");
      } else {
        log(
          "SUCCESS",
          `Migrations complete. Applied: ${applied}, Skipped: ${skipped}`,
        );
      }
      process.exit(0);
    })
    .catch((err) => {
      log("ERROR", `Migration failed: ${err.message}`);
      process.exit(1);
    });
}

export { runMigrations };
