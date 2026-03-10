/**
 * UserBook Routes (Reading List/Shelf Management)
 *
 * Endpoints:
 *   POST   /api/user-books              - Add book to shelf
 *   GET    /api/user-books              - Get current user's shelf
 *   GET    /api/user-books/stats        - Get reading statistics
 *   PATCH  /api/user-books/:id/status   - Update reading status
 *   PUT    /api/user-books/:id/review   - Update review/rating/notes
 *   DELETE /api/user-books/:id          - Remove from shelf
 *
 * Design Decisions:
 *
 * 1. AUTHORIZATION
 *    - All endpoints require authentication
 *    - Users can only access their own shelf data
 *    - Route handlers use req.user.user_id (from JWT) not URL params
 *    - Model layer enforces ownership in SQL queries
 *
 * 2. IDEMPOTENT ADDITIONS
 *    - Adding same book twice updates existing record
 *    - Preserves notes/review while updating status
 *    - Better UX than "already on shelf" errors
 *
 * 3. PARTIAL UPDATES
 *    - PATCH /status only updates status
 *    - PUT /review updates rating/review/notes (any combination)
 *    - COALESCE in SQL preserves existing values for omitted fields
 *
 * 4. RESPONSE FORMAT
 *    - All endpoints return full user_book record with book details
 *    - Joined data prevents N+1 query problems in frontend
 *    - Consistent response shape across endpoints
 */

import { Router } from "express";
import { UserBook } from "../models/UserBook.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody, schemas } from "../middleware/validate.js";

const router = Router();

// All routes in this file require authentication
router.use(authenticate);

/**
 * POST /api/user-books
 * Add a book to the current user's shelf
 */
router.post(
  "/",
  validateBody(schemas.userBook.addToShelf),
  async (req, res, next) => {
    try {
      const userId = req.user.user_id;
      const { bookId, status, rating, review, notes } = req.body;

      const entry = await UserBook.addToShelf({
        userId,
        bookId,
        status,
        rating,
        review,
        notes,
      });

      res.status(201).json({
        message: "Book added to shelf",
        entry,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/user-books?status=reading&limit=50&offset=0
 * Get current user's bookshelf
 */
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { status, limit = 50, offset = 0 } = req.query;

    // Validate status if provided
    if (status && !UserBook.VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: "ValidationError",
        message: `Status must be one of: ${UserBook.VALID_STATUSES.join(", ")}`,
      });
    }

    const shelf = await UserBook.getUserShelf(userId, status || null, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.json({
      userId,
      status: status || "all",
      count: shelf.length,
      shelf,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user-books/stats
 * Get reading statistics for current user
 */
router.get("/stats", async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const stats = await UserBook.getStats(userId);

    res.json({
      userId,
      stats: {
        wantToRead: parseInt(stats.want_to_read_count, 10) || 0,
        reading: parseInt(stats.reading_count, 10) || 0,
        read: parseInt(stats.read_count, 10) || 0,
        total: parseInt(stats.total_count, 10) || 0,
        averageRating: stats.average_rating
          ? parseFloat(stats.average_rating).toFixed(2)
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user-books/by-ol/:olId
 * Get the current user's shelf entry for a book by its Open Library ID
 */
router.get("/by-ol/:olId", async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { olId } = req.params;

    const entry = await UserBook.findByOpenLibraryId(userId, olId);

    if (!entry) {
      return res.status(404).json({
        error: "NotFoundError",
        message: "Book not on your shelf",
      });
    }

    res.json({ entry });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/user-books/:id/status
 * Update reading status for a shelf entry
 */
router.patch(
  "/:id/status",
  validateBody(schemas.userBook.updateStatus),
  async (req, res, next) => {
    try {
      const userId = req.user.user_id;
      const userBookId = parseInt(req.params.id, 10);
      const { status } = req.body;

      if (isNaN(userBookId)) {
        return res.status(400).json({
          error: "ValidationError",
          message: "Invalid user book ID",
        });
      }

      const updated = await UserBook.updateStatus(userBookId, userId, status);

      res.json({
        message: "Status updated successfully",
        entry: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/user-books/:id/review
 * Update review, rating, and/or notes for a shelf entry
 */
router.put(
  "/:id/review",
  validateBody(schemas.userBook.updateReview),
  async (req, res, next) => {
    try {
      const userId = req.user.user_id;
      const userBookId = parseInt(req.params.id, 10);
      const { rating, review, notes } = req.body;

      if (isNaN(userBookId)) {
        return res.status(400).json({
          error: "ValidationError",
          message: "Invalid user book ID",
        });
      }

      // Require at least one field to update
      if (rating === undefined && review === undefined && notes === undefined) {
        return res.status(400).json({
          error: "ValidationError",
          message: "At least one of rating, review, or notes is required",
        });
      }

      const updated = await UserBook.updateReview(userBookId, userId, {
        rating,
        review,
        notes,
      });

      res.json({
        message: "Review updated successfully",
        entry: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/user-books/:id
 * Remove a book from the current user's shelf
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const userBookId = parseInt(req.params.id, 10);

    if (isNaN(userBookId)) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Invalid user book ID",
      });
    }

    const removed = await UserBook.remove(userBookId, userId);

    res.json({
      message: "Book removed from shelf",
      entry: removed,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
