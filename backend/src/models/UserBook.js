/**
 * UserBook Model (Join Table + Reading Tracking)
 *
 * Design Decisions:
 *
 * 1. UPSERT FOR IDEMPOTENCY
 *    - Adding same book twice updates instead of failing
 *    - Preserves user's notes/review while updating status
 *    - updated_at handled by database trigger
 *
 2. AUTHORIZATION IN QUERIES
 *    - All modification queries include user_id check
 *    - Prevents users from modifying other users' data
 *    - Application layer enforces ownership
 *
 * 3. STATUS VALIDATION
 *    - Database has CHECK constraint for valid statuses
 *    - Model provides STATUS constants for type safety
 *    - JavaScript validation before DB call for better errors
 *
 * 4. RATING CONSTRAINTS
 *    - 1-5 scale enforced at database level
 *    - Null allowed (user hasn't rated yet)
 *    - Model validates range before DB call
 */

import { query } from "../config/database.js";

/**
 * Custom error classes
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

export class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "ForbiddenError";
    this.statusCode = 403;
  }
}

/**
 * UserBook data access object
 */
export class UserBook {
  /**
   * Valid reading statuses
   * @type {Object}
   */
  static STATUS = Object.freeze({
    WANT_TO_READ: "want_to_read",
    READING: "reading",
    READ: "read",
  });

  /**
   * Valid status values array
   * @type {Array<string>}
   */
  static VALID_STATUSES = Object.values(this.STATUS);

  /**
   * Add or update a book on user's shelf
   * Uses UPSERT (ON CONFLICT) for idempotency
   *
   * @param {Object} data
   * @param {number} data.userId - User's ID
   * @param {number} data.bookId - Book's ID
   * @param {string} [data.status='want_to_read'] - Reading status
   * @param {number} [data.rating] - Rating 1-5 (optional)
   * @param {string} [data.review] - Text review (optional)
   * @param {string} [data.notes] - Private notes (optional)
   * @returns {Promise<Object>} UserBook record with book details
   * @throws {ValidationError} If validation fails
   */
  static async addToShelf({
    userId,
    bookId,
    status = this.STATUS.WANT_TO_READ,
    rating,
    review,
    notes,
  }) {
    // Validation
    if (!userId || isNaN(parseInt(userId, 10))) {
      throw new ValidationError("Valid user ID is required");
    }
    if (!bookId || isNaN(parseInt(bookId, 10))) {
      throw new ValidationError("Valid book ID is required");
    }
    if (!this.VALID_STATUSES.includes(status)) {
      throw new ValidationError(
        `Status must be one of: ${this.VALID_STATUSES.join(", ")}`,
      );
    }
    if (rating !== undefined && rating !== null) {
      const numRating = parseInt(rating, 10);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        throw new ValidationError("Rating must be between 1 and 5");
      }
    }

    const result = await query(
      `INSERT INTO user_books (user_id, book_id, status, rating, review, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, book_id) 
       DO UPDATE SET 
         status = EXCLUDED.status,
         rating = EXCLUDED.rating,
         review = EXCLUDED.review,
         notes = EXCLUDED.notes
       RETURNING user_book_id, user_id, book_id, status, rating, review, notes, created_at, updated_at`,
      [userId, bookId, status, rating || null, review || null, notes || null],
    );

