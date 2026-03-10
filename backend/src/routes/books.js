/**
 * Book Routes
 *
 * Endpoints:
 *   POST /api/books                    - Create or update a book (upsert by open_library_id)
 *   GET  /api/books/search             - Search books by title/author (local DB only)
 *   GET  /api/books/search-universal   - Search local DB + Open Library API
 *   GET  /api/books/:id                - Get book by ID
 *   GET  /api/books/ol/:openLibraryId  - Get book by Open Library ID
 *
 * Design Decisions:
 *
 * 1. UPSERT BEHAVIOR
 *    - POST /books creates or updates based on open_library_id
 *    - Prevents duplicate Open Library entries
 *    - Updates existing records with fresh API data
 *
 * 2. SEARCH STRATEGY
 *    - Query parameter 'q' for search term
 *    - Case-insensitive partial matching on title and author
 *    - Optional 'limit' parameter (default 20, max 100)
 *
 * 3. ID LOOKUP
 *    - Internal ID lookup at /:id (numeric)
 *    - Open Library ID lookup at /ol/:openLibraryId (string prefix like "OL123W")
 *
 * 4. AUTHORIZATION
 *    - Book creation is public (anyone can add books from Open Library)
 *    - No authentication required for search/read operations
 */

import { Router } from "express";
import { Book } from "../models/Book.js";
import { validateBody, schemas } from "../middleware/validate.js";

const router = Router();

/**
 * POST /api/books
 * Create or update a book
 * Uses upsert pattern for Open Library ID conflicts
 */
router.post("/", validateBody(schemas.book.create), async (req, res, next) => {
  try {
    const book = await Book.create(req.body);

    // Determine if this was a create or update based on created_at vs updated_at
    const isNew = book.created_at === book.updated_at;

    res.status(isNew ? 201 : 200).json({
      message: isNew
        ? "Book created successfully"
        : "Book updated successfully",
      book,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/books/search?q=query&limit=20
 * Search books by title or author
 */
router.get("/search", async (req, res, next) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Search query parameter 'q' is required",
      });
    }

    const books = await Book.search(q, { limit: parseInt(limit, 10) || 20 });

    res.json({
      query: q,
      count: books.length,
      books,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/books/search-universal?q=query&limit=20&source=auto&offset=0
 * Universal search combining local database and Open Library API
 * 
 * Query Parameters:
 *   - q: Search term (required)
 *   - limit: Max results (default 20, max 50)
 *   - source: 'local' | 'external' | 'auto' (default 'auto')
 *     - 'local': Only search local database
 *     - 'external': Only search Open Library API
 *     - 'auto': Search local first, supplement with external if needed
 *   - offset: Pagination offset for external search (default 0)
 *   - subject: Optional subject filter (e.g., 'fiction', 'history')
 */
router.get("/search-universal", async (req, res, next) => {
  try {
    const { 
      q, 
      limit = 20, 
      source = 'auto',
      offset = 0,
      subject = null 
    } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Search query parameter 'q' is required",
      });
    }

    // Validate source parameter
    const validSources = ['local', 'external', 'auto'];
    if (!validSources.includes(source)) {
      return res.status(400).json({
        error: "ValidationError",
        message: `Source must be one of: ${validSources.join(', ')}`,
      });
    }

    // Cap limit at 50
    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 50);
    const parsedOffset = parseInt(offset, 10) || 0;

    const result = await Book.searchUniversal(q, {
      limit: parsedLimit,
      source,
      offset: parsedOffset,
      subject,
    });

    res.json({
      query: q,
      source: result.source,
      count: result.books.length,
      hasMore: result.hasMore,
      books: result.books,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/books/:id
 * Get book by internal ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    if (isNaN(bookId)) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Book ID must be a number",
      });
    }

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({
        error: "NotFoundError",
        message: "Book not found",
      });
    }

    res.json({ book });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/books/ol/:openLibraryId
 * Get book by Open Library ID
 */
router.get("/ol/:openLibraryId", async (req, res, next) => {
  try {
    const { openLibraryId } = req.params;

    if (!openLibraryId || openLibraryId.trim().length === 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Open Library ID is required",
      });
    }

    const book = await Book.findByOpenLibraryId(openLibraryId);

    if (!book) {
      return res.status(404).json({
        error: "NotFoundError",
        message: "Book not found",
      });
    }

    res.json({ book });
  } catch (err) {
    next(err);
  }
});

export default router;
