/**
 * Authentication Flow Tests
 *
 * Tests the complete JWT lifecycle:
 * - User registration
 * - User login
 * - Token refresh
 * - Logout
 *
 * Following Yoni Goldberg's black-box testing methodology:
 * - Test through public HTTP API only
 * - Verify state changes via subsequent API calls
 * - Use real JWT signing (same secret as app)
 * - Assert on full response objects
 *
 * Research: https://github.com/goldbergyoni/javascript-testing-best-practices
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/server.js';
import {
  createTestUserData,
  generateInvalidPassword,
  extractRefreshToken,
  getAuthHeaders,
  csrfHeader,
} from '../utils/test-helpers.js';

describe('/api/users - User Authentication', () => {

  describe('POST /api/users/register', () => {
    it('creates a new user with valid data', async () => {
      const userData = createTestUserData();

      const res = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(res.body).toMatchObject({
        message: 'User registered successfully',
        user: {
          user_id: expect.any(Number),
          email: userData.email,
          username: userData.username,
          first_name: userData.firstName,
          last_name: userData.lastName,
          created_at: expect.any(String),
        },
      });

      // Verify password_hash is NOT returned
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('rejects duplicate email addresses', async () => {
      const userData = createTestUserData();

      // Create first user
      await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      // Try to create second user with same email
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          email: userData.email, // Same email
        })
        .expect(409);

      expect(res.body.error).toBe('ConflictError');
    });

    it('rejects duplicate usernames', async () => {
      const userData = createTestUserData();

      // Create first user
      await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      // Try to create second user with same username
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          username: userData.username, // Same username
        })
        .expect(409);

      expect(res.body.error).toBe('ConflictError');
    });

    it('validates email format', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          email: 'not-an-email',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
      expect(res.body.errors.email).toBeDefined();
    });

    it('validates password complexity', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          password: generateInvalidPassword(),
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
      expect(res.body.errors.password).toBeDefined();
    });

    it('requires all mandatory fields', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({})
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
      expect(res.body.errors).toMatchObject({
        email: expect.any(Array),
        username: expect.any(Array),
        password: expect.any(Array),
        firstName: expect.any(Array),
        lastName: expect.any(Array),
      });
    });

    it('trims whitespace from string fields', async () => {
      const userData = createTestUserData({
        firstName: '  John  ',
        lastName: '  Doe  ',
      });

      const res = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      // Should be trimmed
      expect(res.body.user.first_name).toBe('John');
      expect(res.body.user.last_name).toBe('Doe');
    });

    it('accepts date of birth during registration', async () => {
      const userData = createTestUserData({
        dateOfBirth: '1990-05-15',
      });

      const res = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      expect(res.body.user.date_of_birth).toBe('1990-05-15T00:00:00.000Z');
    });

    it('accepts registration without date of birth (optional)', async () => {
      const userData = createTestUserData();
      // Explicitly not including dateOfBirth

      const res = await request(app)
        .post('/api/users/register')
        .send(userData)
        .expect(201);

      // date_of_birth should be null or undefined
      expect(res.body.user.date_of_birth).toBeNull();
    });

    it('rejects invalid date of birth format', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          dateOfBirth: 'not-a-date',
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects future date of birth', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const res = await request(app)
        .post('/api/users/register')
        .send({
          ...createTestUserData(),
          dateOfBirth: futureDate.toISOString().split('T')[0],
        })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('POST /api/users/login', () => {
    let registeredUser;
    let userCredentials;

    beforeEach(async () => {
      // Register a user before each login test
      userCredentials = createTestUserData();

      const registerRes = await request(app)
        .post('/api/users/register')
        .send(userCredentials)
        .expect(201);

      registeredUser = registerRes.body.user;
    });

    it('authenticates with valid credentials', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        message: 'Login successful',
        token: expect.any(String),
        user: {
          user_id: registeredUser.user_id,
          email: userCredentials.email,
          username: userCredentials.username,
        },
      });

      // Verify token is a valid JWT format (3 parts separated by dots)
      expect(res.body.token.split('.')).toHaveLength(3);

      // Verify password_hash is NOT returned
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('sets refresh token cookie on login', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: userCredentials.email,
          password: userCredentials.password,
        })
        .expect(200);

      // Check for Set-Cookie header with refresh_token
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('refresh_token='))).toBe(true);

      // Verify cookie attributes for security
      const refreshCookie = cookies.find(c => c.includes('refresh_token='));
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Strict');
    });

    it('rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: 'wrong@example.com',
          password: userCredentials.password,
        })
        .expect(401);

      expect(res.body.error).toBe('AuthenticationError');
    });

    it('rejects invalid password', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          email: userCredentials.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(res.body.error).toBe('AuthenticationError');
    });

    it('does not reveal which field is incorrect', async () => {
      // Wrong email
      const wrongEmailRes = await request(app)
        .post('/api/users/login')
        .send({
          email: 'wrong@example.com',
          password: userCredentials.password,
        })
        .expect(401);

      // Wrong password
      const wrongPasswordRes = await request(app)
        .post('/api/users/login')
        .send({
          email: userCredentials.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      // Error messages should be identical (prevent user enumeration)
      expect(wrongEmailRes.body.message).toBe(wrongPasswordRes.body.message);
    });

    it('requires email and password', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({})
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('GET /api/users/me', () => {
    let authToken;
    let userData;

    beforeEach(async () => {
      // Register and login
      userData = createTestUserData();

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

    it('returns current user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(authToken))
        .expect(200);

      expect(res.body).toMatchObject({
        user: {
          email: userData.email,
          username: userData.username,
          first_name: userData.firstName,
          last_name: userData.lastName,
        },
      });

      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('rejects requests without token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('rejects requests with invalid token format', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });
  });

  describe('PATCH /api/users/me', () => {
    let authToken;
    let userData;

    beforeEach(async () => {
      userData = createTestUserData();

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

    it('updates user profile with valid data', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(authToken))
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        message: 'Profile updated successfully',
        user: {
          first_name: 'Updated',
          last_name: 'Name',
          email: userData.email, // Unchanged
        },
      });
    });

    it('rejects update with no valid fields', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(authToken))
        .send({})
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects update without authentication', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ firstName: 'Test' })
        .expect(401);

      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('requires CSRF header for state-changing operation', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        // Missing X-Requested-With header
        .send({ firstName: 'Test' })
        .expect(403);

      expect(res.body.error).toMatch(/CSRF/i);
    });

    it('updates date of birth', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(authToken))
        .send({ dateOfBirth: '1995-03-20' })
        .expect(200);

      expect(res.body.user.date_of_birth).toBe('1995-03-20T00:00:00.000Z');
    });

    it('updates date of birth along with other fields', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(authToken))
        .send({
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1988-12-25',
        })
        .expect(200);

      expect(res.body.user.first_name).toBe('John');
      expect(res.body.user.last_name).toBe('Doe');
      expect(res.body.user.date_of_birth).toBe('1988-12-25T00:00:00.000Z');
    });

    it('rejects invalid date of birth format in update', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(authToken))
        .send({ dateOfBirth: 'invalid-date' })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects future date of birth in update', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 10);

      const res = await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(authToken))
        .send({ dateOfBirth: futureDate.toISOString().split('T')[0] })
        .expect(400);

      expect(res.body.error).toBe('ValidationError');
    });

    it('clears date of birth when set to null', async () => {
      // First set a date of birth
      await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(authToken))
        .send({ dateOfBirth: '1990-01-01' })
        .expect(200);

      // Then clear it
      const res = await request(app)
        .patch('/api/users/me')
        .set(getAuthHeaders(authToken))
        .send({ dateOfBirth: null })
        .expect(200);

      expect(res.body.user.date_of_birth).toBeNull();
    });
  });
});

describe('/api/auth - Token Management', () => {
  let refreshToken;
  let userData;

  beforeEach(async () => {
    // Setup: Register and login to get tokens
    userData = createTestUserData();

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

    refreshToken = extractRefreshToken(loginRes);
  });

  describe('POST /api/auth/refresh', () => {
    it('issues new access token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set(csrfHeader)
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(200);

      expect(res.body).toMatchObject({
        token: expect.any(String),
      });

      // New token should be a valid JWT (works for authenticated requests)
      const meRes = await request(app)
        .get('/api/users/me')
        .set(getAuthHeaders(res.body.token))
        .expect(200);
      expect(meRes.body.user).toBeDefined();
    });

    it('rotates refresh token (issues new one)', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set(csrfHeader)
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(200);

      // Should set new refresh cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const newRefreshToken = extractRefreshToken(res);
      expect(newRefreshToken).toBeDefined();
      expect(newRefreshToken).not.toBe(refreshToken);
    });

    it('rejects expired/invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set(csrfHeader)
        .set('Cookie', ['refresh_token=invalid_token'])
        .expect(401);

      expect(res.body.error).toBe('AuthenticationError');
    });

    it('rejects request without refresh cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set(csrfHeader)
        .expect(401);

      expect(res.body.error).toBe('AuthenticationError');
      expect(res.body.message).toMatch(/refresh token required/i);
    });

    it('invalidates old refresh token after rotation', async () => {
      // First refresh
      await request(app)
        .post('/api/auth/refresh')
        .set(csrfHeader)
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(200);

      // Try to use old refresh token again
      const res = await request(app)
        .post('/api/auth/refresh')
        .set(csrfHeader)
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(401);

      expect(res.body.error).toBe('AuthenticationError');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears refresh token cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set(csrfHeader)
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(200);

      expect(res.body.message).toMatch(/logged out/i);

      // Should clear the cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('refresh_token=') && c.includes('Expires='))).toBe(true);
    });

    it('invalidates refresh token in database', async () => {
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set(csrfHeader)
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(200);

      // Try to use the refresh token
      const res = await request(app)
        .post('/api/auth/refresh')
        .set(csrfHeader)
        .set('Cookie', [`refresh_token=${refreshToken}`])
        .expect(401);

      expect(res.body.error).toBe('AuthenticationError');
    });

    it('succeeds even without refresh token (idempotent)', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set(csrfHeader)
        .expect(200);

      expect(res.body.message).toMatch(/logged out/i);
    });
  });
});
