/**
 * User Routes
 *
 * Endpoints:
 *   POST /api/users/register - Create new account
 *   POST /api/users/login    - Authenticate and get token
 *   GET  /api/users/me       - Get current user profile (auth required)
 *   PATCH /api/users/me      - Update current user profile (auth required)
 *
 * Design Decisions:
 *
 * 1. PASSWORD HANDLING
 *    - Never return password_hash in responses
 *    - Login returns JWT token, not user data
 *    - Token contains only user_id (minimal payload)
 *
 * 2. AUTHENTICATION FLOW
 *    - Register -> returns user data (immediate feedback)
 *    - Login -> returns JWT token (client stores for subsequent requests)
 *    - /me endpoints -> require valid token, return fresh user data
 *
 * 3. ERROR HANDLING
 *    - 400 for validation errors (client fixable)
 *    - 401 for authentication failures (bad credentials)
 *    - 409 for duplicate email/username (conflict)
 *
 * 4. SECURITY
 *    - Rate limiting recommended on register/login (implement at app level)
 *    - Generic error messages for login failures (prevent user enumeration)
 */

import { Router } from "express";
import { User } from "../models/User.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { authenticate, generateToken } from "../middleware/auth.js";
import { validateBody, schemas } from "../middleware/validate.js";

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const router = Router();

/**
 * POST /api/users/register
 * Create a new user account
 */
router.post(
  "/register",
  validateBody(schemas.user.register),
  async (req, res, next) => {
    try {
      const { email, username, password, firstName, lastName, dateOfBirth } =
        req.body;

      // Check for existing email and username
      const existingEmail = await User.findByEmail(email);
      const existingUsername = await User.findByUsername(username);
      
      if (existingEmail || existingUsername) {
        // Generic error message to prevent user enumeration attacks
        // We don't reveal whether email or username exists
        return res.status(409).json({
          error: "ConflictError",
          message: "Registration failed. Please try different credentials.",
        });
      }

      // Create user
      const user = await User.create({
        email,
        username,
        password,
        firstName,
        lastName,
        dateOfBirth: dateOfBirth || null,
      });

      res.status(201).json({
        message: "User registered successfully",
        user,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/users/login
 * Authenticate user and return JWT access token + set httpOnly refresh cookie
 */
router.post(
  "/login",
  validateBody(schemas.user.login),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Find user by email (includes password_hash)
      const user = await User.findByEmail(email);

      // Verify password
      if (!user || !(await User.verifyPassword(password, user.password_hash))) {
        // Generic error message to prevent user enumeration attacks
        return res.status(401).json({
          error: "AuthenticationError",
          message: "Invalid email or password",
        });
      }

      // Generate 15-min access token
      const accessToken = generateToken(user);

      // Generate refresh token and store hash in DB
      const { rawToken, expiresAt } = await RefreshToken.create(user.user_id, 7);

      // Set httpOnly refresh cookie
      res.cookie(REFRESH_COOKIE_NAME, rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/refresh",
        maxAge: REFRESH_COOKIE_MAX_AGE,
        expires: expiresAt,
      });

      // Return access token and user data (without password_hash)
      // eslint-disable-next-line no-unused-vars
      const { password_hash, ...userWithoutPassword } = user;

      res.json({
        message: "Login successful",
        token: accessToken,
        user: userWithoutPassword,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/users/me
 * Get current authenticated user's profile
 */
router.get("/me", authenticate, async (req, res, next) => {
  try {
    // req.user is attached by authenticate middleware
    // Return fresh data from database
    const user = await User.findById(req.user.user_id);

    if (!user) {
      return res.status(404).json({
        error: "NotFoundError",
        message: "User not found",
      });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/users/me
 * Update current user's profile
 */
router.patch("/me", authenticate, async (req, res, next) => {
  try {
    const { firstName, lastName, dateOfBirth } = req.body;

    // Only allow updating specific fields
    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "No valid fields to update",
      });
    }

    const user = await User.update(req.user.user_id, updates);

    res.json({
      message: "Profile updated successfully",
      user,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
