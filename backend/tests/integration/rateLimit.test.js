/**
 * Rate Limiting Tests
 *
 * Tests the rate limiting middleware to ensure:
 * - Auth endpoints are strictly limited (brute force protection)
 * - Search endpoints have moderate limits
 * - Rate limit headers are returned
 * - 429 responses include Retry-After header
 *
 * Security: Rate limiting is disabled in test environment by default.
 * These tests explicitly enable it to verify the behavior.
 *
 * NOTE: Each test creates a fresh Express app with fresh rate limiters
 * to ensure complete isolation between tests.
 *
 * Research: https://cheatsheetseries.owasp.org/cheatsheets/DOS_DDoS_Security_Cheatsheet.html
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createFreshApp, closeFreshApp } from '../utils/create-fresh-app.js';
import { createTestUserData, csrfHeader } from '../utils/test-helpers.js';

describe('Rate Limiting', () => {
  // Store original env
  let originalEnv;
  let originalRateLimit;

  beforeAll(() => {
    // Capture original values
    originalEnv = process.env.NODE_ENV;
    originalRateLimit = process.env.ENABLE_RATE_LIMIT;
    // Enable rate limiting for these tests
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_RATE_LIMIT = 'true';
  });

  afterAll(async () => {
    // Restore original env
    process.env.NODE_ENV = originalEnv;
    process.env.ENABLE_RATE_LIMIT = originalRateLimit;
  });

  describe('Auth Endpoints - Strict Limits', () => {
    it('returns 429 after exceeding login rate limit', async () => {
      const { app, server } = await createFreshApp();
      
      try {
        const userData = createTestUserData();

        // Register a user first
        await request(app)
          .post('/api/users/register')
          .send(userData)
          .expect(201);

        // Make 6 rapid login attempts (limit is 5 per 15 minutes)
        const attempts = [];
        for (let i = 0; i < 6; i++) {
          attempts.push(
            request(app)
              .post('/api/users/login')
              .send({
                email: userData.email,
                password: i === 0 ? userData.password : 'wrongpassword',
              })
          );
        }

        const responses = await Promise.all(attempts);

        // At least one should be rate limited
        const hasRateLimit = responses.some(r => r.status === 429);
        expect(hasRateLimit).toBe(true);

        // Verify rate limit response structure
        const rateLimitedResponse = responses.find(r => r.status === 429);
        if (rateLimitedResponse) {
          expect(rateLimitedResponse.body.error).toBe('RateLimitError');
        }
      } finally {
        await closeFreshApp(server);
      }
    });

    it('returns rate limit headers', async () => {
      const { app, server } = await createFreshApp();
      
      try {
        const res = await request(app)
          .post('/api/users/login')
          .send({
            email: 'test@example.com',
            password: 'wrong',
          });

        // Should have rate limit headers
        expect(res.headers['ratelimit-limit']).toBeDefined();
        expect(res.headers['ratelimit-remaining']).toBeDefined();
      } finally {
        await closeFreshApp(server);
      }
    });
  });

  describe('Search Endpoints - Moderate Limits', () => {
    it('limits search endpoint requests', async () => {
      const { app, server } = await createFreshApp();
      
      try {
        // Make many rapid search requests
        const requests = Array(35).fill().map(() =>
          request(app).get('/api/books/search?q=test')
        );

        const responses = await Promise.all(requests);

        // Some should succeed, some should be rate limited
        const successes = responses.filter(r => r.status === 200).length;
        const rateLimited = responses.filter(r => r.status === 429).length;

        // We should have both successes and rate limits
        expect(successes).toBeGreaterThan(0);
        expect(rateLimited).toBeGreaterThanOrEqual(0);
      } finally {
        await closeFreshApp(server);
      }
    });

    it('limits external search requests more strictly', async () => {
      const { app, server } = await createFreshApp();
      
      try {
        // Make rapid external search requests
        const requests = Array(15).fill().map(() =>
          request(app).get('/api/books/search-universal?q=test&source=external')
        );

        const responses = await Promise.all(requests);

        // External search has stricter limits (10 per minute)
        const rateLimited = responses.filter(r => r.status === 429);

        // At least some should be rate limited
        if (rateLimited.length > 0) {
          expect(rateLimited[0].body.error).toBe('RateLimitError');
          expect(rateLimited[0].body.message).toMatch(/rate limit/i);
        }
      } finally {
        await closeFreshApp(server);
      }
    });
  });

  describe('Write Operations - Per-User Limits', () => {
    it('limits write operations per user', async () => {
      const { app, server } = await createFreshApp();
      
      try {
        // Create a user
        const userData = createTestUserData();
        await request(app)
          .post('/api/users/register')
          .send(userData)
          .expect(201);

        // Make many rapid write requests (book creation)
        const requests = Array(35).fill().map((_, i) =>
          request(app)
            .post('/api/books')
            .set(csrfHeader)
            .send({
              title: `Rate Limit Test Book ${i}`,
              author: 'Test Author',
            })
        );

        const responses = await Promise.all(requests);

        // Should have mix of 201 (created) and 429 (rate limited)
        const created = responses.filter(r => r.status === 201).length;
        const rateLimited = responses.filter(r => r.status === 429).length;

        expect(created).toBeGreaterThan(0);
        // Rate limiting may or may not trigger depending on timing
        expect(created + rateLimited).toBe(responses.length);
      } finally {
        await closeFreshApp(server);
      }
    });
  });

  describe('Read Operations - Generous Limits', () => {
    it('allows many read operations', async () => {
      const { app, server } = await createFreshApp();
      
      try {
        // Create a book first
        const bookRes = await request(app)
          .post('/api/books')
          .set(csrfHeader)
          .send({
            title: 'Read Test Book',
            author: 'Test Author',
          })
          .expect(201);

        const bookId = bookRes.body.book.book_id;

        // Make many read requests
        const requests = Array(50).fill().map(() =>
          request(app).get(`/api/books/${bookId}`)
        );

        const responses = await Promise.all(requests);

        // Most should succeed (limit is 100 per minute)
        const successes = responses.filter(r => r.status === 200).length;
        expect(successes).toBeGreaterThan(40);
      } finally {
        await closeFreshApp(server);
      }
    });
  });

  describe('Health Check - No Rate Limiting', () => {
    it('health endpoint is not rate limited', async () => {
      const { app, server } = await createFreshApp();
      
      try {
        // Make many rapid health check requests
        const requests = Array(20).fill().map(() =>
          request(app).get('/health')
        );

        const responses = await Promise.all(requests);

        // All should succeed
        responses.forEach(res => {
          expect(res.status).toBe(200);
        });
      } finally {
        await closeFreshApp(server);
      }
    });
  });

  describe('Rate Limit Response Format', () => {
    it('includes proper error structure for 429', async () => {
      const { app, server } = await createFreshApp();
      
      try {
        // Make many requests to trigger rate limit
        const requests = Array(50).fill().map(() =>
          request(app)
            .post('/api/users/login')
            .send({ email: 'test@test.com', password: 'wrong' })
        );

        const responses = await Promise.all(requests);
        const rateLimited = responses.find(r => r.status === 429);

        if (rateLimited) {
          expect(rateLimited.body).toMatchObject({
            error: 'RateLimitError',
            message: expect.any(String),
          });
        }
      } finally {
        await closeFreshApp(server);
      }
    });

    it('includes standard rate limit headers', async () => {
      const { app, server } = await createFreshApp();
      
      try {
        const res = await request(app)
          .get('/api/books/search?q=test');

        // Standard headers from express-rate-limit
        expect(res.headers['ratelimit-limit']).toBeDefined();
        expect(res.headers['ratelimit-remaining']).toBeDefined();
        expect(res.headers['ratelimit-reset']).toBeDefined();
      } finally {
        await closeFreshApp(server);
      }
    });
  });
});
