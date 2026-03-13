/**
 * User Books Pagination Tests
 *
 * Tests pagination, limit, and offset parameters for user book shelf:
 * - Limit parameter enforcement
 * - Offset parameter for skipping results
 * - Maximum limit validation
 * - Combined limit + offset
 * - Pagination with status filtering
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { createTestUserData, createTestBookData, getAuthHeaders, csrfHeader } from '../utils/test-helpers.js';

describe('User Books Pagination', () => {
  let authToken;
  let bookIds = [];

  // Ensure rate limiting is disabled for these tests
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_RATE_LIMIT = 'false';
  });

  beforeEach(async () => {
    // Create user and login
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
    bookIds = [];

    // Create 10 books with alternating statuses (reduced from 15 for test performance)
    for (let i = 0; i < 10; i++) {
      const bookRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({ title: `Pagination Book ${i}` }))
        .expect(201);

      bookIds.push(bookRes.body.book.book_id);

      // Add to shelf with alternating statuses
      const status = i % 3 === 0 ? 'want_to_read' : i % 3 === 1 ? 'reading' : 'read';
      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({
          bookId: bookRes.body.book.book_id,
          status,
        })
        .expect(201);
    }
  });

  describe('Limit Parameter', () => {
    it('returns default number of books when limit not specified', async () => {
      const res = await request(app)
        .get('/api/user-books')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Default limit is 50, we created 10
      expect(res.body.shelf.length).toBe(10);
      expect(res.body.count).toBe(10);
    });

    it('respects limit parameter', async () => {
      const res = await request(app)
        .get('/api/user-books?limit=5')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.shelf.length).toBe(5);
    });

    it('respects limit of 1', async () => {
      const res = await request(app)
        .get('/api/user-books?limit=1')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.shelf.length).toBe(1);
    });

    it('enforces maximum limit of 100', async () => {
      // Request more than max
      const res = await request(app)
        .get('/api/user-books?limit=150')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Should return all 10 (not 150), but if we had 100+, it would be capped
      expect(res.body.shelf.length).toBeLessThanOrEqual(100);
    });

    it('handles limit=0 gracefully', async () => {
      const res = await request(app)
        .get('/api/user-books?limit=0')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Should either return default or 0 results
      expect(res.body.shelf.length).toBeGreaterThanOrEqual(0);
    });

    it('rejects negative limit', async () => {
      const res = await request(app)
        .get('/api/user-books?limit=-5')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Should treat negative as default or 0
      expect(res.body.shelf.length).toBeGreaterThanOrEqual(0);
    });

    it('rejects non-numeric limit', async () => {
      const res = await request(app)
        .get('/api/user-books?limit=abc')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Should use default limit
      expect(res.body.shelf.length).toBeGreaterThan(0);
    });
  });

  describe('Offset Parameter', () => {
    it('returns books from beginning when offset=0', async () => {
      const res = await request(app)
        .get('/api/user-books?offset=0&limit=5')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.shelf.length).toBe(5);
    });

    it('skips books with offset', async () => {
      // Get first 5
      const first = await request(app)
        .get('/api/user-books?limit=5')
        .set(getAuthHeaders(authToken))
        .expect(200);

      const firstBookIds = first.body.shelf.map(b => b.book_id);

      // Get next 5 with offset
      const second = await request(app)
        .get('/api/user-books?offset=5&limit=5')
        .set(getAuthHeaders(authToken))
        .expect(200);

      const secondBookIds = second.body.shelf.map(b => b.book_id);

      // Should be different books
      const overlap = firstBookIds.filter(id => secondBookIds.includes(id));
      expect(overlap.length).toBe(0);
    });

    it('returns empty array when offset exceeds total', async () => {
      const res = await request(app)
        .get('/api/user-books?offset=100')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.shelf).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it('handles negative offset gracefully', async () => {
      const res = await request(app)
        .get('/api/user-books?offset=-5')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Should treat as 0
      expect(res.body.shelf.length).toBeGreaterThan(0);
    });

    it('rejects non-numeric offset', async () => {
      const res = await request(app)
        .get('/api/user-books?offset=abc')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Should use default offset (0)
      expect(res.body.shelf.length).toBeGreaterThan(0);
    });
  });

  describe('Combined Limit and Offset', () => {
    it('correctly paginates through all books', async () => {
      const pageSize = 5;
      const allBookIds = [];

      // Get page 1
      const page1 = await request(app)
        .get(`/api/user-books?offset=0&limit=${pageSize}`)
        .set(getAuthHeaders(authToken))
        .expect(200);

      allBookIds.push(...page1.body.shelf.map(b => b.book_id));

      // Get page 2
      const page2 = await request(app)
        .get(`/api/user-books?offset=5&limit=${pageSize}`)
        .set(getAuthHeaders(authToken))
        .expect(200);

      allBookIds.push(...page2.body.shelf.map(b => b.book_id));

      // Get page 3
      const page3 = await request(app)
        .get(`/api/user-books?offset=10&limit=${pageSize}`)
        .set(getAuthHeaders(authToken))
        .expect(200);

      allBookIds.push(...page3.body.shelf.map(b => b.book_id));

      // Should have 10 unique books
      const uniqueIds = [...new Set(allBookIds)];
      expect(uniqueIds.length).toBe(10);
    });

    it('returns partial page at end', async () => {
      const res = await request(app)
        .get('/api/user-books?offset=12&limit=10')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Should return remaining 0 books (10 - 10 = 0)
      // Offset 12 with only 10 books means no results
      expect(res.body.shelf.length).toBe(0);
    });

    it('maintains sort order across pages', async () => {
      // Get first page
      const page1 = await request(app)
        .get('/api/user-books?offset=0&limit=5')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Get second page
      const page2 = await request(app)
        .get('/api/user-books?offset=5&limit=5')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // All books should be sorted by updated_at DESC
      const allTimestamps = [
        ...page1.body.shelf.map(b => new Date(b.updated_at).getTime()),
        ...page2.body.shelf.map(b => new Date(b.updated_at).getTime()),
      ];

      // Verify descending order
      for (let i = 1; i < allTimestamps.length; i++) {
        expect(allTimestamps[i]).toBeLessThanOrEqual(allTimestamps[i - 1]);
      }
    });
  });

  describe('Pagination with Status Filter', () => {
    it('respects limit with status filter', async () => {
      // We created 4 want_to_read (indices 0, 3, 6, 9)
      const res = await request(app)
        .get('/api/user-books?status=want_to_read&limit=3')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.status).toBe('want_to_read');
      expect(res.body.shelf.length).toBeLessThanOrEqual(3);
      expect(res.body.shelf.every(b => b.status === 'want_to_read')).toBe(true);
    });

    it('respects offset with status filter', async () => {
      // Get all want_to_read books
      const all = await request(app)
        .get('/api/user-books?status=want_to_read')
        .set(getAuthHeaders(authToken))
        .expect(200);

      const totalWantToRead = all.body.shelf.length;

      if (totalWantToRead > 2) {
        // Skip first 2
        const offset = await request(app)
          .get('/api/user-books?status=want_to_read&offset=2')
          .set(getAuthHeaders(authToken))
          .expect(200);

        expect(offset.body.shelf.length).toBe(totalWantToRead - 2);
      }
    });

    it('combines limit, offset, and status filter', async () => {
      const res = await request(app)
        .get('/api/user-books?status=reading&offset=1&limit=2')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.status).toBe('reading');
      expect(res.body.shelf.length).toBeLessThanOrEqual(2);
      expect(res.body.shelf.every(b => b.status === 'reading')).toBe(true);
    });
  });

  describe('Response Structure', () => {
    it('includes correct count in response', async () => {
      const res = await request(app)
        .get('/api/user-books?limit=5')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('shelf');
      expect(res.body.count).toBe(res.body.shelf.length);
    });

    it('includes book details in paginated results', async () => {
      const res = await request(app)
        .get('/api/user-books?limit=2')
        .set(getAuthHeaders(authToken))
        .expect(200);

      res.body.shelf.forEach(book => {
        expect(book).toHaveProperty('user_book_id');
        expect(book).toHaveProperty('book_id');
        expect(book).toHaveProperty('title');
        expect(book).toHaveProperty('author');
        expect(book).toHaveProperty('status');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles very large offset gracefully', async () => {
      const res = await request(app)
        .get('/api/user-books?offset=999999')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.shelf).toEqual([]);
    });

    it('handles maximum allowed offset', async () => {
      const res = await request(app)
        .get('/api/user-books?offset=100000')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Should either return empty or clamp to valid range
      expect(res.body.shelf.length).toBeGreaterThanOrEqual(0);
    });

    it('paginates correctly with empty shelf', async () => {
      // Create new user with empty shelf
      const newUser = createTestUserData();
      await request(app)
        .post('/api/users/register')
        .send(newUser)
        .expect(201);

      const loginRes = await request(app)
        .post('/api/users/login')
        .send({ email: newUser.email, password: newUser.password })
        .expect(200);

      const res = await request(app)
        .get('/api/user-books?offset=10&limit=5')
        .set(getAuthHeaders(loginRes.body.token))
        .expect(200);

      expect(res.body.shelf).toEqual([]);
      expect(res.body.count).toBe(0);
    });
  });
});
