/**
 * User Book Shelf Management Tests
 *
 * Tests the user book shelf functionality:
 * - Add books to shelf
 * - Get shelf with filtering
 * - Update reading status
 * - Update reviews and ratings
 * - Remove books from shelf
 * - Reading statistics
 *
 * Following Yoni Goldberg's black-box testing methodology:
 * - Test through public HTTP API only
 * - Verify state changes via subsequent GET requests
 * - Use real authentication (not mocked)
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import {
  createTestUserData,
  createTestBookData,
  getAuthHeaders,
  csrfHeader,
} from '../utils/test-helpers.js';

describe('/api/user-books - Shelf Management', () => {
  let authToken;
  let userId;
  let testBookId;

  // Ensure rate limiting is disabled for these tests
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_RATE_LIMIT = 'false';
  });

  beforeEach(async () => {
    // Create user and get token
    const userData = createTestUserData();

    const registerRes = await request(app)
      .post('/api/users/register')
      .send(userData)
      .expect(201);

    userId = registerRes.body.user.user_id;

    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    authToken = loginRes.body.token;

    // Create a test book
    const bookRes = await request(app)
      .post('/api/books')
      .set(csrfHeader)
      .send(createTestBookData())
      .expect(201);

    testBookId = bookRes.body.book.book_id;
  });

  describe('POST /api/user-books - Add to Shelf', () => {
    it('adds a book to shelf with default status', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId })
        .expect(201);

      expect(res.body).toMatchObject({
        message: 'Book added to shelf',
        entry: {
          user_book_id: expect.any(Number),
          book_id: testBookId,
          user_id: userId,
          status: 'want_to_read',
        },
      });
    });

    it('adds a book with specific status', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, status: 'reading' })
        .expect(201);

      expect(res.body.entry.status).toBe('reading');
    });

    it('adds a book with rating and review', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({
          bookId: testBookId,
          status: 'read',
          rating: 5,
          review: 'Excellent book!',
          notes: 'Private notes here',
        })
        .expect(201);

      expect(res.body.entry).toMatchObject({
        status: 'read',
        rating: 5,
        review: 'Excellent book!',
        notes: 'Private notes here',
      });
    });

    it('rejects adding without bookId', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ status: 'reading' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
      expect(res.body.errors.bookId).toBeDefined();
    });

    it('rejects adding with invalid bookId', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: 99999 })
        .expect(400);

      expect(res.body.error).toMatch(/reference|constraint/i);
    });

    it('rejects invalid status values', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, status: 'invalid_status' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects rating outside 1-5 range', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, rating: 10 })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('updates existing entry for same book (idempotent)', async () => {
      // First addition
      const firstRes = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, status: 'want_to_read' })
        .expect(201);

      const firstEntryId = firstRes.body.entry.user_book_id;

      // Second addition of same book
      const secondRes = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, status: 'reading' })
        .expect(201);

      // Should update the same entry
      expect(secondRes.body.entry.user_book_id).toBe(firstEntryId);
      expect(secondRes.body.entry.status).toBe('reading');
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ bookId: testBookId })
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('requires CSRF header', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bookId: testBookId })
        .expect(403);

      expect(res.body.error).toMatch(/CSRF/i);
    });
  });

  describe('GET /api/user-books - Get Shelf', () => {
    beforeEach(async () => {
      // Add multiple books to shelf
      const book2 = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      const book3 = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, status: 'reading' })
        .expect(201);

      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: book2.body.book.book_id, status: 'read' })
        .expect(201);

      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: book3.body.book.book_id, status: 'want_to_read' })
        .expect(201);
    });

    it('returns all books on shelf', async () => {
      const res = await request(app)
        .get('/api/user-books')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body).toMatchObject({
        userId,
        status: 'all',
        count: 3,
        shelf: expect.any(Array),
      });

      expect(res.body.shelf).toHaveLength(3);
    });

    it('filters by status', async () => {
      const res = await request(app)
        .get('/api/user-books?status=reading')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.status).toBe('reading');
      expect(res.body.shelf.every(b => b.status === 'reading')).toBe(true);
    });

    it('rejects invalid status filter', async () => {
      const res = await request(app)
        .get('/api/user-books?status=invalid')
        .set(getAuthHeaders(authToken))
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('includes book details in response', async () => {
      const res = await request(app)
        .get('/api/user-books')
        .set(getAuthHeaders(authToken))
        .expect(200);

      const entry = res.body.shelf[0];
      expect(entry).toMatchObject({
        title: expect.any(String),
        author: expect.any(String),
        status: expect.any(String),
      });
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get('/api/user-books')
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });
  });

  describe('GET /api/user-books/stats - Reading Statistics', () => {
    beforeEach(async () => {
      // Add books with different statuses
      const book2 = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      const book3 = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, status: 'want_to_read' })
        .expect(201);

      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: book2.body.book.book_id, status: 'reading' })
        .expect(201);

      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: book3.body.book.book_id, status: 'read', rating: 4 })
        .expect(201);
    });

    it('returns reading statistics', async () => {
      const res = await request(app)
        .get('/api/user-books/stats')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body).toMatchObject({
        userId,
        stats: {
          wantToRead: 1,
          reading: 1,
          read: 1,
          total: 3,
        },
      });
    });

    it('calculates average rating', async () => {
      // Add another rated book
      const book4 = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: book4.body.book.book_id, status: 'read', rating: 5 })
        .expect(201);

      const res = await request(app)
        .get('/api/user-books/stats')
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Average of 4 and 5 = 4.5
      expect(res.body.stats.averageRating).toBe(4.5);
    });

    it('returns null average when no ratings', async () => {
      // Create new user with no rated books
      const newUserData = createTestUserData();

      await request(app)
        .post('/api/users/register')
        .send(newUserData)
        .expect(201);

      const loginRes = await request(app)
        .post('/api/users/login')
        .send({ email: newUserData.email, password: newUserData.password })
        .expect(200);

      const res = await request(app)
        .get('/api/user-books/stats')
        .set(getAuthHeaders(loginRes.body.token))
        .expect(200);

      expect(res.body.stats.averageRating).toBeNull();
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get('/api/user-books/stats')
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });
  });

  describe('PATCH /api/user-books/:id/status - Update Status', () => {
    let entryId;

    beforeEach(async () => {
      const addRes = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, status: 'want_to_read' })
        .expect(201);

      entryId = addRes.body.entry.user_book_id;
    });

    it('updates reading status', async () => {
      const res = await request(app)
        .patch(`/api/user-books/${entryId}/status`)
        .set(getAuthHeaders(authToken))
        .send({ status: 'reading' })
        .expect(200);

      expect(res.body.entry.status).toBe('reading');
    });

    it('validates status value', async () => {
      const res = await request(app)
        .patch(`/api/user-books/${entryId}/status`)
        .set(getAuthHeaders(authToken))
        .send({ status: 'invalid' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('returns 404 for non-existent entry', async () => {
      const res = await request(app)
        .patch('/api/user-books/99999/status')
        .set(getAuthHeaders(authToken))
        .send({ status: 'read' })
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .patch(`/api/user-books/${entryId}/status`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ status: 'read' })
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('requires CSRF header', async () => {
      const res = await request(app)
        .patch(`/api/user-books/${entryId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'read' })
        .expect(403);

      expect(res.body.error).toMatch(/CSRF/i);
    });
  });

  describe('PUT /api/user-books/:id/review - Update Review', () => {
    let entryId;

    beforeEach(async () => {
      const addRes = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, status: 'read' })
        .expect(201);

      entryId = addRes.body.entry.user_book_id;
    });

    it('updates rating', async () => {
      const res = await request(app)
        .put(`/api/user-books/${entryId}/review`)
        .set(getAuthHeaders(authToken))
        .send({ rating: 5 })
        .expect(200);

      expect(res.body.entry.rating).toBe(5);
    });

    it('updates review text', async () => {
      const res = await request(app)
        .put(`/api/user-books/${entryId}/review`)
        .set(getAuthHeaders(authToken))
        .send({ review: 'Updated review' })
        .expect(200);

      expect(res.body.entry.review).toBe('Updated review');
    });

    it('updates notes', async () => {
      const res = await request(app)
        .put(`/api/user-books/${entryId}/review`)
        .set(getAuthHeaders(authToken))
        .send({ notes: 'Private notes' })
        .expect(200);

      expect(res.body.entry.notes).toBe('Private notes');
    });

    it('updates multiple fields at once', async () => {
      const res = await request(app)
        .put(`/api/user-books/${entryId}/review`)
        .set(getAuthHeaders(authToken))
        .send({
          rating: 4,
          review: 'Great book',
          notes: 'Would recommend',
        })
        .expect(200);

      expect(res.body.entry).toMatchObject({
        rating: 4,
        review: 'Great book',
        notes: 'Would recommend',
      });
    });

    it('requires at least one field', async () => {
      const res = await request(app)
        .put(`/api/user-books/${entryId}/review`)
        .set(getAuthHeaders(authToken))
        .send({})
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('validates rating range', async () => {
      const res = await request(app)
        .put(`/api/user-books/${entryId}/review`)
        .set(getAuthHeaders(authToken))
        .send({ rating: 10 })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('returns 404 for non-existent entry', async () => {
      const res = await request(app)
        .put('/api/user-books/99999/review')
        .set(getAuthHeaders(authToken))
        .send({ rating: 5 })
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .put(`/api/user-books/${entryId}/review`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ rating: 5 })
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('requires CSRF header', async () => {
      const res = await request(app)
        .put(`/api/user-books/${entryId}/review`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 5 })
        .expect(403);

      expect(res.body.error).toMatch(/CSRF/i);
    });
  });

  describe('DELETE /api/user-books/:id - Remove from Shelf', () => {
    let entryId;

    beforeEach(async () => {
      const addRes = await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId })
        .expect(201);

      entryId = addRes.body.entry.user_book_id;
    });

    it('removes book from shelf', async () => {
      await request(app)
        .delete(`/api/user-books/${entryId}`)
        .set(getAuthHeaders(authToken))
        .expect(200);

      // Verify it's removed
      const res = await request(app)
        .get('/api/user-books')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.shelf).toHaveLength(0);
    });

    it('returns removed entry details', async () => {
      const res = await request(app)
        .delete(`/api/user-books/${entryId}`)
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body).toMatchObject({
        message: 'Book removed from shelf',
        entry: {
          user_book_id: entryId,
          book_id: testBookId,
        },
      });
    });

    it('returns 404 for non-existent entry', async () => {
      const res = await request(app)
        .delete('/api/user-books/99999')
        .set(getAuthHeaders(authToken))
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .delete(`/api/user-books/${entryId}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('requires CSRF header', async () => {
      const res = await request(app)
        .delete(`/api/user-books/${entryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(res.body.error).toMatch(/CSRF/i);
    });
  });

  describe('GET /api/user-books/by-ol/:olId - Get Entry by Open Library ID', () => {
    let olId;

    beforeEach(async () => {
      // Create a book with Open Library ID
      const bookRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          openLibraryId: 'OL12345W',
        })
        .expect(201);

      olId = bookRes.body.book.open_library_id;
      testBookId = bookRes.body.book.book_id;

      // Add to shelf
      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(authToken))
        .send({ bookId: testBookId, status: 'reading' })
        .expect(201);
    });

    it('returns shelf entry by Open Library ID', async () => {
      const res = await request(app)
        .get(`/api/user-books/by-ol/${olId}`)
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body.entry).toMatchObject({
        status: 'reading',
        open_library_id: olId,
      });
    });

    it('returns 404 if book not on shelf', async () => {
      const res = await request(app)
        .get('/api/user-books/by-ol/OL99999W')
        .set(getAuthHeaders(authToken))
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .get(`/api/user-books/by-ol/${olId}`)
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });
  });
});
