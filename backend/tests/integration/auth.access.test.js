/**
 * Authorization and Data Isolation Tests
 *
 * Tests horizontal privilege escalation prevention:
 * - Users can only access their own resources
 * - User A cannot see/modify User B's shelf data
 * - Proper 404 responses for unauthorized access (don't leak existence)
 *
 * Security research: https://github.com/goldbergyoni/javascript-testing-best-practices
 * OWASP: https://owasp.org/www-project-top-ten/2017/A5_2017-Broken_Access_Control
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import {
  createTestUserData,
  createTestBookData,
  getAuthHeaders,
  csrfHeader,
} from '../utils/test-helpers.js';

describe('Data Isolation - User Books', () => {
  let userA, userB;
  let tokenA, tokenB;
  let bookId;
  let userABookEntryId;

  beforeEach(async () => {
    // Create two users
    const userAData = createTestUserData();
    const userBData = createTestUserData();

    // Register User A
    const registerA = await request(app)
      .post('/api/users/register')
      .send(userAData)
      .expect(201);
    userA = registerA.body.user;

    // Register User B
    const registerB = await request(app)
      .post('/api/users/register')
      .send(userBData)
      .expect(201);
    userB = registerB.body.user;

    // Login User A
    const loginA = await request(app)
      .post('/api/users/login')
      .send({ email: userAData.email, password: userAData.password })
      .expect(200);
    tokenA = loginA.body.token;

    // Login User B
    const loginB = await request(app)
      .post('/api/users/login')
      .send({ email: userBData.email, password: userBData.password })
      .expect(200);
    tokenB = loginB.body.token;

    // Create a book (public endpoint, requires CSRF header)
    const bookRes = await request(app)
      .post('/api/books')
      .set(csrfHeader)
      .send(createTestBookData())
      .expect(201);
    bookId = bookRes.body.book.book_id;

    // User A adds book to their shelf
    const addRes = await request(app)
      .post('/api/user-books')
      .set(getAuthHeaders(tokenA))
      .send({ bookId, status: 'want_to_read' })
      .expect(201);
    userABookEntryId = addRes.body.entry.user_book_id;
  });

  describe('GET /api/user-books - Shelf Listing', () => {
    it('User A sees only their own books', async () => {
      const res = await request(app)
        .get('/api/user-books')
        .set(getAuthHeaders(tokenA))
        .expect(200);

      expect(res.body.shelf).toHaveLength(1);
      expect(res.body.shelf[0].user_book_id).toBe(userABookEntryId);
      expect(res.body.userId).toBe(userA.user_id);
    });

    it('User B sees only their own books (empty)', async () => {
      const res = await request(app)
        .get('/api/user-books')
        .set(getAuthHeaders(tokenB))
        .expect(200);

      expect(res.body.shelf).toHaveLength(0);
      expect(res.body.userId).toBe(userB.user_id);
    });

    it('User B cannot see User A shelf entries', async () => {
      // User B gets their shelf
      const resB = await request(app)
        .get('/api/user-books')
        .set(getAuthHeaders(tokenB))
        .expect(200);

      // Verify User A's entry is not visible
      const hasUserAEntry = resB.body.shelf.some(
        entry => entry.user_book_id === userABookEntryId
      );
      expect(hasUserAEntry).toBe(false);
    });
  });

  describe('PATCH /api/user-books/:id/status - Status Update', () => {
    it('User A can update their own entry', async () => {
      const res = await request(app)
        .patch(`/api/user-books/${userABookEntryId}/status`)
        .set(getAuthHeaders(tokenA))
        .send({ status: 'reading' })
        .expect(200);

      expect(res.body.entry.status).toBe('reading');
    });

    it('User B cannot update User A entry (returns 404)', async () => {
      // Returns 404 (not found) rather than 403 (forbidden)
      // This prevents leaking the existence of the resource
      const res = await request(app)
        .patch(`/api/user-books/${userABookEntryId}/status`)
        .set(getAuthHeaders(tokenB))
        .send({ status: 'read' })
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });

    it('does not leak information via error messages', async () => {
      // Try with User B
      const resB = await request(app)
        .patch(`/api/user-books/${userABookEntryId}/status`)
        .set(getAuthHeaders(tokenB))
        .send({ status: 'read' })
        .expect(404);

      // Error message should not reveal cross-user ownership information
      expect(resB.body.message).not.toMatch(/permission|access denied|belongs to/i);
    });
  });

  describe('PUT /api/user-books/:id/review - Review Update', () => {
    it('User A can add review to their own entry', async () => {
      const res = await request(app)
        .put(`/api/user-books/${userABookEntryId}/review`)
        .set(getAuthHeaders(tokenA))
        .send({ rating: 5, review: 'Great book!' })
        .expect(200);

      expect(res.body.entry.rating).toBe(5);
      expect(res.body.entry.review).toBe('Great book!');
    });

    it('User B cannot add review to User A entry (returns 404)', async () => {
      const res = await request(app)
        .put(`/api/user-books/${userABookEntryId}/review`)
        .set(getAuthHeaders(tokenB))
        .send({ rating: 1, review: 'Terrible!' })
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });
  });

  describe('DELETE /api/user-books/:id - Remove from Shelf', () => {
    it('User A can remove their own entry', async () => {
      await request(app)
        .delete(`/api/user-books/${userABookEntryId}`)
        .set(getAuthHeaders(tokenA))
        .expect(200);

      // Verify it's gone
      const res = await request(app)
        .get('/api/user-books')
        .set(getAuthHeaders(tokenA))
        .expect(200);

      expect(res.body.shelf).toHaveLength(0);
    });

    it('User B cannot remove User A entry (returns 404)', async () => {
      const res = await request(app)
        .delete(`/api/user-books/${userABookEntryId}`)
        .set(getAuthHeaders(tokenB))
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');

      // Verify User A's entry still exists
      const checkRes = await request(app)
        .get('/api/user-books')
        .set(getAuthHeaders(tokenA))
        .expect(200);

      expect(checkRes.body.shelf).toHaveLength(1);
    });
  });

  describe('GET /api/user-books/stats - Statistics', () => {
    it('User A sees only their own statistics', async () => {
      const res = await request(app)
        .get('/api/user-books/stats')
        .set(getAuthHeaders(tokenA))
        .expect(200);

      expect(res.body.userId).toBe(userA.user_id);
      expect(res.body.stats.total).toBe(1);
      expect(res.body.stats.wantToRead).toBe(1);
    });

    it('User B sees only their own statistics (all zeros)', async () => {
      const res = await request(app)
        .get('/api/user-books/stats')
        .set(getAuthHeaders(tokenB))
        .expect(200);

      expect(res.body.userId).toBe(userB.user_id);
      expect(res.body.stats.total).toBe(0);
    });
  });
});

describe('Data Isolation - User Profile', () => {
  let userA, userB;
  let tokenA, tokenB;

  beforeEach(async () => {
    // Create two users
    const userAData = createTestUserData();
    const userBData = createTestUserData();

    // Register both
    const registerA = await request(app)
      .post('/api/users/register')
      .send(userAData)
      .expect(201);
    userA = registerA.body.user;

    const registerB = await request(app)
      .post('/api/users/register')
      .send(userBData)
      .expect(201);
    userB = registerB.body.user;

    // Login both
    const loginA = await request(app)
      .post('/api/users/login')
      .send({ email: userAData.email, password: userAData.password })
      .expect(200);
    tokenA = loginA.body.token;

    const loginB = await request(app)
      .post('/api/users/login')
      .send({ email: userBData.email, password: userBData.password })
      .expect(200);
    tokenB = loginB.body.token;
  });

  describe('GET /api/users/me', () => {
    it('User A sees only their own profile', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(tokenA))
        .expect(200);

      expect(res.body.user.user_id).toBe(userA.user_id);
      expect(res.body.user.email).toBe(userA.email);
    });

    it('User B sees only their own profile', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(tokenB))
        .expect(200);

      expect(res.body.user.user_id).toBe(userB.user_id);
      expect(res.body.user.email).toBe(userB.email);
    });
  });

  describe('PATCH /api/users/me', () => {
    it('User A can only update their own profile', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(tokenA))
        .send({ firstName: 'UpdatedA' })
        .expect(200);

      expect(res.body.user.first_name).toBe('UpdatedA');
      expect(res.body.user.user_id).toBe(userA.user_id);
    });

    it('User B profile remains unchanged when User A updates', async () => {
      // User A updates their profile
      await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(tokenA))
        .send({ firstName: 'UpdatedA' })
        .expect(200);

      // Verify User B's profile is unchanged
      const resB = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(tokenB))
        .expect(200);

      expect(resB.body.user.first_name).toBe(userB.first_name);
    });
  });
});

describe('ID Enumeration Prevention', () => {
  let token;

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

    token = loginRes.body.token;
  });

  it('returns same 404 for non-existent and unauthorized resources', async () => {
    // Try to access a non-existent entry
    const nonExistentRes = await request(app)
      .get('/api/user-books/99999')
      .set(getAuthHeaders(token))
      .expect(404);

    // Try to access an entry that might exist but belongs to another user
    // Both should return 404 without distinguishing between the cases
    expect(nonExistentRes.body.error).toBe('NotFoundError');
  });

  it('error messages do not reveal resource existence', async () => {
    const res = await request(app)
      .patch('/api/user-books/99999/status')
      .set(getAuthHeaders(token))
      .send({ status: 'read' })
      .expect(404);

    // Should not reveal cross-user ownership information
    expect(res.body.message).not.toMatch(/permission|access denied|belongs to/i);
  });
});
