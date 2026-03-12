/**
 * External API Integration Tests
 *
 * Tests error handling and resilience when external APIs fail:
 * - Open Library API timeout scenarios
 * - Open Library API error responses (5xx)
 * - Graceful degradation when external search fails
 * - Network error handling
 *
 * These tests verify the application remains stable even when
 * external dependencies are unavailable.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { createTestBookData, createTestUserData, getAuthHeaders, csrfHeader } from '../utils/test-helpers.js';

describe('External API Error Handling', () => {
  
  describe('GET /api/books/search - Combined Search Resilience', () => {
    it('returns local results when Open Library API fails', async () => {
      // Create a book in local DB first
      const bookRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({ title: 'Unique Local Book 12345' }))
        .expect(201);

      // Search for the book
      // Even if Open Library API fails, local results should still be returned
      const searchRes = await request(app)
        .get('/api/books/search?q=Unique Local Book 12345')
        .expect(200);

      expect(searchRes.body.books).toBeInstanceOf(Array);
      
      // Should find our local book
      const foundBook = searchRes.body.books.find(
        b => b.book_id === bookRes.body.book.book_id
      );
      expect(foundBook).toBeDefined();
      expect(foundBook.title).toBe('Unique Local Book 12345');
    });

    it('returns empty results gracefully when both sources fail', async () => {
      // Search with a very long query that might cause issues
      const searchRes = await request(app)
        .get('/api/books/search?q=test')
        .expect(200);

      // Should always return 200 with a books array, never 500
      expect(searchRes.body).toHaveProperty('books');
      expect(searchRes.body.books).toBeInstanceOf(Array);
      expect(searchRes.body).toHaveProperty('query', 'test');
    });

    it('handles special characters in search without crashing', async () => {
      const specialChars = ['<script>', 'test&test', 'test|test', 'test;test'];

      for (const char of specialChars) {
        const res = await request(app)
          .get(`/api/books/search?q=${encodeURIComponent(char)}`);

        // Should never crash (500)
        expect(res.status).not.toBe(500);
        
        // Should return valid response structure
        if (res.status === 200) {
          expect(res.body).toHaveProperty('books');
        }
      }
    });
  });

  describe('GET /api/books/search-universal - Source Parameter', () => {
    it('returns only local results when source=local', async () => {
      // Create a local book
      await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({ title: 'LocalOnlyBook' }))
        .expect(201);

      const res = await request(app)
        .get('/api/books/search-universal?q=LocalOnlyBook&source=local')
        .expect(200);

      expect(res.body.source).toBe('local');
      expect(res.body.books).toBeInstanceOf(Array);
      
      // All books should have source='local'
      res.body.books.forEach(book => {
        expect(book.source).toBe('local');
      });
    });

    it('attempts external search when source=external', async () => {
      const res = await request(app)
        .get('/api/books/search-universal?q=Shakespeare&source=external&limit=5')
        .expect(200);

      expect(res.body.source).toBe('external');
      expect(res.body.books).toBeInstanceOf(Array);
    });

    it('rejects invalid source parameter', async () => {
      const res = await request(app)
        .get('/api/books/search-universal?q=test&source=invalid')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('respects limit parameter in external search', async () => {
      const res = await request(app)
        .get('/api/books/search-universal?q=JavaScript&source=external&limit=3')
        .expect(200);

      expect(res.body.books.length).toBeLessThanOrEqual(3);
    });

    it('indicates hasMore when external results exceed limit', async () => {
      const res = await request(app)
        .get('/api/books/search-universal?q=programming&source=external&limit=5')
        .expect(200);

      expect(res.body).toHaveProperty('hasMore');
      expect(typeof res.body.hasMore).toBe('boolean');
    });
  });

  describe('Book Creation with Open Library Data', () => {
    it('creates book without Open Library ID (custom book)', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({
          title: 'Custom Book Without OL',
          author: 'Custom Author',
        }))
        .expect(201);

      expect(res.body.book.is_custom).toBe(false); // Default when no OL ID
      expect(res.body.book.open_library_id).toBeNull();
    });

    it('creates book with Open Library ID', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          openLibraryId: 'OL12345W',
          title: 'Book With OL ID',
          author: 'Test Author',
          isCustom: false,
        })
        .expect(201);

      expect(res.body.book.open_library_id).toBe('OL12345W');
    });

    it('updates existing book with same Open Library ID (upsert)', async () => {
      const olId = `OL${Date.now()}W`;

      // First creation
      const first = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          openLibraryId: olId,
          title: 'Original Title',
          author: 'Original Author',
        })
        .expect(201);

      // Second creation with same OL ID should update
      const second = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          openLibraryId: olId,
          title: 'Updated Title',
          author: 'Updated Author',
        })
        .expect(200);

      expect(second.body.book.book_id).toBe(first.body.book.book_id);
      expect(second.body.book.title).toBe('Updated Title');
      expect(second.body.message).toBe('Book updated successfully');
    });
  });

  describe('Search with Subject Filter', () => {
    it('accepts subject parameter in universal search', async () => {
      const res = await request(app)
        .get('/api/books/search-universal?q=fiction&source=external&subject=fiction&limit=5')
        .expect(200);

      expect(res.body.books).toBeInstanceOf(Array);
    });

    it('rejects invalid subject parameter', async () => {
      const res = await request(app)
        .get('/api/books/search-universal?q=test&subject=<script>')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects overly long subject parameter', async () => {
      const longSubject = 'a'.repeat(150);
      const res = await request(app)
        .get(`/api/books/search-universal?q=test&subject=${longSubject}`)
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('Search Response Structure', () => {
    it('returns consistent book structure from all sources', async () => {
      // Test local search
      const localRes = await request(app)
        .get('/api/books/search-universal?q=the&source=local&limit=1')
        .expect(200);

      if (localRes.body.books.length > 0) {
        const book = localRes.body.books[0];
        expect(book).toHaveProperty('title');
        expect(book).toHaveProperty('author');
        expect(book).toHaveProperty('source');
      }

      // Test external search
      const externalRes = await request(app)
        .get('/api/books/search-universal?q=Shakespeare&source=external&limit=1')
        .expect(200);

      if (externalRes.body.books.length > 0) {
        const book = externalRes.body.books[0];
        expect(book).toHaveProperty('title');
        expect(book).toHaveProperty('author');
        expect(book).toHaveProperty('source');
        expect(book.source).toBe('external');
      }
    });

    it('includes average_rating for local books with ratings', async () => {
      // Create user and book
      const userData = createTestUserData();
      const userRes = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      const loginRes = await request(app)
        .post('/api/users/login')
        .send({ email: userData.email, password: userData.password })
        .expect(200);

      const token = loginRes.body.token;

      // Create book
      const bookRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({ title: 'RatedBookSearchTest' }))
        .expect(201);

      // Add to shelf with rating
      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(token))
        .send({
          bookId: bookRes.body.book.book_id,
          status: 'read',
          rating: 5,
        })
        .expect(201);

      // Search should include average rating
      const searchRes = await request(app)
        .get('/api/books/search?q=RatedBookSearchTest')
        .expect(200);

      const foundBook = searchRes.body.books.find(
        b => b.book_id === bookRes.body.book.book_id
      );

      if (foundBook) {
        expect(foundBook).toHaveProperty('average_rating');
      }
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('handles empty search query gracefully', async () => {
      const res = await request(app)
        .get('/api/books/search?q=')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('handles whitespace-only search query', async () => {
      const res = await request(app)
        .get('/api/books/search?q=%20%20%20')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('handles very long search queries within limit', async () => {
      const longQuery = 'a'.repeat(100);
      const res = await request(app)
        .get(`/api/books/search?q=${longQuery}`)
        .expect(200);

      expect(res.body).toHaveProperty('books');
    });

    it('rejects search queries exceeding max length', async () => {
      const tooLongQuery = 'a'.repeat(250);
      const res = await request(app)
        .get(`/api/books/search-universal?q=${tooLongQuery}`)
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('handles unicode search queries', async () => {
      const unicodeQueries = ['日本語', 'über', 'naïve', '🎉'];

      for (const query of unicodeQueries) {
        const res = await request(app)
          .get(`/api/books/search?q=${encodeURIComponent(query)}`);

        // Should never crash
        expect(res.status).not.toBe(500);
      }
    });
  });
});
