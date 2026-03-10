/**
 * User Model
 *
 * Design Decisions:
 *
 * 1. DATA MAPPER PATTERN
 *    - Static methods only, no instance state
 *    - Simple transformation between DB rows and JS objects
 *    - Keeps model layer thin, business logic goes in services
 *
 * 2. PASSWORD SECURITY
 *    - bcrypt cost factor 12 (takes ~250ms, balances security/performance)
 *    - Password hashes never returned in queries
 *    - verifyPassword method keeps comparison logic encapsulated
 *
 * 3. INPUT VALIDATION
 *    - Basic validation before DB operations
 *    - Domain-specific errors (ValidationError, NotFoundError)
 *    - Prevents cryptic PostgreSQL errors from reaching users
 *
 * 4. COLUMN NAMING
 *    - Schema uses snake_case (PostgreSQL convention)
 *    - Models map to camelCase for JavaScript consistency
 *    - Explicit column selection prevents data leakage
 */

import { query } from "../config/database.js";
import bcrypt from "bcryptjs";

/**
 * Custom error classes for domain-specific error handling
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

/**
 * User data access object
 */
export class User {
  /**
   * Bcrypt cost factor (work factor)
   * 12 rounds = ~250ms on modern hardware
   * Higher = more secure but slower
   * @type {number}
   */
  static BCRYPT_ROUNDS = 12;

  /**
   * Create a new user
   * @param {Object} userData
   * @param {string} userData.email - User's email address
   * @param {string} userData.username - Unique username
   * @param {string} userData.password - Plain text password (will be hashed)
   * @param {string} userData.firstName - First name
   * @param {string} userData.lastName - Last name
   * @param {Date} [userData.dateOfBirth] - Optional date of birth
   * @returns {Promise<Object>} Created user (without password_hash)
   * @throws {ValidationError} If required fields are missing
   */
  static async create({
    email,
    username,
    password,
    firstName,
    lastName,
    dateOfBirth,
  }) {
    // Input validation
    if (!email || !email.includes("@")) {
      throw new ValidationError("Valid email is required");
    }
    if (!username || username.length < 3) {
      throw new ValidationError("Username must be at least 3 characters");
    }
    if (!password || password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }
    if (!firstName || !lastName) {
      throw new ValidationError("First name and last name are required");
    }

    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    try {
      const result = await query(
        `INSERT INTO users (email, username, password_hash, first_name, last_name, date_of_birth)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING user_id, email, username, first_name, last_name, date_of_birth, created_at`,
        [email, username, passwordHash, firstName, lastName, dateOfBirth],
      );
      return result.rows[0];
    } catch (err) {
      // Handle unique constraint violations
      if (err.code === "23505") {
        if (err.detail?.includes("email")) {
          throw new ValidationError("Email already registered");
        }
        if (err.detail?.includes("username")) {
          throw new ValidationError("Username already taken");
        }
      }
      throw err;
    }
  }

  /**
   * Find user by email (includes password_hash for authentication)
   * @param {string} email
   * @returns {Promise<Object|null>} User with password_hash or null
   */
  static async findByEmail(email) {
    if (!email) return null;

    const result = await query(
      `SELECT user_id, email, username, password_hash, first_name, last_name, date_of_birth, created_at
       FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by username (includes password_hash for authentication)
   * @param {string} username
   * @returns {Promise<Object|null>} User with password_hash or null
   */
  static async findByUsername(username) {
    if (!username) return null;

    const result = await query(
      `SELECT user_id, email, username, password_hash, first_name, last_name, date_of_birth, created_at
       FROM users WHERE username = $1`,
      [username],
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by ID (excludes password_hash for security)
   * @param {number} userId
   * @returns {Promise<Object|null>} User without password_hash
   * @throws {ValidationError} If userId is invalid
   */
  static async findById(userId) {
    if (!userId || isNaN(parseInt(userId, 10))) {
      throw new ValidationError("Valid user ID is required");
    }

    const result = await query(
      `SELECT user_id, email, username, first_name, last_name, date_of_birth, created_at
       FROM users WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] || null;
  }

  /**
   * Verify a plain text password against a hash
   * @param {string} plainPassword - Password from user input
   * @param {string} hashedPassword - Hash from database
   * @returns {Promise<boolean>} True if password matches
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) return false;
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Update user's profile information
   * @param {number} userId
   * @param {Object} updates
   * @param {string} [updates.firstName]
   * @param {string} [updates.lastName]
   * @param {Date} [updates.dateOfBirth]
   * @returns {Promise<Object>} Updated user
   * @throws {NotFoundError} If user not found
   */
  static async update(userId, { firstName, lastName, dateOfBirth }) {
    if (!userId || isNaN(parseInt(userId, 10))) {
      throw new ValidationError("Valid user ID is required");
    }

    const result = await query(
      `UPDATE users
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           date_of_birth = COALESCE($4, date_of_birth)
       WHERE user_id = $1
       RETURNING user_id, email, username, first_name, last_name, date_of_birth, created_at`,
      [userId, firstName, lastName, dateOfBirth],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("User not found");
    }

    return result.rows[0];
  }
}

export default User;
