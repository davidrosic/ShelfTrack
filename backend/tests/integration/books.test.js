/**
 * Book Management Tests
 *
 * Tests book CRUD operations:
 * - Create books (public endpoint)
 * - Search books (local and universal)
 * - Get book by ID
 * - Get book by Open Library ID
 *
 * Following Yoni Goldberg's black-box testing methodology:
 * - Test through public HTTP API
 * - Verify state via subsequent API calls
 * - Use unique identifiers for test data
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import {
  createTestBookData,
  createTestOpenLibraryBookData,
  createTestUserData,
  getAuthHeaders,
  csrfHeader,
} from '../utils/test-helpers.js';

describe('/api/books - Book Management', () => {
  // Ensure rate limiting is disabled for these tests
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_RATE_LIMIT = 'false';
  });

  describe('POST /api/books - Create Book', () => {
    it('creates a book with minimal data', async () => {
      const bookData = createTestBookData();

      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(bookData)
        .expect(201);

      expect(res.body).toMatchObject({
        message: 'Book created successfully',
        book: {
          book_id: expect.any(Number),
          title: bookData.title,
          author: bookData.author,
          created_at: expect.any(String),
        },
      });

      expect(res.body.book.is_custom).toBe(false);
    });

    it('creates a book with all fields', async () => {
      const bookData = createTestOpenLibraryBookData({
        coverUrl: 'https://example.com/cover.jpg',
        firstPublishYear: 2020,
      });

      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(bookData)
        .expect(201);

      expect(res.body.book).toMatchObject({
        title: bookData.title,
        author: bookData.author,
        open_library_id: bookData.openLibraryId,
        cover_url: bookData.coverUrl,
        first_publish_year: bookData.firstPublishYear,
      });
    });

    it('updates existing book with same Open Library ID (upsert)', async () => {
      const bookData = createTestOpenLibraryBookData();

      // Create first book
      const firstRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(bookData)
        .expect(201);

      const firstBookId = firstRes.body.book.book_id;

      // Create second book with same Open Library ID
      const updatedData = {
        ...bookData,
        title: 'Updated Title',
      };

      const secondRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(updatedData)
        .expect(200); // 200 for update, not 201

      expect(secondRes.body.message).toBe('Book updated successfully');
      expect(secondRes.body.book.book_id).toBe(firstBookId);
      expect(secondRes.body.book.title).toBe('Updated Title');
    });

    it('rejects book without title', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({ author: 'Test Author' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
      expect(res.body.errors.title).toBeDefined();
    });

    it('rejects book without author', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({ title: 'Test Title' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
      expect(res.body.errors.author).toBeDefined();
    });

    it('rejects custom books with Open Library ID', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          openLibraryId: 'OL123W',
          isCustom: true,
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

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

    it('validates firstPublishYear is an integer', async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send({
          ...createTestBookData(),
          firstPublishYear: 'not-a-number',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('GET /api/books/:id - Get Book by ID', () => {
    let createdBook;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData())
        .expect(201);

      createdBook = res.body.book;
    });

    it('returns book by ID', async () => {
      const res = await request(app)
        .get(`/api/books/${createdBook.book_id}`)
        .expect(200);

      expect(res.body.book).toMatchObject({
        book_id: createdBook.book_id,
        title: createdBook.title,
        author: createdBook.author,
      });
    });

    it('returns 404 for non-existent book ID', async () => {
      const res = await request(app)
        .get('/api/books/99999')
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });

    it('validates book ID is numeric', async () => {
      const res = await request(app)
        .get('/api/books/not-a-number')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('GET /api/books/ol/:openLibraryId - Get Book by Open Library ID', () => {
    let createdBook;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestOpenLibraryBookData())
        .expect(201);

      createdBook = res.body.book;
    });

    it('returns book by Open Library ID', async () => {
      const res = await request(app)
        .get(`/api/books/ol/${createdBook.open_library_id}`)
        .expect(200);

      expect(res.body.book).toMatchObject({
        book_id: createdBook.book_id,
        open_library_id: createdBook.open_library_id,
      });
    });

    it('returns 404 for non-existent Open Library ID', async () => {
      const res = await request(app)
        .get('/api/books/ol/OL99999W')
        .expect(404);

      expect(res.body.error).toBe('NotFoundError');
    });

    it('validates Open Library ID is provided', async () => {
      const res = await request(app)
        .get('/api/books/ol/   ')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('GET /api/books/search - Local Database Search', () => {
    beforeEach(async () => {
      // Create some books for searching
      await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({ title: 'Unique Search Title Alpha', author: 'Author One' }))
        .expect(201);

      await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({ title: 'Another Book Beta', author: 'Author Two' }))
        .expect(201);

      await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({ title: 'Third Book Gamma', author: 'Author Alpha' }))
        .expect(201);
    });

    it('searches by title', async () => {
      const res = await request(app)
        .get('/api/books/search?q=Alpha')
        .expect(200);

      expect(res.body.books.length).toBeGreaterThanOrEqual(1);
      expect(res.body.query).toBe('Alpha');
    });

    it('searches by author', async () => {
      const res = await request(app)
        .get('/api/books/search?q=Author One')
        .expect(200);

      expect(res.body.books.length).toBeGreaterThanOrEqual(1);
    });

    it('performs case-insensitive search', async () => {
      const res = await request(app)
        .get('/api/books/search?q=alpha')
        .expect(200);

      // Should find both "Alpha" in title and "Alpha" in author
      expect(res.body.books.length).toBeGreaterThanOrEqual(1);
    });

    it('requires search query', async () => {
      const res = await request(app)
        .get('/api/books/search')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects empty search query', async () => {
      const res = await request(app)
        .get('/api/books/search?q=   ')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('respects limit parameter', async () => {
      // Create more books
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/books')
          .set(csrfHeader)
          .send(createTestBookData({ title: `Limit Test ${i}` }))
          .expect(201);
      }

      // Use search-universal with source=local to test limit without OL API interference
      const res = await request(app)
        .get('/api/books/search-universal?q=Limit Test&source=local&limit=2')
        .expect(200);

      expect(res.body.books.length).toBeLessThanOrEqual(2);
    });

    it('includes average rating in results', async () => {
      // Create a user and add rating
      const userData = createTestUserData();
      await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      const loginRes = await request(app)
        .post('/api/users/login')
        .send({ email: userData.email, password: userData.password })
        .expect(200);

      const token = loginRes.body.token;

      // Add book to shelf with rating
      const bookRes = await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({ title: 'Rated Book Search' }))
        .expect(201);

      await request(app)
        .post('/api/user-books')
        .set(getAuthHeaders(token))
        .send({ bookId: bookRes.body.book.book_id, rating: 5 })
        .expect(201);

      // Search for the book
      const searchRes = await request(app)
        .get('/api/books/search?q=Rated Book Search')
        .expect(200);

      const foundBook = searchRes.body.books.find(
        b => b.book_id === bookRes.body.book.book_id
      );

      expect(foundBook).toBeDefined();
      expect(foundBook.average_rating).toBe('5.0');
    });
  });

  describe('GET /api/books/search-universal - Universal Search', () => {
    it('searches local database with source=local', async () => {
      // Create a book first
      await request(app)
        .post('/api/books')
        .set(csrfHeader)
        .send(createTestBookData({ title: 'Universal Local Search' }))
        .expect(201);

      const res = await request(app)
        .get('/api/books/search-universal?q=Universal Local&source=local')
        .expect(200);

      expect(res.body.source).toBe('local');
      expect(res.body.books.length).toBeGreaterThanOrEqual(1);
    });

    it('validates source parameter', async () => {
      const res = await request(app)
        .get('/api/books/search-universal?q=test&source=invalid')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('validates search query length', async () => {
      const longQuery = 'x'.repeat(250);

      const res = await request(app)
        .get(`/api/books/search-universal?q=${longQuery}`)
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects search with invalid characters', async () => {
      const res = await request(app)
        .get('/api/books/search-universal?q=test<script>')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('requires search query', async () => {
      const res = await request(app)
        .get('/api/books/search-universal')
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });
});
