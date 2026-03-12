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
import rateLimit from "express-rate-limit";
import { Book } from "../models/Book.js";
import { validateBody, schemas } from "../middleware/validate.js";
import { shouldSkip } from "../middleware/rateLimit.js";

const router = Router();

/**
 * Rate limiter for book creation
 * Prevents spam/book pollution attacks
 */
const bookCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 books per hour per IP
  skip: shouldSkip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "RateLimitError",
      message: "Book creation limit exceeded. Maximum 50 books per hour."
    });
  }
});

/**
 * POST /api/books
 * Create or update a book
 * Uses upsert pattern for Open Library ID conflicts
 */
router.post("/", bookCreateLimiter, validateBody(schemas.book.create), async (req, res, next) => {
  try {
    const book = await Book.create(req.body);

    // xmax = 0 for new inserts, non-zero for updates (PostgreSQL system column trick)
    const isNew = book.inserted === true;

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
 * GET /api/books/search?q=query&limit=20&subject=fiction
 * Search books: DB results first (with avg ratings), then supplement with OpenLibrary API.
 * Subject filter is forwarded to OpenLibrary; DB results are always by title/author only.
 */
router.get("/search", async (req, res, next) => {
  try {
    const { q, limit = 20, subject } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Search query parameter 'q' is required",
      });
    }

    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

    // 1. Search local DB (includes average_rating aggregated from user_books)
    const dbBooks = await Book.search(q, { limit: limitNum });
    const dbOlIds = new Set(dbBooks.filter(b => b.open_library_id).map(b => b.open_library_id));

    // 2. Fetch from OpenLibrary API to supplement DB results
    let olBooks = [];
    try {
      const olUrl = new URL("https://openlibrary.org/search.json");
      olUrl.searchParams.set("q", q);
      olUrl.searchParams.set("limit", String(limitNum));
      olUrl.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i");
      if (subject) olUrl.searchParams.set("subject", subject);

      const olRes = await fetch(olUrl.toString());
      if (olRes.ok) {
        const olData = await olRes.json();
        olBooks = (olData.docs || [])
          .filter(doc => {
            const olId = doc.key?.split("/").pop();
            return olId && !dbOlIds.has(olId);
          })
          .map(doc => ({
            open_library_id: doc.key.split("/").pop(),
            title: doc.title || "Unknown Title",
            author: doc.author_name?.[0] || "Unknown Author",
            cover_url: doc.cover_i
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
              : null,
            first_publish_year: doc.first_publish_year || null,
            average_rating: null,
            rating_count: 0,
            source: "api",
          }));
      }
    } catch {
      // OL fetch failed — return DB results only
    }

    const combined = [
      ...dbBooks.map(b => ({ ...b, source: "db" })),
      ...olBooks,
    ];

    res.json({
      query: q,
      count: combined.length,
      books: combined,
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

    // Validate search term
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Search query parameter 'q' is required",
      });
    }
    
    // Search term length limit
    const MAX_SEARCH_LENGTH = 200;
    if (q.length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        error: "ValidationError",
        message: `Search query too long (max ${MAX_SEARCH_LENGTH} characters)`,
      });
    }
    
    // Block potential injection patterns
    const blockedPattern = /[<>"'%;()&+\r\n\x00]/;
    if (blockedPattern.test(q)) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Invalid characters in search query",
      });
    }
    
    // Validate subject if provided
    if (subject && (subject.length > 100 || blockedPattern.test(subject))) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Invalid subject filter",
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

    // Cap limit at 50 and validate offset
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const parsedOffset = Math.min(Math.max(parseInt(offset, 10) || 0, 0), 10000);

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
