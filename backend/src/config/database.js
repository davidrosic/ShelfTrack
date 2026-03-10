// Database Configuration Module

import pg from "pg";
import dotenv from "dotenv";

const { Pool } = pg;
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
];
const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}. ` +
      `Ensure .env file exists and is loaded.`,
  );
}

// Determine if SSL should be enabled
// SSL is required for managed database services (AWS RDS, GCP Cloud SQL, etc.)
// SSL is typically disabled for local development
const isLocalhost =
  process.env.PGHOST === "localhost" || process.env.PGHOST === "127.0.0.1";
const sslConfig = isLocalhost
  ? false
  : {
      rejectUnauthorized: false, // Allow self-signed certs from managed DB services
    };

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT, 10),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: sslConfig,
  // Pool configuration tuned for web application workloads
  max: parseInt(process.env.PGPOOL_MAX, 10) || 20, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Fail fast if connection takes >5 seconds
});

// Handle errors on idle clients
// These are typically network issues or database restarts
pool.on("error", (err) => {
  console.error("[DATABASE] Unexpected error on idle client:", err.message);
  // Do NOT call process.exit() here - let the application handle gracefully
  // The pool will automatically attempt to reconnect on next query
});

/**
 * Execute a query using the connection pool
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool for transactions
 * Caller MUST call client.release() when done
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = () => pool.connect();

/**
 * Gracefully close the connection pool
 * Use this for clean shutdown (e.g., in tests or SIGTERM handler)
 * @returns {Promise<void>}
 */
export const closePool = () => pool.end();

// Export pool for advanced use cases (e.g., transactions)
export { pool };
