/**
 * Authentication Security Tests
 * 
 * Tests JWT security mechanisms:
 * - Token expiry handling
 * - Signature verification
 * - Algorithm confusion attacks
 * - Token tampering
 * - Replay attacks
 * 
 * Security research: https://github.com/goldbergyoni/javascript-testing-best-practices
 * JWT best practices: https://tools.ietf.org/html/rfc8725
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import {
  createTestUserData,
  createTestJWT,
  createExpiredJWT,
  createWrongSecretJWT,
  createTamperedJWT,
  createNoneAlgorithmJWT,
  malformedJWTs,
  getAuthHeaders,
} from '../utils/test-helpers.js';

describe('JWT Security', () => {
  let userId;
  let validToken;
  
  beforeEach(async () => {
    // Create a user for testing
    const userData = createTestUserData();
    
    const registerRes = await request(app)
      .post('/api/users/register')
      .send(userData)
      .expect(201);
    
    userId = registerRes.body.user.user_id;
    
    // Login to get a valid token
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);
    
    validToken = loginRes.body.token;
  });
  
  describe('Token Expiry', () => {
    it('rejects expired tokens', async () => {
      const expiredToken = createExpiredJWT({ user_id: userId });
      
      const res = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(expiredToken))
        .expect(401);
      
      expect(res.body.error).toMatch(/token expired/i);
    });
    
    it('accepts valid tokens', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(validToken))
        .expect(200);
      
      expect(res.body.user.user_id).toBe(userId);
    });
  });
  
  describe('Signature Verification', () => {
    it('rejects tokens signed with wrong secret', async () => {
      const wrongSecretToken = createWrongSecretJWT({ user_id: userId });
      
      const res = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(wrongSecretToken))
        .expect(401);
      
      expect(res.body.error).toMatch(/invalid token/i);
    });
    
    it('rejects tampered tokens (payload modified)', async () => {
      const tamperedToken = createTamperedJWT({ user_id: userId });
      
      const res = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(tamperedToken))
        .expect(401);
      
      expect(res.body.error).toMatch(/invalid token/i);
    });
  });
  
  describe('Algorithm Confusion Attacks', () => {
    it('rejects tokens with alg: none', async () => {
      const noneAlgToken = createNoneAlgorithmJWT({ user_id: userId });
      
      const res = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(noneAlgToken))
        .expect(401);
      
      expect(res.body.error).toMatch(/invalid token/i);
    });
  });
  
  describe('Malformed Tokens', () => {
    it('rejects tokens without Bearer prefix', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', malformedJWTs.noPrefix)
        .expect(401);
      
      expect(res.body.error).toMatch(/authentication required/i);
    });
    
    it('rejects incomplete tokens (2 parts)', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${malformedJWTs.twoParts}`)
        .expect(401);
      
      expect(res.body.error).toMatch(/invalid token/i);
    });
    
    it('rejects empty Bearer token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', malformedJWTs.empty)
        .expect(401);
      
      expect(res.body.error).toMatch(/authentication required/i);
    });
    
    it('rejects tokens with wrong number of segments', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', malformedJWTs.wrongSegments)
        .expect(401);
      
      expect(res.body.error).toMatch(/invalid token/i);
    });
  });
  
  describe('Deleted User Handling', () => {
    it('rejects tokens for deleted users', async () => {
      // Create a new user specifically for this test
      const tempUserData = createTestUserData();
      
      const registerRes = await request(app)
        .post('/api/users/register')
        .send(tempUserData)
        .expect(201);
      
      const tempUserId = registerRes.body.user.user_id;
      
      const loginRes = await request(app)
        .post('/api/users/login')
        .send({
          email: tempUserData.email,
          password: tempUserData.password,
        })
        .expect(200);
      
      const tempToken = loginRes.body.token;
      
      // Note: In a real scenario, we would delete the user here
      // Since we don't have a delete endpoint, we test with a non-existent user ID
      const fakeUserToken = createTestJWT({ user_id: 999999 });
      
      const res = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(fakeUserToken))
        .expect(401);
      
      expect(res.body.error).toMatch(/user not found/i);
    });
  });
  
  describe('Token Replay', () => {
    it('accepts same token multiple times within validity window', async () => {
      // Same token can be used for multiple requests (stateless JWT)
      const res1 = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(validToken))
        .expect(200);
      
      const res2 = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(validToken))
        .expect(200);
      
      expect(res1.body.user.user_id).toBe(res2.body.user.user_id);
    });
  });
  
  describe('Token Payload Structure', () => {
    it('contains expected claims in valid token', async () => {
      // Decode the token to verify structure
      const tokenParts = validToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
      
      expect(payload).toMatchObject({
        user_id: expect.any(Number),
        iat: expect.any(Number),
        exp: expect.any(Number),
      });
      
      // Verify expiry is in the future
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      
      // Verify issued at is in the past
      expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });
    
    it('does not contain sensitive data in token payload', async () => {
      const tokenParts = validToken.split('.');
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
      
      // Should not contain password, email, etc.
      expect(payload.password).toBeUndefined();
      expect(payload.password_hash).toBeUndefined();
      expect(payload.email).toBeUndefined();
    });
  });
});

describe('CSRF Protection', () => {
  let authToken;
  
  beforeEach(async () => {
    const userData = createTestUserData();
    
    await request(app)
      .post('/api/users/register')
      .send(userData)
      .expect(201);
    
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);
    
    authToken = loginRes.body.token;
  });
  
  describe('Protected Endpoints', () => {
    it('requires CSRF header for POST requests', async () => {
      const res = await request(app)
        .post('/api/user-books')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bookId: 1 })
        .expect(403);
      
      expect(res.body.error).toMatch(/CSRF/i);
    });
    
    it('requires CSRF header for PATCH requests', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Test' })
        .expect(403);
      
      expect(res.body.error).toMatch(/CSRF/i);
    });
    
    it('requires CSRF header for PUT requests', async () => {
      const res = await request(app)
        .put('/api/user-books/1/review')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 5 })
        .expect(403);
      
      expect(res.body.error).toMatch(/CSRF/i);
    });
    
    it('requires CSRF header for DELETE requests', async () => {
      const res = await request(app)
        .delete('/api/user-books/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
      
      expect(res.body.error).toMatch(/CSRF/i);
    });
  });
  
  describe('Exempt Endpoints', () => {
    it('login does not require CSRF header', async () => {
      const userData = createTestUserData();
      
      await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);
      
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);
      
      expect(res.body.token).toBeDefined();
    });
    
    it('register does not require CSRF header', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send(createTestUserData())
        .expect(201);
      
      expect(res.body.user).toBeDefined();
    });
  });
  
  describe('CSRF Header Validation', () => {
    it('accepts XMLHttpRequest value', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ firstName: 'Test' })
        .expect(200);
      
      expect(res.body.user).toBeDefined();
    });
    
    it('rejects incorrect CSRF header value', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Requested-With', 'WrongValue')
        .send({ firstName: 'Test' })
        .expect(403);
      
      expect(res.body.error).toMatch(/CSRF/i);
    });
  });
});
