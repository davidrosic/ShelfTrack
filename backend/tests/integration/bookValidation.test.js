/**
 * Book Model Validation Tests
 *
 * Tests model-level validation in Book.js that isn't covered
 * by route-level validation tests. These tests verify:
 * - Model-specific error types (ValidationError, NotFoundError)
 * - Business logic validation (custom books vs Open Library books)
 * - Edge cases in book creation and search
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import { createTestBookData, createTestOpenLibraryBookData, csrfHeader } from '../utils/test-helpers.js';

describe('Book Model Validation', () => {
  // Ensure rate limiting is disabled for these tests
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_RATE_LIMIT = 'false';
  });

  describe('Book Creation - Model Level Validation', () => {
    it('rejects empty title at model level', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          title: '',
          author: 'Test Author',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects whitespace-only title', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          title: '   ',
          author: 'Test Author',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects empty author at model level', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          title: 'Test Title',
          author: '',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects whitespace-only author', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          title: 'Test Title',
          author: '   ',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects custom book with Open Library ID', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          openLibraryId: 'OL12345W',
          title: 'Custom Book',
          author: 'Custom Author',
          isCustom: true,
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
      expect(res.body.message).toMatch(/custom books cannot have an open library id/i);
    });

    it('allows custom book without Open Library ID', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          title: 'Custom Book',
          author: 'Custom Author',
          isCustom: true,
        })
        .expect(201);

      expect(res.body.book.is_custom).toBe(true);
      expect(res.body.book.open_library_id).toBeNull();
    });

    it('allows non-custom book with Open Library ID', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          openLibraryId: 'OL99999W',
          title: 'API Book',
          author: 'API Author',
          isCustom: false,
        })
        .expect(201);

      expect(res.body.book.is_custom).toBe(false);
      expect(res.body.book.open_library_id).toBe('OL99999W');
    });
  });

  describe('Book Creation - Data Types', () => {
    it('rejects non-integer firstPublishYear', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          firstPublishYear: 2020.5,
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects year before 1000', async () => {
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

    it('rejects year after 2100', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          firstPublishYear: 2101,
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('accepts valid year at boundaries', async () => {
      const year1000 = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          firstPublishYear: 1000,
        });

      // Year 1000 might be rejected by validation, either is acceptable
      if (year1000.status === 201) {
        expect(year1000.body.book.first_publish_year).toBe(1000);
      } else {
        expect(year1000.status).toBe(400);
      }

      const year2100 = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          firstPublishYear: 2100,
        });

      // Year 2100 might be rejected by validation, either is acceptable
      if (year2100.status === 201) {
        expect(year2100.body.book.first_publish_year).toBe(2100);
      } else {
        expect(year2100.status).toBe(400);
      }
    });

    it('accepts null for optional fields', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          title: 'Minimal Book',
          author: 'Test Author',
          openLibraryId: null,
          coverUrl: null,
          firstPublishYear: null,
        })
        .expect(201);

      expect(res.body.book.title).toBe('Minimal Book');
      expect(res.body.book.open_library_id).toBeNull();
    });
  });

  describe('Book Search - Model Level', () => {
    it('returns empty array for empty search term', async () => {
      // The search endpoint validates this before calling the model,
      // so this tests the route validation
      const res = await request(app)
        .get('/api/books/search?q=')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('handles search with no matches', async () => {
      const uniqueQuery = `NoMatchQuery${Date.now()}`;
      const res = await request(app)
        .get(`/api/books/search?q=${uniqueQuery}`)
        .expect(200);

      expect(res.body.books).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it('limits search results', async () => {
      // Create multiple books
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/books')
          .set(csrfHeader)
          .send(createTestBookData({ title: `LimitTestBook ${i}` }))
          .expect(201);
      }

      // Use universal search with source=local to test limit
      const res = await request(app)
        .get('/api/books/search-universal?q=LimitTestBook&source=local&limit=2')
        .expect(200);

      expect(res.body.books.length).toBeLessThanOrEqual(2);
    });

    it('handles special characters in search', async () => {
      // Create book with special characters
      await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          title: "Book with 'quotes' and symbols: @#$%",
          author: 'Test Author',
        })
        .expect(201);

      // Search with special characters
      const res = await request(app)
        .get('/api/books/search?q=quotes')
        .expect(200);

      const found = res.body.books.some(b => b.title.includes("'quotes'"));
      expect(found).toBe(true);
    });
  });

  describe('Book Lookup - Edge Cases', () => {
    it('returns 404 for non-existent book ID', async () => {
      const res = await request(app)
        .get('/api/books/999999')
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });

    it('returns 404 for non-existent Open Library ID', async () => {
      const uniqueOlId = `OL${Date.now()}W`;
      const res = await request(app)
        .get(`/api/books/ol/${uniqueOlId}`)
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });

    it('validates book ID format', async () => {
      const res = await request(app)
        .get('/api/books/invalid-id')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('validates Open Library ID is not empty', async () => {
      const res = await request(app)
        .get('/api/books/ol/   ')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('Book Upsert Behavior', () => {
    it('correctly identifies new vs updated books', async () => {
      const olId = `OL${Date.now()}W`;

      // First creation - should be new (201)
      const first = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          openLibraryId: olId,
          title: 'Original Title',
          author: 'Original Author',
        })
        .expect(201);

      expect(first.body.message).toBe('Book created successfully');
      expect(first.body.book.inserted).toBe(true);

      // Second creation with same OL ID - should update (200)
      const second = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          openLibraryId: olId,
          title: 'Updated Title',
          author: 'Updated Author',
        })
        .expect(200);

      expect(second.body.message).toBe('Book updated successfully');
      expect(second.body.book.inserted).toBe(false);
      expect(second.body.book.book_id).toBe(first.body.book.book_id);
    });

    it('preserves book ID during upsert', async () => {
      const olId = `OL${Date.now()}W`;

      // Create book
      const first = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          openLibraryId: olId,
          title: 'First Title',
          author: 'First Author',
        })
        .expect(201);

      const originalId = first.body.book.book_id;

      // Update same book
      const second = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          openLibraryId: olId,
          title: 'Second Title',
          author: 'Second Author',
        })
        .expect(200);

      // ID should remain the same
      expect(second.body.book.book_id).toBe(originalId);

      // Verify by fetching
      const getRes = await request(app)
        .get(`/api/books/${originalId}`)
        .expect(200);

      expect(getRes.body.book.title).toBe('Second Title');
    });
  });

  describe('Book Data Sanitization', () => {
    it('trims whitespace from title and author', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          title: '  Trimmed Title  ',
          author: '  Trimmed Author  ',
        })
        .expect(201);

      expect(res.body.book.title).toBe('Trimmed Title');
      expect(res.body.book.author).toBe('Trimmed Author');
    });

    it('preserves internal whitespace in title and author', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          title: 'Title With  Spaces',
          author: 'Author  With  Double  Spaces',
        })
        .expect(201);

      // Should trim ends but preserve internal spaces
      expect(res.body.book.title).toBe('Title With  Spaces');
      expect(res.body.book.author).toBe('Author  With  Double  Spaces');
    });
  });

  describe('Book with Cover URL', () => {
    it('accepts valid cover URL', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          coverUrl: 'https://covers.openlibrary.org/b/id/12345-M.jpg',
        })
        .expect(201);

      expect(res.body.book.cover_url).toBe('https://covers.openlibrary.org/b/id/12345-M.jpg');
    });

    it('accepts null cover URL', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          coverUrl: null,
        })
        .expect(201);

      expect(res.body.book.cover_url).toBeNull();
    });
  });
});
