/**
 * Input Validation and Security Tests
 *
 * Tests input validation, sanitization, and injection prevention:
 * - SQL Injection attempts
 * - XSS payload handling
 * - Mass assignment prevention
 * - Input length validation
 * - Type validation
 *
 * Security research:
 * - https://owasp.org/www-community/attacks/SQL_Injection
 * - https://owasp.org/www-community/attacks/xss/
 * - https://github.com/goldbergyoni/javascript-testing-best-practices
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import {
  createTestUserData,
  createTestBookData,
  sqlInjectionPayloads,
  xssPayloads,
  massAssignmentPayloads,
  getAuthHeaders,
  csrfHeader,
} from '../utils/test-helpers.js';

describe('Input Validation & Security', () => {
  let authToken;

  // Ensure rate limiting is disabled for these tests
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_RATE_LIMIT = 'false';
  });

  beforeEach(async () => {
    const userData = createTestUserData();

    await request(app)
      .post('/api/users/register')
      .send(userData)
      .expect(201);

    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    authToken = loginRes.body.token;
  });

  describe('SQL Injection Prevention', () => {
    it('handles SQL injection in search query safely (parameterized queries)', async () => {
      // The regular search endpoint uses parameterized queries — injection payloads
      // are treated as literal search terms and return 200, not 400.
      // This verifies the server does not crash or leak data.
      for (const payload of sqlInjectionPayloads) {
        const res = await request(app)
          .get('/api/books/search')
          .query({ q: payload });

        // Must not crash (no 500), and must not execute the injection
        expect(res.status).not.toBe(500);
        if (res.status === 200) {
          // Response should be a valid books list
          expect(res.body).toHaveProperty('books');
          expect(Array.isArray(res.body.books)).toBe(true);
        }
      }
    });

    it('rejects SQL injection in universal search', async () => {
      const res = await request(app)
        .get('/api/books/search-universal')
        .query({ q: "' OR 1=1 --" })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects SQL injection in subject filter', async () => {
      const res = await request(app)
        .get('/api/books/search-universal')
        .query({ q: 'test', subject: "'; DROP TABLE books; --" })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('handles special characters in book titles safely', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({
          title: "Book with 'quotes' and \"double quotes\"",
          author: "Author with ; semicolon",
        }))
        .expect(201);

      expect(res.body.book.title).toContain("'quotes'");
      expect(res.body.book.author).toContain(";");
    });
  });

  describe('XSS Prevention', () => {
    it('stores but does not execute XSS payloads in book titles', async () => {
      for (const xssPayload of xssPayloads) {
        const res = await request(app)
          .post('/api/books')
          .set(csrfHeader)
          .send(createTestBookData({ title: xssPayload }))
          .expect(201);

        // Should store the title (sanitization happens at output)
        expect(res.body.book.title).toBe(xssPayload);
      }
    });

    it('stores but does not execute XSS payloads in reviews', async () => {
      const bookRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      for (const xssPayload of xssPayloads) {
        const res = await request(app)
          .post('/api/user-books')
          .set(getAuthHeaders(authToken))
          .send({
            bookId: bookRes.body.book.book_id,
            review: xssPayload,
          })
          .expect(201);

        // Should store the review
        expect(res.body.entry.review).toBe(xssPayload);
      }
    });

    it('stores but does not execute XSS payloads in user names', async () => {
      for (const xssPayload of xssPayloads) {
        const res = await request(app)
          .post('/api/users/register')
          .send({
            ...createTestUserData(),
            firstName: xssPayload,
          })
          .expect(201);

        expect(res.body.user.first_name).toBe(xssPayload);
      }
    });

    it('stores but does not execute XSS payloads in notes', async () => {
      const bookRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      for (const xssPayload of xssPayloads) {
        const res = await request(app)
          .post('/api/user-books')
          .set(getAuthHeaders(authToken))
          .send({
            bookId: bookRes.body.book.book_id,
            notes: xssPayload,
          })
          .expect(201);

        // Should store the notes
        expect(res.body.entry.notes).toBe(xssPayload);
      }
    });
  });

  describe('Mass Assignment Prevention', () => {
    it('ignores forbidden user fields in registration', async () => {
      // Test all mass assignment user payload fields
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          ...massAssignmentPayloads.user,
        })
        .expect(201);

      // Should not have mass-assigned fields
      expect(res.body.user.role).toBeUndefined();
      expect(res.body.user.isAdmin).toBeUndefined();
      expect(res.body.user.password_hash).toBeUndefined();
      
      // Should have auto-generated ID, not the provided one
      expect(res.body.user.user_id).not.toBe(massAssignmentPayloads.user.user_id);
      
      // Should have auto-generated timestamp, not the provided one
      expect(res.body.user.created_at).not.toBe(massAssignmentPayloads.user.created_at);
    });

    it('ignores forbidden book fields in creation', async () => {
      // Create a book with mass assignment payload
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          ...massAssignmentPayloads.book,
        })
        .expect(201);

      // Should not have mass-assigned fields
      expect(res.body.user?.book_id).toBeUndefined();
      expect(res.body.user?.created_at).toBeUndefined();
      
      // Should have auto-generated ID, not the provided one
      expect(res.body.book.book_id).not.toBe(massAssignmentPayloads.book.book_id);
      
      // Should have auto-generated timestamp, not the provided one  
      expect(res.body.book.created_at).not.toBe(massAssignmentPayloads.book.created_at);
    });

    it('ignores password_hash in user registration', async () => {
      // Register with password_hash
      const userData = createTestUserData();
      await request(app)
        .post('/api/users/register')
        .send({
          ...userData,
          password_hash: 'hacked_hash',
        })
        .expect(201);

      // Verify user can login with their actual password (not the hacked_hash)
      const loginRes = await request(app)
        .post('/api/users/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginRes.body.token).toBeDefined();
    });
  });

  describe('Input Length Validation', () => {
    it('rejects overly long titles', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({
          title: 'x'.repeat(300),
        }))
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects overly long usernames', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          username: 'x'.repeat(60),
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects overly long reviews', async () => {
      const bookRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({
          bookId: bookRes.body.book.book_id,
          review: 'x'.repeat(15000),
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects overly long search queries', async () => {
      const res = await request(app)
        .get('/api/books/search-universal')
        .query({ q: 'x'.repeat(250) })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('Type Validation', () => {
    it('rejects non-integer book IDs', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: 'not-a-number' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects non-integer user book IDs in update', async () => {
      const res = await request(app)
        .patch('/api/user-books/abc/status')
        .set(getAuthHeaders(authToken))
        .send({ status: 'read' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects non-boolean isCustom flag', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          isCustom: 'not-a-boolean',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects non-integer firstPublishYear', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          firstPublishYear: '2020a',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('Range Validation', () => {
    it('rejects invalid year ranges', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          firstPublishYear: 999,
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects future years beyond reasonable range', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          firstPublishYear: 2500,
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects negative book IDs', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: -1 })
        .expect(400);

      // Negative IDs are rejected — either by schema validation or FK constraint
      expect(res.body.error).toMatch(/ValidationError|ReferenceError/);
    });
  });

  describe('Email Validation', () => {
    it('rejects invalid email formats', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user@.com',
        'user@example',
        'user name@example.com',
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/users/register')
          .send({
            ...createTestUserData(),
            email,
          })
          .expect(400);

        expect(res.body.error).toBe('ValidationError');
        expect(res.body.errors.email).toBeDefined();
      }
    });

    it('accepts valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
        'user123@example.io',
      ];

      for (const email of validEmails) {
        const res = await request(app)
          .post('/api/users/register')
          .send({
            ...createTestUserData(),
            email,
          });

        // Should either succeed or fail due to duplicate, not validation
        if (res.status === 400) {
          expect(res.body.errors?.email).toBeUndefined();
        }
      }
    });
  });

  describe('Password Validation', () => {
    it('rejects passwords without uppercase', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          password: 'lowercase123!',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
      expect(res.body.errors.password).toBeDefined();
    });

    it('rejects passwords without lowercase', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          password: 'UPPERCASE123!',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects passwords without numbers', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          password: 'NoNumbers!',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects passwords without special characters', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          password: 'NoSpecial123',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects short passwords', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          password: 'Short1!',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('Enum Validation', () => {
    it('rejects invalid status values', async () => {
      const bookRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({
          bookId: bookRes.body.book.book_id,
          status: 'invalid_status',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('accepts valid status values', async () => {
      const validStatuses = ['want_to_read', 'reading', 'read'];

      for (const status of validStatuses) {
        // Create new book for each status
        const newBook = await request(app)
          .post('/api/books')
          .set(csrfHeader)
          .send(createTestBookData())
          .expect(201);

        const res = await request(app)
          .post('/api/user-books')
          .set(getAuthHeaders(authToken))
          .send({
            bookId: newBook.body.book.book_id,
            status,
          })
          .expect(201);

        expect(res.body.entry.status).toBe(status);
      }
    });
  });
});
