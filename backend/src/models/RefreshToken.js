/**
 * Refresh Token Model
 *
 * Handles storage and validation of refresh tokens for secure token rotation.
 * Tokens are stored as SHA-256 hashes (never raw tokens in DB).
 */

import crypto from "crypto";
import { query } from "../config/database.js";

/**
 * Hash a token using SHA-256
 * @param {string} token - Raw token
 * @returns {string} SHA-256 hash
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a random refresh token
 * @returns {string} 64-byte hex string
 */
function generateRawToken() {
  return crypto.randomBytes(64).toString("hex");
}

export class RefreshToken {
  /**
   * Create a new refresh token for a user
   * @param {number} userId - User ID
   * @param {number} expiresInDays - Token lifetime in days (default: 7)
   * @returns {Promise<{rawToken: string, expiresAt: Date}>} Raw token (for cookie) and expiry
   */
  static async create(userId, expiresInDays = 7) {
    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    return { rawToken, expiresAt };
  }

  /**
   * Find a token by its hash and verify it's valid
   * @param {string} rawToken - Raw token from cookie
   * @returns {Promise<Object|null>} Token record or null if invalid/expired
   */
  static async findValid(rawToken) {
    const tokenHash = hashToken(rawToken);
    const result = await query(
      `SELECT * FROM refresh_tokens 
       WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  /**
   * Rotate a refresh token (create new, delete old)
   * @param {string} oldRawToken - Current raw token
   * @param {number} userId - User ID
   * @param {number} expiresInDays - New token lifetime
   * @returns {Promise<{rawToken: string, expiresAt: Date}>} New token
   */
  static async rotate(oldRawToken, userId, expiresInDays = 7) {
    const oldTokenHash = hashToken(oldRawToken);
    
    // Delete old token
    await query(
      `DELETE FROM refresh_tokens WHERE token_hash = $1`,
      [oldTokenHash]
    );

    // Create new token
    return this.create(userId, expiresInDays);
  }

  /**
   * Delete a token (logout)
   * @param {string} rawToken - Raw token from cookie
   * @returns {Promise<void>}
   */
  static async delete(rawToken) {
    const tokenHash = hashToken(rawToken);
    await query(
      `DELETE FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
  }

  /**
   * Delete all tokens for a user (e.g., password change, security breach)
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  static async deleteAllForUser(userId) {
    await query(
      `DELETE FROM refresh_tokens WHERE user_id = $1`,
      [userId]
    );
  }
}
