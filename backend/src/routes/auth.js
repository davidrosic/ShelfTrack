/**
 * Auth Routes
 *
 * Endpoints for token refresh and logout
 *   POST /api/auth/refresh - Get new access token using refresh cookie
 *   POST /api/auth/logout  - Invalidate refresh token and clear cookie
 */

import { Router } from "express";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { generateToken } from "../middleware/auth.js";

const router = Router();

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * POST /api/auth/refresh
 * Issue new access token using valid refresh cookie
 * Implements token rotation for security
 */
router.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return res.status(401).json({
        error: "AuthenticationError",
        message: "Refresh token required",
      });
    }

    // Validate refresh token
    const tokenRecord = await RefreshToken.findValid(refreshToken);
    if (!tokenRecord) {
      // Clear invalid cookie
      res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth/refresh" });
      return res.status(401).json({
        error: "AuthenticationError",
        message: "Invalid or expired refresh token",
      });
    }

    // Get user
    const user = await User.findById(tokenRecord.user_id);
    if (!user) {
      // User was deleted but token still exists
      await RefreshToken.delete(refreshToken);
      res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth/refresh" });
      return res.status(401).json({
        error: "AuthenticationError",
        message: "User not found",
      });
    }

    // Rotate refresh token (security best practice)
    const { rawToken: newRefreshToken, expiresAt } = await RefreshToken.rotate(
      refreshToken,
      user.user_id,
      7
    );

    // Set new refresh cookie
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: REFRESH_COOKIE_MAX_AGE,
      expires: expiresAt,
    });

    // Issue new access token
    const accessToken = generateToken(user);

    res.json({
      token: accessToken,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Invalidate refresh token and clear cookie
 */
router.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      // Delete token from database (ignore errors)
      await RefreshToken.delete(refreshToken).catch(() => {
        // Token might not exist, that's fine
      });
    }

    // Clear cookie regardless of whether token was valid
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth/refresh" });

    res.json({
      message: "Logged out successfully",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
