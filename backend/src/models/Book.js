/**
 * Book Model
 *
 * Design Decisions:
 *
 * 1. UPSERT PATTERN
 *    - ON CONFLICT for open_library_id prevents duplicate API books
 *    - Updates existing records with fresh data from Open Library
 *    - Custom books (is_custom=true) have null open_library_id
 *
 * 2. SEARCH STRATEGY
 *    - ILIKE for case-insensitive PostgreSQL search
 *    - % wildcards added by model, not caller (prevents SQL injection)
 *    - Simple pattern: OR across title/author, sorted by title
 *
 * 3. DATA NORMALIZATION
 *    - Open Library IDs are strings (can contain prefixes like "OL123W")
 *    - first_publish_year stored as INTEGER (not DATE, just the year)
 *    - cover_url is full URL to cover image
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

/**
 * Book data access object
 */
export class Book {
  /**
   * Create or update a book
   * Uses UPSERT to handle Open Library ID conflicts
   *
   * @param {Object} bookData
   * @param {string} [bookData.openLibraryId] - Open Library work ID (null for custom)
   * @param {string} bookData.title - Book title
   * @param {string} bookData.author - Author name
   * @param {string} [bookData.coverUrl] - URL to cover image
   * @param {number} [bookData.firstPublishYear] - Publication year
   * @param {boolean} [bookData.isCustom=false] - True if user-created
   * @returns {Promise<Object>} Created/updated book
   * @throws {ValidationError} If required fields missing
   */
  static async create({
    openLibraryId,
    title,
    author,
    coverUrl,
    firstPublishYear,
    isCustom = false,
  }) {
    // Validation
    if (!title || title.trim().length === 0) {
      throw new ValidationError("Title is required");
    }
    if (!author || author.trim().length === 0) {
      throw new ValidationError("Author is required");
    }

    // Custom books should not have openLibraryId
    if (isCustom && openLibraryId) {
      throw new ValidationError("Custom books cannot have an Open Library ID");
    }

    const result = await query(
      `INSERT INTO books (open_library_id, title, author, cover_url, first_publish_year, is_custom)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (open_library_id) DO UPDATE 
       SET title = $2, 
           author = $3, 
           cover_url = $4, 
           first_publish_year = $5,
           is_custom = $6
       RETURNING book_id, open_library_id, title, author, cover_url, first_publish_year, is_custom, created_at`,
      [
        openLibraryId || null,
        title.trim(),
        author.trim(),
        coverUrl || null,
        firstPublishYear || null,
        isCustom,
      ],
    );

    return result.rows[0];
  }

  /**
   * Search books by title or author
   * Case-insensitive partial matching
   *
   * @param {string} searchTerm - Search query
   * @param {Object} [options]
   * @param {number} [options.limit=20] - Max results to return
   * @returns {Promise<Array>} Matching books
   */
  static async search(searchTerm, { limit = 20 } = {}) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const term = `%${searchTerm.trim()}%`;
    const maxResults = Math.min(parseInt(limit, 10) || 20, 100); // Cap at 100

    const result = await query(
      `SELECT book_id, open_library_id, title, author, cover_url, first_publish_year, is_custom, created_at
       FROM books 
       WHERE title ILIKE $1 OR author ILIKE $1
       ORDER BY title
       LIMIT $2`,
      [term, maxResults],
    );

    return result.rows;
  }

  /**
   * Find book by Open Library ID
   * @param {string} openLibraryId - Open Library work ID
   * @returns {Promise<Object|null>} Book or null
   */
  static async findByOpenLibraryId(openLibraryId) {
    if (!openLibraryId) return null;

    const result = await query(
      `SELECT book_id, open_library_id, title, author, cover_url, first_publish_year, is_custom, created_at
       FROM books WHERE open_library_id = $1`,
      [openLibraryId],
    );

    return result.rows[0] || null;
  }

  /**
   * Find book by internal ID
   * @param {number} bookId - Internal book_id
   * @returns {Promise<Object|null>} Book or null
   */
  static async findById(bookId) {
    if (!bookId || isNaN(parseInt(bookId, 10))) return null;

    const result = await query(
      `SELECT book_id, open_library_id, title, author, cover_url, first_publish_year, is_custom, created_at
       FROM books WHERE book_id = $1`,
      [bookId],
    );

    return result.rows[0] || null;
  }

  /**
   * Get or create a book from Open Library data
   * Convenience method for API integration
   *
   * @param {Object} openLibraryData - Data from Open Library API
   * @param {string} openLibraryData.key - Open Library work key
   * @param {string} openLibraryData.title - Book title
   * @param {Array<string>} openLibraryData.author_name - Author names
   * @param {number} openLibraryData.first_publish_year - Publication year
   * @param {string} openLibraryData.cover_i - Cover image ID
   * @returns {Promise<Object>} Book record
   */
  static async getOrCreateFromOpenLibrary({
    key,
    title,
    author_name,
    first_publish_year,
    cover_i,
  }) {
    if (!key) {
      throw new ValidationError("Open Library key is required");
    }

    // Extract ID from key (e.g., "/works/OL123W" -> "OL123W")
    const openLibraryId = key.split("/").pop();

    // Build cover URL if cover ID exists
    const coverUrl = cover_i
      ? `https://covers.openlibrary.org/b/id/${cover_i}-M.jpg`
      : null;

    return this.create({
      openLibraryId,
      title: title || "Unknown Title",
      author: author_name?.[0] || "Unknown Author",
      coverUrl,
      firstPublishYear: first_publish_year,
      isCustom: false,
    });
  }
}

export default Book;
