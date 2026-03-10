# ShelfTrack Frontend-Backend Inconsistency Analysis Report

**Generated:** 2026-03-10  
**Scope:** Full-stack code review focusing on data flow, API contracts, and UI inconsistencies  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low

---

## Executive Summary

This analysis identified **15 distinct issues** ranging from critical data flow bugs to minor naming inconsistencies. The most severe issues involve **rating display failures** (stars not appearing), **broken rating filters**, and **authentication state handling** that could lead to poor user experience.

### Critical Issues Requiring Immediate Attention
1. **Ratings always null in SearchPage** - Rating filter UI is non-functional
2. **Star ratings not displayed for books** - `BookCard` receives incorrect rating property
3. **Authentication bypass in SearchPage** - Uses raw `fetch` instead of `apiFetch`
4. **Average rating vs User rating confusion** - Backend aggregates, frontend expects individual

---

## 🔴 Critical Issues

### 1. Ratings Always Null in SearchPage (Rating Filter Non-Functional)

**Location:** `frontend/src/pages/SearchPage.jsx` (lines 72-84, 150-160)

**Problem:**
```javascript
// SearchPage.jsx - BOTH search functions set rating to null
setBooks(
  (data.books || []).map(book => ({
    // ... other fields
    rating: null,  // ← ALWAYS null regardless of source!
    source: book.source,
  }))
)
```

The `SearchPage` has a rating filter UI ("5 stars", "4 stars", etc.) that allows users to filter by minimum rating, but **every book has `rating: null`** because:
1. Local DB books have `average_rating` (aggregate from all users)
2. External API books have no rating data
3. The mapping code explicitly sets `rating: null`

**Impact:** Rating filter appears to work but actually does nothing. User confusion.

