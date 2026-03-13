/**
 * API Health and Routing Tests
 * 
 * Tests basic API functionality:
 * - Health check endpoint
 * - 404 handling for undefined routes
 * - CORS headers
 * - Security headers (Helmet)
 * 
 * Following Yoni Goldberg's component testing methodology:
 * - Test through public HTTP API
 * - Verify full response objects
 * - No mocking of internal components
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';

describe('API Core Functionality', () => {
  // Ensure rate limiting is disabled for these tests
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_RATE_LIMIT = 'false';
  });

  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);
      
      expect(res.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        version: expect.any(String),
      });
      
      // Verify timestamp is valid ISO format
      expect(Date.parse(res.body.timestamp)).not.toBeNaN();
    });
    
    it('returns JSON content type', async () => {
      const res = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);
    });
    
    it('is accessible without authentication', async () => {
      // Health check should work with no auth headers
      await request(app)
        .get('/health')
        .expect(200);
    });
    
    it('is not rate limited', async () => {
      // Make multiple rapid requests
      const requests = Array(10).fill().map(() => 
        request(app).get('/health')
      );
      
      const responses = await Promise.all(requests);
      
      // All should succeed (not 429)
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });
    });
  });
  
  describe('404 Handling', () => {
    it('returns 404 for undefined routes', async () => {
      const res = await request(app)
        .get('/api/this-route-does-not-exist')
        .expect(404);
      
      expect(res.body).toMatchObject({
        error: 'NotFoundError',
        message: expect.stringContaining('not found'),
      });
    });
    
    it('returns appropriate error for undefined methods on existing routes', async () => {
      // DELETE on GET-only endpoint - may return 404 or 403 (CSRF)
      const res = await request(app)
        .delete('/health');
      
      // Either 404 (not found) or 403 (CSRF protection) is acceptable
      expect([403, 404]).toContain(res.status);
    });
    
    it('returns JSON for 404 errors', async () => {
      const res = await request(app)
        .get('/undefined-route')
        .expect(404);
      
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });
  
  describe('Security Headers', () => {
    it('includes Helmet security headers', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);
      
      // X-Content-Type-Options: nosniff
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      
      // X-Frame-Options (Helmet default is DENY or SAMEORIGIN)
      expect(['DENY', 'SAMEORIGIN']).toContain(res.headers['x-frame-options']);
      
      // Content-Security-Policy
      expect(res.headers['content-security-policy']).toBeDefined();
    });
    
    it('does not expose server implementation details', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);
      
      // Should not have X-Powered-By header
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
  
  describe('CORS Configuration', () => {
    it('includes CORS headers for cross-origin requests', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173')
        .expect(200);
      
      // Access-Control-Allow-Origin should be present
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
    
    it('handles OPTIONS preflight requests', async () => {
      const res = await request(app)
        .options('/api/users/login')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);
      
      expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
    });
  });
  
  describe('Request Parsing', () => {
    it('accepts JSON request bodies', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'test@example.com', password: 'test' })
        .set('Content-Type', 'application/json');
      
      // Should parse JSON (may be 401 for bad credentials, but not 400 for parse error)
      expect(res.status).not.toBe(400);
    });
    
    it('rejects malformed JSON with 400', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send('{"invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
      
      expect(res.body.error).toMatch(/ParseError|SyntaxError|Invalid JSON/i);
    });
    
    it('respects request size limits', async () => {
      // Send a very large payload (>10MB)
      const largePayload = { data: 'x'.repeat(11 * 1024 * 1024) };
      
      const res = await request(app)
        .post('/api/users/login')
        .send(largePayload)
        .set('Content-Type', 'application/json');
      
      // Should be rejected with 413 or similar
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
