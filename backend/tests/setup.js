/**
 * Vitest Setup File
 * 
 * This module runs before each test file.
 * It provides database cleanup between tests.
 * 
 * Following Yoni Goldberg's black-box testing principle:
 * We clean the database between tests but verify state through API calls.
 */

import { beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import pg from 'pg';
import { resetAllLimiters } from '../src/middleware/rateLimit.js';

const { Pool } = pg;

// Create a pool for test cleanup operations
// Note: This pool is separate from the application's pool
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5433', 10),
  user: process.env.PGUSER || 'test',
  password: process.env.PGPASSWORD || 'test',
  database: process.env.PGDATABASE || 'shelftrack_test',
  max: 5, // Small pool for cleanup only
});

/**
 * Clean up database between tests
 * TRUNCATE is faster than DELETE and resets identity columns
 */
export async function cleanupDatabase() {
  const client = await pool.connect();
  
  try {
    // Disable foreign key checks temporarily for truncate
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    
    // Truncate all tables in dependency order (child tables first)
    await client.query(`
      TRUNCATE TABLE 
        user_books,
        books,
        refresh_tokens,
        users
      RESTART IDENTITY CASCADE
    `);
    
    // Re-enable constraints
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  } catch (err) {
    console.error('[TEST CLEANUP] Error cleaning database:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check database connection
 */
export async function checkConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    console.error('[TEST SETUP] Database connection failed:', err.message);
    return false;
  }
}

// Vitest lifecycle hooks
beforeAll(async () => {
  // Verify database is accessible
  const connected = await checkConnection();
  if (!connected) {
    throw new Error('Could not connect to test database');
  }
});

beforeEach(async () => {
  // Clean database before each test for isolation
  await cleanupDatabase();
});

afterEach(() => {
  // Reset rate limiters to prevent cross-test interference
  // This clears hit counts for local IP addresses used in tests
  resetAllLimiters();
});

afterAll(async () => {
  // Final cleanup
  try {
    await cleanupDatabase();
  } finally {
    await pool.end();
  }
});

// Handle process termination
process.on('SIGTERM', async () => {
  await pool.end();
});

process.on('SIGINT', async () => {
  await pool.end();
});
