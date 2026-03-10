/**
 * Book Routes
 *
 * Endpoints:
 *   POST /api/books          - Create or update a book (upsert by open_library_id)
 *   GET  /api/books/search   - Search books by title/author
 *   GET  /api/books/:id      - Get book by ID
 *   GET  /api/books/ol/:openLibraryId - Get book by Open Library ID
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
            rating_count: "0",
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
