/**
 * Vitest Global Setup
 * 
 * This module runs once before all test files.
 * It starts the Docker PostgreSQL container and applies migrations.
 * 
 * Research references:
 * - Docker Compose healthchecks: https://oneuptime.com/blog/post/2026-01-30-docker-compose-health-checks/view
 * - Testcontainers pattern: https://mydeveloperplanet.com/2024/09/11/unit-integration-testing-with-testcontainers-docker-compose/
 */

import { execSync, spawn } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const DOCKER_COMPOSE_FILE = join(__dirname, '../docker-compose.test.yml');
const MAX_WAIT_MS = 60000; // 60 seconds max wait
const POLL_INTERVAL_MS = 500;

/**
 * Wait for PostgreSQL to be ready
 */
async function waitForDatabase() {
  const config = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5433', 10),
    user: process.env.PGUSER || 'test',
    password: process.env.PGPASSWORD || 'test',
    database: process.env.PGDATABASE || 'shelftrack_test',
  };

  const pool = new Pool(config);
  const startTime = Date.now();

  console.log('[TEST SETUP] Waiting for database to be ready...');

  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      console.log('[TEST SETUP] Database is ready');
      return;
    } catch (err) {
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  await pool.end();
  throw new Error(`Database failed to start within ${MAX_WAIT_MS}ms`);
}

/**
 * Apply database migrations from schema.sql
 */
async function runMigrations() {
  const config = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5433', 10),
    user: process.env.PGUSER || 'test',
    password: process.env.PGPASSWORD || 'test',
    database: process.env.PGDATABASE || 'shelftrack_test',
  };

  const pool = new Pool(config);

  try {
    const schemaPath = join(__dirname, '../migrations/schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schemaSQL);
    console.log('[TEST SETUP] Migrations applied successfully');
  } catch (err) {
    console.error('[TEST SETUP] Migration failed:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

/**
 * Stop any existing test containers
 */
function cleanupExistingContainers() {
  try {
    execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} down -v 2>/dev/null`, {
      stdio: 'pipe',
    });
  } catch {
    // Ignore errors if containers don't exist
  }
}

/**
 * Start Docker Compose services
 */
function startDocker() {
  console.log('[TEST SETUP] Starting Docker containers...');
  
  try {
    // Use spawn for better output control
    const result = execSync(
      `docker-compose -f ${DOCKER_COMPOSE_FILE} up -d`,
      { 
        encoding: 'utf-8',
        stdio: 'pipe',
      }
    );
    
    console.log('[TEST SETUP] Docker containers started');
  } catch (err) {
    console.error('[TEST SETUP] Failed to start Docker:', err.message);
    throw err;
  }
}

/**
 * Main setup function
 */
export default async function setup() {
  console.log('\n[TEST SETUP] =========================================');
  console.log('[TEST SETUP] Initializing test environment...');
  console.log('[TEST SETUP] =========================================\n');

  // Clean up any existing containers first
  cleanupExistingContainers();

  // Start Docker containers
  startDocker();

  // Wait for database to be ready
  await waitForDatabase();

  // Apply migrations
  await runMigrations();

  console.log('\n[TEST SETUP] =========================================');
  console.log('[TEST SETUP] Test environment ready');
  console.log('[TEST SETUP] =========================================\n');
}

/**
 * Global teardown function
 * Note: Vitest doesn't always call this, so we also handle cleanup in setup
 */
export const teardown = async () => {
  console.log('\n[TEST TEARDOWN] Cleaning up...');
  
  try {
    execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} down -v`, {
      stdio: 'pipe',
    });
    console.log('[TEST TEARDOWN] Docker containers stopped');
  } catch (err) {
    console.error('[TEST TEARDOWN] Cleanup warning:', err.message);
  }
};
