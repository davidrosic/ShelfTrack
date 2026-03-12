/**
 * Database Schema Verification Tests
 * 
 * Tests that the database schema matches expectations:
 * - Required tables exist
 * - Columns match schema.sql
 * - Indexes exist for performance
 * - Constraints are properly defined
 * 
 * This is the ONLY test file that directly queries the database,
 * following Yoni Goldberg's exception for schema verification.
 * 
 * Research: https://github.com/goldbergyoni/javascript-testing-best-practices
 */

import { describe, it, expect, afterAll } from 'vitest';
import pg from 'pg';

const { Pool } = pg;

// Create a dedicated pool for schema tests
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5433', 10),
  user: process.env.PGUSER || 'test',
  password: process.env.PGPASSWORD || 'test',
  database: process.env.PGDATABASE || 'shelftrack_test',
});

describe('Database Schema', () => {
  afterAll(async () => {
    await pool.end();
  });
  
  describe('Required Tables', () => {
    it('has all expected tables', async () => {
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);
      
      const tables = result.rows.map(r => r.table_name);
      
      expect(tables).toContain('users');
      expect(tables).toContain('books');
      expect(tables).toContain('user_books');
      expect(tables).toContain('refresh_tokens');
    });
    
    it('users table has correct columns', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(r => r.column_name);
      
      expect(columns).toContain('user_id');
      expect(columns).toContain('email');
      expect(columns).toContain('username');
      expect(columns).toContain('password_hash');
      expect(columns).toContain('first_name');
      expect(columns).toContain('last_name');
      expect(columns).toContain('date_of_birth');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });
    
    it('books table has correct columns', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'books'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(r => r.column_name);
      
      expect(columns).toContain('book_id');
      expect(columns).toContain('open_library_id');
      expect(columns).toContain('title');
      expect(columns).toContain('author');
      expect(columns).toContain('cover_url');
      expect(columns).toContain('first_publish_year');
      expect(columns).toContain('is_custom');
      expect(columns).toContain('created_at');
    });
    
    it('user_books table has correct columns', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'user_books'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(r => r.column_name);
      
      expect(columns).toContain('user_book_id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('book_id');
      expect(columns).toContain('status');
      expect(columns).toContain('rating');
      expect(columns).toContain('review');
      expect(columns).toContain('notes');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });
    
    it('refresh_tokens table has correct columns', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map(r => r.column_name);
      
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('token_hash');
      expect(columns).toContain('expires_at');
      expect(columns).toContain('created_at');
    });
  });
  
  describe('Indexes', () => {
    it('has expected indexes on users table', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'users'
      `);
      
      const indexes = result.rows.map(r => r.indexname);
      
      // Primary key index
      expect(indexes.some(i => i.includes('users_pkey'))).toBe(true);
      
      // Unique indexes for email and username
      expect(indexes.some(i => i.includes('email'))).toBe(true);
      expect(indexes.some(i => i.includes('username'))).toBe(true);
    });
    
    it('has expected indexes on books table', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'books'
      `);
      
      const indexes = result.rows.map(r => r.indexname);
      
      // Primary key
      expect(indexes.some(i => i.includes('books_pkey'))).toBe(true);
      
      // Open Library ID index
      expect(indexes.some(i => i.includes('open_library_id'))).toBe(true);
    });
    
    it('has expected indexes on user_books table', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'user_books'
      `);
      
      const indexes = result.rows.map(r => r.indexname);
      
      // Primary key
      expect(indexes.some(i => i.includes('user_books_pkey'))).toBe(true);
      
      // Foreign key indexes
      expect(indexes.some(i => i.includes('user_id'))).toBe(true);
      expect(indexes.some(i => i.includes('book_id'))).toBe(true);
      expect(indexes.some(i => i.includes('status'))).toBe(true);
    });
    
    it('has expected indexes on refresh_tokens table', async () => {
      const result = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'refresh_tokens'
      `);
      
      const indexes = result.rows.map(r => r.indexname);
      
      // Primary key
      expect(indexes.some(i => i.includes('refresh_tokens_pkey'))).toBe(true);
      
      // Token lookup indexes
      expect(indexes.some(i => i.includes('token_hash'))).toBe(true);
      expect(indexes.some(i => i.includes('user_id'))).toBe(true);
      expect(indexes.some(i => i.includes('expires_at'))).toBe(true);
    });
  });
  
  describe('Constraints', () => {
    it('users table has unique constraints on email and username', async () => {
      const result = await pool.query(`
        SELECT conname, contype
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass
        AND contype = 'u'
      `);
      
      const constraints = result.rows.map(r => r.conname);
      
      expect(constraints.some(c => c.includes('email'))).toBe(true);
      expect(constraints.some(c => c.includes('username'))).toBe(true);
    });
    
    it('books table has unique constraint on open_library_id', async () => {
      const result = await pool.query(`
        SELECT conname, contype
        FROM pg_constraint
        WHERE conrelid = 'books'::regclass
        AND contype = 'u'
      `);
      
      const constraints = result.rows.map(r => r.conname);
      
      expect(constraints.some(c => c.includes('open_library_id'))).toBe(true);
    });
    
    it('user_books table has unique constraint on user_id + book_id', async () => {
      const result = await pool.query(`
        SELECT conname, contype
        FROM pg_constraint
        WHERE conrelid = 'user_books'::regclass
        AND contype = 'u'
      `);
      
      const constraints = result.rows.map(r => r.conname);
      
      expect(constraints.some(c => c.includes('unique_user_book'))).toBe(true);
    });
    
    it('user_books table has check constraint on status', async () => {
      const result = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = 'user_books'::regclass
        AND contype = 'c'
      `);
      
      const checkConstraints = result.rows.filter(r => 
        r.def.includes('status')
      );
      
      expect(checkConstraints.length).toBeGreaterThan(0);
      
      const statusConstraint = checkConstraints.find(c => 
        c.def.includes('want_to_read') ||
        c.def.includes('reading') ||
        c.def.includes('read')
      );
      
      expect(statusConstraint).toBeDefined();
    });
    
    it('user_books table has check constraint on rating range', async () => {
      const result = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = 'user_books'::regclass
        AND contype = 'c'
      `);
      
      const ratingConstraint = result.rows.find(r => 
        r.def.includes('rating') && r.def.includes('1') && r.def.includes('5')
      );
      
      expect(ratingConstraint).toBeDefined();
    });
    
    it('refresh_tokens table has unique constraint on token_hash', async () => {
      const result = await pool.query(`
        SELECT conname, contype
        FROM pg_constraint
        WHERE conrelid = 'refresh_tokens'::regclass
        AND contype = 'u'
      `);
      
      const constraints = result.rows.map(r => r.conname);
      
      expect(constraints.some(c => c.includes('token_hash'))).toBe(true);
    });
  });
  
  describe('Foreign Keys', () => {
    it('user_books has foreign key to users', async () => {
      const result = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = 'user_books'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%users%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].def).toContain('ON DELETE CASCADE');
    });
    
    it('user_books has foreign key to books', async () => {
      const result = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = 'user_books'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%books%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].def).toContain('ON DELETE CASCADE');
    });
    
    it('refresh_tokens has foreign key to users', async () => {
      const result = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = 'refresh_tokens'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%users%'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].def).toContain('ON DELETE CASCADE');
    });
  });
  
  describe('Triggers', () => {
    it('has updated_at trigger on users table', async () => {
      const result = await pool.query(`
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'users'
        AND trigger_schema = 'public'
      `);
      
      const triggers = result.rows.map(r => r.trigger_name);
      expect(triggers.some(t => t.includes('update_users_updated_at'))).toBe(true);
    });
    
    it('has updated_at trigger on user_books table', async () => {
      const result = await pool.query(`
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'user_books'
        AND trigger_schema = 'public'
      `);
      
      const triggers = result.rows.map(r => r.trigger_name);
      expect(triggers.some(t => t.includes('update_user_books_updated_at'))).toBe(true);
    });
    
    it('has update_updated_at_column function', async () => {
      const result = await pool.query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_name = 'update_updated_at_column'
      `);
      
      expect(result.rows.length).toBe(1);
    });
  });
  
  describe('Data Types', () => {
    it('users table uses correct data types', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      `);
      
      const emailCol = result.rows.find(r => r.column_name === 'email');
      expect(emailCol.data_type).toBe('character varying');
      expect(emailCol.character_maximum_length).toBe(255);
      
      const passwordCol = result.rows.find(r => r.column_name === 'password_hash');
      expect(passwordCol.data_type).toBe('character varying');
    });
    
    it('books table uses correct data types', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'books'
      `);
      
      const yearCol = result.rows.find(r => r.column_name === 'first_publish_year');
      expect(yearCol.data_type).toBe('integer');
      
      const isCustomCol = result.rows.find(r => r.column_name === 'is_custom');
      expect(isCustomCol.data_type).toBe('boolean');
    });
    
    it('user_books table uses correct data types', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'user_books'
      `);
      
      const ratingCol = result.rows.find(r => r.column_name === 'rating');
      expect(ratingCol.data_type).toBe('integer');
      
      const statusCol = result.rows.find(r => r.column_name === 'status');
      expect(statusCol.data_type).toBe('character varying');
    });
    
    it('timestamps use timestamptz', async () => {
      const tables = ['users', 'books', 'user_books', 'refresh_tokens'];
      
      for (const table of tables) {
        const result = await pool.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = $1
          AND column_name LIKE '%at'
        `, [table]);
        
        for (const row of result.rows) {
          expect(row.data_type).toBe('timestamp with time zone');
        }
      }
    });
  });
});