**Root Cause:** Confusion between `average_rating` (aggregate) vs `rating` (user's individual rating).

**Recommended Fix:**
```javascript
// Option A: Include average_rating for display
rating: book.average_rating ? parseFloat(book.average_rating) : null,

// Option B: Remove rating filter from search (it's only relevant for MyBooks)
// since search shows all books, not just user's rated books
```

---

### 2. Star Ratings Not Displayed in BookCard

**Location:** `frontend/src/components/BookCard.jsx` (line 59)

**Problem:**
```javascript
<StarRating rating={book.rating || 0} size={12} />
```

The `BookCard` expects `book.rating`, but different data sources provide ratings differently:

| Source | Field Name | Type | Issue |
|--------|-----------|------|-------|
| Local DB search | `average_rating` | string/number | Wrong field name |
| External search | N/A | - | No rating data |
| MyBooks shelf | `rating` | number | ✅ Correct |
| HomePage | `average_rating` | string | Wrong field name |

**Impact:** Stars don't appear on book cards from search results or homepage.

**Evidence:**
```javascript
// HomePage.jsx (line 45) - CORRECTLY maps average_rating
rating: b.average_rating ? parseFloat(b.average_rating) : 0,

// MyBooksPage.jsx (line 67) - CORRECTLY uses rating
rating: entry.rating,

// SearchPage.jsx (line 81) - WRONG: always null
rating: null,
```

**Recommended Fix:** Standardize on `averageRating` for aggregate ratings and `rating` for user ratings:
```javascript
// In SearchPage mapping:
averageRating: book.average_rating ? parseFloat(book.average_rating) : null,
rating: null, // User hasn't rated yet (anonymous)

// In BookCard.jsx:
<StarRating rating={book.averageRating || book.rating || 0} size={12} />
```

---

### 3. Authentication Bypass in SearchPage

**Location:** `frontend/src/pages/SearchPage.jsx` (lines 65, 145)

**Problem:**
```javascript
// Uses raw fetch instead of apiFetch
fetch(url)  // ← No token refresh on 401!
```

The `SearchPage` uses standard `fetch()` directly, bypassing the authentication handling in `apiFetch.js` which:
- Automatically retries on 401 with token refresh
- Handles token expiration gracefully
- Attaches Authorization headers

**Impact:** If a user's access token expires during search:
1. Request fails with 401
2. User sees "Search failed" error
3. Silent token refresh never happens
4. User must manually refresh page or re-login

**Recommended Fix:**
```javascript
// Import apiFetch
import { apiFetch } from '../utils/apiFetch';
import { useAuth } from '../context/AuthContext';

// In component:
const { accessToken } = useAuth();

// Use apiFetch for authenticated requests:
apiFetch(`/api/books/search-universal?q=${encodeURIComponent(q)}&limit=48&source=${searchSource}`, {}, accessToken)
```

**Note:** Since search is currently public (no auth required), this is lower priority. However, if auth is added to search later, this will break.

---

### 4. Average Rating vs User Rating Data Confusion

**Location:** Multiple files

**Problem:** The application conflates two different concepts:

1. **Average Rating** (`average_rating` from DB) - Aggregate of all users' ratings for a book
2. **User Rating** (`rating` from user_books) - Individual user's rating

**Backend - Book.search():**
```javascript
SELECT b.*, 
  ROUND(AVG(ub.rating)::numeric, 1) AS average_rating,  // Aggregate
  COUNT(ub.rating) AS rating_count
```

**Backend - UserBook.getUserShelf():**
```javascript
SELECT ub.rating  // Individual user's rating
```

**Frontend confusion:**
- `HomePage` shows `average_rating` (correct for browse)
- `SearchPage` shows nothing (always null)
- `MyBooksPage` shows `rating` (correct for user's books)
- `BookCard` expects `rating` but should handle both

**Impact:** Users can't see community ratings when browsing/searching.

**Recommended Fix:** Update BookCard to display both:
```jsx
// BookCard.jsx
const BookCard = ({ book, showAverage = true, ... }) => {
  const displayRating = showAverage 
    ? (book.averageRating || book.average_rating || 0)
    : (book.rating || 0);
  
  return (
    // ...
    <StarRating rating={displayRating} size={12} />
    {book.ratingCount > 0 && (
      <span className="text-xs text-gray-400">({book.ratingCount})</span>
    )}
  );
};
```

---

## 🟠 High Severity Issues

### 5. Inconsistent Book ID Handling

**Location:** Multiple pages

**Problem:** Different pages use different ID fields, causing navigation and lookup issues:

| Page | ID Field | Value | Issue |
|------|----------|-------|-------|
| `SearchPage` | `id` | `open_library_id \|\| book_id` | Inconsistent type |
| `SearchPage` | `bookId` | `book_id` | Only exists for local books |
| `MyBooksPage` | `id` | `book_id` | Always numeric |
| `MyBooksPage` | `olId` | `open_library_id` | May be null |
| `HomePage` | `id` | `open_library_id \|\| book_id` | Same as SearchPage |
| `BookDetailPage` | `olId` | From state or fetched | Depends on source |

**Evidence:**
```javascript
// SearchPage.jsx (lines 72-84)
id: book.open_library_id || book.book_id,  // String or number
bookId: book.book_id,  // Only for local

// MyBooksPage.jsx (lines 59-70)
id: entry.book_id,  // Always number
olId: entry.open_library_id,  // May be null

// BookDetailPage.jsx (line 30)
const { id } = useParams()  // From URL - could be either!
```

**Impact:** 
- URL construction inconsistent: `/bookdetail/OL123W` vs `/bookdetail/123`
- Direct URL access may fail if book isn't in local DB
- Shelf lookup by `olId` may fail for custom books

**Recommended Fix:** Use `open_library_id` as canonical URL ID:
```javascript
// Always use open_library_id for URLs when available
const urlId = book.open_library_id || `local-${book.book_id}`;
navigate(`/bookdetail/${urlId}`);

// In BookDetailPage, handle both:
const { id } = useParams();
const isLocalId = id.startsWith('local-');
const bookId = isLocalId ? parseInt(id.replace('local-', '')) : null;
const olId = isLocalId ? null : id;
```

---

### 6. Cover URL Field Name Inconsistency

**Location:** Frontend data mapping

**Problem:** Backend consistently uses `cover_url` (snake_case), but frontend mapping is inconsistent:

**Correct mappings:**
- `HomePage.jsx`: `coverUrl: b.cover_url` ✅
- `MyBooksPage.jsx`: `coverUrl: entry.cover_url` ✅

**Incorrect mappings:**
- `SearchPage.jsx`: `coverUrl: book.cover_url` ✅ (correct but could be clearer)

**BookCard.jsx** expects `book.coverUrl` (camelCase) which is correct after mapping.

**Risk:** If any mapping is missed, cover images won't display.

**Recommended Fix:** Create a shared utility function:
```javascript
// utils/bookMapper.js
export function mapBookFromAPI(book) {
  return {
    id: book.open_library_id || book.book_id,
    bookId: book.book_id,
    olId: book.open_library_id,
    title: book.title,
    author: book.author,
    coverUrl: book.cover_url,
    firstPublishYear: book.first_publish_year,
    averageRating: book.average_rating ? parseFloat(book.average_rating) : null,
    ratingCount: parseInt(book.rating_count, 10) || 0,
    source: book.source,
  };
}
```

---

### 7. Category Filter Only Works for External Search

**Location:** `frontend/src/pages/SearchPage.jsx` (line 63), `backend/src/routes/books.js`

**Problem:**
The category filter sends `subject` parameter to backend:
```javascript
const url = `${API_URL}/api/books/search-universal?q=${encodeURIComponent(q)}&limit=48&source=${searchSource}${subject ? `&subject=${subject}` : ''}`
```

But `Book.search()` (local DB) doesn't support subject filtering:
```javascript
// Book.js - search() only filters by title/author
WHERE b.title ILIKE $1 OR b.author ILIKE $1
```

**Impact:** When source is "local" or results come from local DB, category filter has no effect. Users see confusing results.

**Recommended Fix:** Either:
1. Remove category filter from UI (simplest)
2. Add subject field to books table and filter locally
3. Always use external search when category is selected

---

### 8. Rating Count Returned as String

**Location:** `backend/src/models/Book.js` (line 125)

**Problem:**
```javascript
COUNT(ub.rating) AS rating_count  // Returns as string from PostgreSQL
```

**Evidence:**
```javascript
// backend/src/routes/books.js (line 109)
rating_count: "0",  // Explicitly string!
```

**Impact:** Potential type-related bugs if frontend expects number.

**Recommended Fix:**
```javascript
// In Book.search():
COUNT(ub.rating)::int AS rating_count  // Cast to integer

// Or in route:
rating_count: parseInt(book.rating_count, 10) || 0
```

---

## 🟡 Medium Severity Issues

### 9. API_URL Fallback Inconsistency

**Location:** `frontend/src/pages/HomePage.jsx` (line 7)

**Problem:**
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
```

But `config.js` exports without fallback:
```javascript
export const API_URL = import.meta.env.VITE_API_URL
```

**Impact:** If `VITE_API_URL` is not set:
- Other pages fail (undefined URL)
- HomePage works (has fallback)

**Recommended Fix:** Add fallback to config.js:
```javascript
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

Then remove inline definition from HomePage.

---

### 10. No Error Handling for Missing Environment Variable

**Location:** `frontend/src/config.js`

**Problem:** If `VITE_API_URL` is not set, `API_URL` is `undefined`, causing requests to fail with obscure errors.

**Recommended Fix:**
```javascript
// config.js
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

if (!API_URL) {
  console.error('[CONFIG] VITE_API_URL not set! Using default.');
}
```

---

### 11. Silent Failures in MyBooksPage Stats Loading

**Location:** `frontend/src/pages/MyBooksPage.jsx` (line 49)

**Problem:**
```javascript
apiFetch('/api/user-books/stats', {}, accessToken)
  .then(data => { /* update counts */ })
  .catch(() => {}) // Silently ignores errors!
```

**Impact:** If stats fail to load, counts show 0 without any error indication.

**Recommended Fix:** At minimum, log the error:
```javascript
.catch(err => {
  console.error('[MyBooks] Failed to load stats:', err);
  // Optionally show error state
})
```

---

### 12. No Validation for Minimum Search Query Length

**Location:** `frontend/src/components/Navbar.jsx` (SearchBox)

**Problem:** The debounced search fires for any 2+ character query without validation. Could lead to:
- Unnecessary API calls for short queries
- Rate limit exhaustion

**Recommended Fix:** Add minimum length check and trim:
```javascript
const q = value.trim()
if (q.length < 3) {  // Require at least 3 characters
  setSuggestions([])
  setOpen(false)
  return
}
```

---

### 13. Review Form Shows Without Rating

**Location:** `frontend/src/pages/BookDetailPage.jsx`

**Problem:** A user can write a review without rating the book. The UI allows submitting review text with 0 stars.

**Impact:** Database schema allows null ratings, but UX is confusing - reviews without ratings seem incomplete.

**Recommended Fix:** Either:
1. Require rating when review is written
2. Show a hint that rating is recommended

---

## 🔵 Low Severity / Code Quality Issues

### 14. Inconsistent Import Style

**Location:** Multiple files

**Problem:** Mix of import styles:
```javascript
// Some files use direct import
import { API_URL } from '../config'

// Others use inline definition
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
```

**Recommended Fix:** Standardize on the config import.

---

### 15. Unused Parameter in BookDetailPage Navigation

**Location:** `frontend/src/pages/MyBooksPage.jsx` (line 104)

**Problem:**
```javascript
navigate('/bookdetail/' + urlId, {
  state: {
    book: {
      id: urlId,  // Duplicate - already in URL
      olId: book.olId,  // Duplicate of id
      // ...
    },
  },
})
```

The `id` and `olId` in state are redundant since they're in the URL.

**Impact:** Minimal - just code clarity.

**Recommended Fix:** Simplify state to only include data not in URL:
```javascript
navigate(`/bookdetail/${urlId}`, {
  state: {
    book: {
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      firstPublishYear: book.firstPublishYear,
    },
  },
})
```

---

## Summary Table

| # | Issue | Severity | File(s) | Effort | Impact |
|---|-------|----------|---------|--------|--------|
| 1 | Ratings null in SearchPage | 🔴 Critical | SearchPage.jsx | Low | High |
| 2 | Star ratings not displayed | 🔴 Critical | BookCard.jsx, SearchPage.jsx | Low | High |
| 3 | Auth bypass in SearchPage | 🔴 Critical | SearchPage.jsx | Low | Medium |
| 4 | Average vs User rating confusion | 🔴 Critical | Multiple | Medium | High |
| 5 | Inconsistent book ID handling | 🟠 High | Multiple | Medium | Medium |
| 6 | Cover URL field inconsistency | 🟠 High | Multiple | Low | Medium |
| 7 | Category filter only external | 🟠 High | SearchPage.jsx, books.js | Medium | Medium |
| 8 | Rating count as string | 🟠 High | Book.js, books.js | Low | Low |
| 9 | API_URL fallback inconsistency | 🟡 Medium | HomePage.jsx, config.js | Low | Low |
| 10 | Missing env validation | 🟡 Medium | config.js | Low | Low |
| 11 | Silent stats failures | 🟡 Medium | MyBooksPage.jsx | Low | Low |
| 12 | No min search length | 🟡 Medium | Navbar.jsx | Low | Low |
| 13 | Review without rating | 🟡 Medium | BookDetailPage.jsx | Low | Low |
| 14 | Import style inconsistency | 🔵 Low | Multiple | Low | Low |
| 15 | Unused nav state params | 🔵 Low | MyBooksPage.jsx | Low | Low |

---

## Recommended Priority Order

### Phase 1: Critical Fixes (Immediate)
1. Fix SearchPage rating mapping (Issue #1, #2)
2. Create shared book mapper utility (Issue #6)
3. Clarify average vs user rating (Issue #4)

### Phase 2: Important Fixes (This Week)
4. Fix SearchPage to use apiFetch (Issue #3)
5. Standardize book ID handling (Issue #5)
6. Fix category filter or remove (Issue #7)

### Phase 3: Polish (Next Sprint)
7. Add API_URL fallback (Issue #9)
8. Add error logging (Issue #11)
9. Code cleanup (Issues #14, #15)

---

## Appendix: Data Flow Diagrams

### Book Data Flow (Current - Broken)
```
Backend (Book.search):
  book_id, open_library_id, title, author, cover_url, 
  average_rating (string), rating_count (string)
    ↓
SearchPage mapping:
  id: open_library_id || book_id
  coverUrl: cover_url
  rating: null  ← BUG: ignores average_rating!
    ↓
BookCard:
  Shows stars based on rating (always 0)
```

### Book Data Flow (Recommended)
```
Backend:
  book_id, open_library_id, title, author, cover_url,
  average_rating (number), rating_count (number)
    ↓
Shared mapper:
  id, olId, bookId, title, author, coverUrl,
  averageRating (number), ratingCount (number)
    ↓
BookCard (showAverage=true):
  Shows stars based on averageRating
```

### User Book Data Flow (Current - Working)
```
Backend (UserBook.getUserShelf):
  user_book_id, book_id, status, rating (1-5), review, notes,
  title, author, cover_url, open_library_id
    ↓
MyBooksPage mapping:
  id: book_id
  olId: open_library_id
  rating: rating  ← Correct!
    ↓
BookCard (showAverage=false):
  Shows stars based on rating
```
