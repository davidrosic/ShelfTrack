/**
 * Book Mapper Utility
 * 
 * Centralizes book data mapping between backend API responses and frontend components.
 * Ensures consistent property naming and type conversion across all pages.
 */

/**
 * Maps a book from the backend API to the frontend format
 * @param {Object} book - Raw book data from backend
 * @returns {Object} Normalized book object for frontend use
 */
export function mapBookFromAPI(book) {
  if (!book) return null;

  return {
    // IDs
    id: book.open_library_id || String(book.book_id),
    bookId: book.book_id,                    // Local database ID (null for external)
    openLibraryId: book.open_library_id,      // Open Library ID (null for custom books)
    
    // Basic info
    title: book.title || 'Unknown Title',
    author: book.author || 'Unknown Author',
    coverUrl: book.cover_url,
    firstPublishYear: book.first_publish_year || null,
    
    // Ratings (average = community aggregate, rating = user's personal)
    averageRating: book.average_rating ? parseFloat(book.average_rating) : null,
    ratingCount: parseInt(book.rating_count, 10) || 0,
    rating: book.rating || null,              // User's personal rating (from user_books)
    
    // Source indicator
    source: book.source,                      // 'local', 'external', 'mixed', 'db', 'api'
    
    // User book specific fields (when from user-books endpoint)
    userBookId: book.user_book_id,
    status: book.status,                      // 'want_to_read', 'reading', 'read'
    review: book.review,
    notes: book.notes,
  };
}

/**
 * Maps an array of books from the backend API
 * @param {Array} books - Array of raw book data
 * @returns {Array} Array of normalized book objects
 */
export function mapBooksFromAPI(books) {
  if (!Array.isArray(books)) return [];
  return books.map(mapBookFromAPI);
}

/**
 * Maps book data for navigation state (BookDetailPage)
 * Only includes fields needed for the detail page initial render
 * @param {Object} book - Frontend book object
 * @returns {Object} Minimal book data for navigation state
 */
export function mapBookForNavigation(book) {
  if (!book) return null;

  return {
    id: book.openLibraryId || String(book.bookId),
    openLibraryId: book.openLibraryId,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl,
    firstPublishYear: book.firstPublishYear,
  };
}

/**
 * Gets the URL-compatible ID for a book
 * @param {Object} book - Frontend book object
 * @returns {string} ID suitable for URL
 */
export function getBookUrlId(book) {
  if (!book) return '';
  return book.openLibraryId || String(book.bookId);
}