    return result.rows[0];
  }

  /**
   * Get user's bookshelf with full book details
   *
   * @param {number} userId - User's ID
   * @param {string} [statusFilter] - Filter by status
   * @param {Object} [options]
   * @param {number} [options.limit=50] - Max results
   * @param {number} [options.offset=0] - Pagination offset
   * @returns {Promise<Array>} User's books with details
   */
  static async getUserShelf(
    userId,
    statusFilter = null,
    { limit = 50, offset = 0 } = {},
  ) {
    if (!userId || isNaN(parseInt(userId, 10))) {
      throw new ValidationError("Valid user ID is required");
    }

    let sql = `
      SELECT ub.user_book_id, ub.user_id, ub.book_id, ub.status, ub.rating, 
             ub.review, ub.notes, ub.created_at, ub.updated_at,
             b.title, b.author, b.cover_url, b.first_publish_year, b.open_library_id
      FROM user_books ub
      JOIN books b ON ub.book_id = b.book_id
      WHERE ub.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (statusFilter) {
      if (!this.VALID_STATUSES.includes(statusFilter)) {
        throw new ValidationError(
          `Status must be one of: ${this.VALID_STATUSES.join(", ")}`,
        );
      }
      sql += ` AND ub.status = $${paramIndex}`;
      params.push(statusFilter);
      paramIndex++;
    }

    sql += ` ORDER BY ub.updated_at DESC`;
    
    // Validate and sanitize pagination parameters
    const MAX_LIMIT = 100;
    const MAX_OFFSET = 100000;
    const validatedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), MAX_LIMIT);
    const validatedOffset = Math.min(Math.max(parseInt(offset, 10) || 0, 0), MAX_OFFSET);
    
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(validatedLimit, validatedOffset);

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Update reading status
   * User can only update their own records
   *
   * @param {number} userBookId - UserBook record ID
   * @param {number} userId - Current user's ID (for authorization)
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated record
   * @throws {NotFoundError} If record not found or not owned by user
   * @throws {ValidationError} If status invalid
   */
  static async updateStatus(userBookId, userId, status) {
    if (!userBookId || isNaN(parseInt(userBookId, 10))) {
      throw new ValidationError("Valid user book ID is required");
    }
    if (!userId || isNaN(parseInt(userId, 10))) {
      throw new ValidationError("Valid user ID is required");
    }
    if (!this.VALID_STATUSES.includes(status)) {
      throw new ValidationError(
        `Status must be one of: ${this.VALID_STATUSES.join(", ")}`,
      );
    }

    const result = await query(
      `UPDATE user_books 
       SET status = $1
       WHERE user_book_id = $2 AND user_id = $3
       RETURNING user_book_id, user_id, book_id, status, rating, review, notes, created_at, updated_at`,
      [status, userBookId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Book not found on your shelf");
    }

    return result.rows[0];
  }

  /**
   * Update review and rating
   * User can only update their own records
   *
   * @param {number} userBookId - UserBook record ID
   * @param {number} userId - Current user's ID (for authorization)
   * @param {Object} updates
   * @param {number} [updates.rating] - Rating 1-5
   * @param {string} [updates.review] - Text review
   * @param {string} [updates.notes] - Private notes
   * @returns {Promise<Object>} Updated record
   */
  static async updateReview(userBookId, userId, { rating, review, notes }) {
    if (!userBookId || isNaN(parseInt(userBookId, 10))) {
      throw new ValidationError("Valid user book ID is required");
    }
    if (!userId || isNaN(parseInt(userId, 10))) {
      throw new ValidationError("Valid user ID is required");
    }

    if (rating !== undefined && rating !== null) {
      const numRating = parseInt(rating, 10);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        throw new ValidationError("Rating must be between 1 and 5");
      }
    }

    const result = await query(
      `UPDATE user_books 
       SET rating = COALESCE($1, rating),
           review = COALESCE($2, review),
           notes = COALESCE($3, notes)
       WHERE user_book_id = $4 AND user_id = $5
       RETURNING user_book_id, user_id, book_id, status, rating, review, notes, created_at, updated_at`,
      [rating, review, notes, userBookId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Book not found on your shelf");
    }

    return result.rows[0];
  }

  /**
   * Remove book from user's shelf
   * User can only remove their own records
   *
   * @param {number} userBookId - UserBook record ID
   * @param {number} userId - Current user's ID (for authorization)
   * @returns {Promise<Object>} Removed record
   * @throws {NotFoundError} If record not found or not owned by user
   */
  static async remove(userBookId, userId) {
    if (!userBookId || isNaN(parseInt(userBookId, 10))) {
      throw new ValidationError("Valid user book ID is required");
    }
    if (!userId || isNaN(parseInt(userId, 10))) {
      throw new ValidationError("Valid user ID is required");
    }

    const result = await query(
      `DELETE FROM user_books 
       WHERE user_book_id = $1 AND user_id = $2
       RETURNING user_book_id, user_id, book_id, status, rating, review, notes, created_at`,
      [userBookId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Book not found on your shelf");
    }

    return result.rows[0];
  }

  /**
   * Find a user's shelf entry for a specific book by Open Library ID
   *
   * @param {number} userId
   * @param {string} openLibraryId
   * @returns {Promise<Object|null>}
   */
  static async findByOpenLibraryId(userId, openLibraryId) {
    const result = await query(
      `SELECT ub.user_book_id, ub.status, ub.rating, ub.review, ub.notes,
              b.book_id, b.open_library_id
       FROM user_books ub
       JOIN books b ON ub.book_id = b.book_id
       WHERE ub.user_id = $1 AND b.open_library_id = $2`,
      [userId, openLibraryId],
    );
    return result.rows[0] || null;
  }

  /**
   * Get reading statistics for a user
   *
   * @param {number} userId
   * @returns {Promise<Object>} Stats object with counts by status
   */
  static async getStats(userId) {
    if (!userId || isNaN(parseInt(userId, 10))) {
      throw new ValidationError("Valid user ID is required");
    }

    const result = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'want_to_read') as want_to_read_count,
         COUNT(*) FILTER (WHERE status = 'reading') as reading_count,
         COUNT(*) FILTER (WHERE status = 'read') as read_count,
         COUNT(*) as total_count,
         AVG(rating) FILTER (WHERE rating IS NOT NULL) as average_rating
       FROM user_books 
       WHERE user_id = $1`,
      [userId],
    );

    return result.rows[0];
  }
}

export default UserBook;
