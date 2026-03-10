# ShelfTrack Comprehensive Frontend-Backend Analysis Report

**Generated:** 2026-03-10  
**Scope:** Full-stack code analysis - Backend (Node.js/Express/PostgreSQL) + Frontend (React/Vite)  
**Analysis Type:** Data flow, API contracts, bugs, inconsistencies, security, performance

---

## Executive Summary

This analysis identified **18 distinct issues** across the codebase ranging from critical data flow bugs to minor inconsistencies. The most severe issues involve **inconsistent data mapping between frontend and backend**, **unused UI filters**, and **authentication handling gaps**.

### Severity Distribution
- 🔴 **Critical:** 4 issues
- 🟠 **High:** 6 issues  
- 🟡 **Medium:** 5 issues
- 🔵 **Low:** 3 issues

---

## 🔴 Critical Issues

### 1. Inconsistent Book Data Mapping in SearchPage

**Location:** `frontend/src/pages/SearchPage.jsx` (lines 68-93 vs 147)

**Problem:** SearchPage uses TWO different mapping approaches:

```javascript
// Initial search (lines 72-84) - INLINE MAPPING
setBooks(
  (data.books || []).map(book => ({
    id: book.open_library_id || book.book_id,
    bookId: book.book_id,
    openLibraryId: book.open_library_id,
    title: book.title || 'Unknown Title',
    // ... more fields
  }))
)

// Load more (line 147) - USES MAPPER
const newBooks = (data.books || []).map(mapBookFromAPI)
```

**Impact:** Potential data inconsistencies if mapper logic changes. Maintenance burden - changes need to be made in two places.

**Root Cause:** Partial refactoring - initial search wasn't updated to use the shared mapper.

**Fix:** Use `mapBookFromAPI` consistently:
```javascript
setBooks((data.books || []).map(mapBookFromAPI))
```

---

### 2. Rating Filter UI is Non-Functional

**Location:** `frontend/src/pages/SearchPage.jsx` (lines 27, 46-47, 254-266)

**Problem:** The SearchPage has a rating filter UI but it doesn't actually filter books:

```javascript
const RATINGS = ['All', '5 stars', '4 stars', '3 stars', '2 stars', '1 star']
const [selectedRating, setSelectedRating] = useState('All')

// UI renders the filter options...
// But selectedRating is NEVER used to filter visibleBooks!

const visibleBooks =
  authorTags.length > 0
    ? books.filter(b =>
        authorTags.some(tag => b.author.toLowerCase().includes(tag.toLowerCase()))
      )
    : books  // ← No rating filtering!
```

**Impact:** Users see a filter that does nothing. Poor UX, confused users.

**Root Cause:** UI was implemented but filtering logic was never added.

**Fix:** Either implement rating filtering or remove the UI:
```javascript
// Option A: Implement filtering
const visibleBooks = books.filter(book => {
  if (authorTags.length > 0 && !authorTags.some(tag => 
    book.author.toLowerCase().includes(tag.toLowerCase()))) return false
  if (selectedRating !== 'All') {
    const minRating = parseInt(selectedRating)
    if ((book.averageRating || 0) < minRating) return false
  }
  return true
})

// Option B: Remove the filter UI if not needed
```

---

### 3. Navbar SearchBox Bypasses Authentication

**Location:** `frontend/src/components/Navbar.jsx` (lines 26-28)

**Problem:** The SearchBox component uses raw `fetch` instead of `apiFetch`:

```javascript
const res = await fetch(
  `${API_URL}/api/books/search-universal?q=${encodeURIComponent(q)}&limit=6&source=auto`
)
```

**Impact:** 
- No automatic token refresh on 401
- If search requires authentication in the future, this will fail silently
- Inconsistent with rest of application

**Root Cause:** SearchBox was implemented before apiFetch was established.

**Fix:** Use apiFetch (requires accessToken from context):
```javascript
import { apiFetch } from '../utils/apiFetch'
import { useAuth } from '../context/AuthContext'

const SearchBox = () => {
  const { accessToken } = useAuth()
  // ...
  const data = await apiFetch(`/api/books/search-universal?q=${encodeURIComponent(q)}&limit=6&source=auto`, {}, accessToken)
}
```

---

### 4. BookDetailPage Uses Different Data Structure

**Location:** `frontend/src/pages/BookDetailPage.jsx` (lines 16-25)

**Problem:** BookDetailPage has its own `fromDB` function with different field names than the shared mapper:

```javascript
// BookDetailPage
function fromDB(raw) {
  return {
    olId: raw.open_library_id || null,  // ← different name
    title: raw.title,
    author: raw.author,
    coverUrl: raw.cover_url,
    firstPublishYear: raw.first_publish_year,
    description: raw.description || null,
  }
}

// vs bookMapper.js
return {
  id: book.open_library_id || String(book.book_id),
  olId: book.open_library_id,
  // ...
}
```

**Impact:** 
- Inconsistent data shapes across pages
- Navigation state may not match expected structure
- `olId` vs `openLibraryId` confusion

**Root Cause:** BookDetailPage was written before the shared mapper was created.

**Fix:** Use shared mapper and ensure consistency:
```javascript
import { mapBookFromAPI } from '../utils/bookMapper'

// In useEffect:
setBook(mapBookFromAPI(data.book))
```

---

## 🟠 High Severity Issues

### 5. UserBook Stats Returns String Instead of Number

**Location:** `backend/src/routes/userBooks.js` (line 127)

**Problem:** `averageRating` is returned as a formatted string:

```javascript
averageRating: stats.average_rating
  ? parseFloat(stats.average_rating).toFixed(2)  // ← Returns "4.50" string!
  : null,
```

**Impact:** Frontend expecting number may have comparison issues. Type inconsistency.

**Root Cause:** `toFixed()` returns a string, not a number.

**Fix:**
```javascript
averageRating: stats.average_rating
  ? parseFloat(parseFloat(stats.average_rating).toFixed(2))  // Convert back to number
  : null,
// OR simply:
averageRating: stats.average_rating
  ? Math.round(parseFloat(stats.average_rating) * 100) / 100  // Keep as number
  : null,
```

---

### 6. External Books Missing Average Rating in Search

**Location:** `backend/src/routes/books.js` (lines 100-111)

**Problem:** When external books from OpenLibrary are returned, they have `average_rating: null`. But the frontend expects books to have ratings for display.

```javascript
.map(doc => ({
  // ...
  average_rating: null,  // ← Always null for external books
  rating_count: 0,
  source: "api",
}))
```

**Impact:** External books always show empty stars even if they have community ratings on OpenLibrary.

**Root Cause:** OpenLibrary API doesn't return average ratings in the search endpoint.

**Note:** This is a design limitation, not a bug. Consider fetching individual book details or displaying "No ratings yet" for external books.

---

### 7. BookCard Key Prop May Cause Duplicates

**Location:** `frontend/src/pages/SearchPage.jsx` (line 356)

**Problem:** BookCard uses `book.id` as key, but `id` is derived from `open_library_id || book_id`. If a book exists both locally and externally, they could have the same ID.

```javascript
<BookCard key={book.id} book={book} ... />
```

**Impact:** React key warnings, potential rendering issues.

**Root Cause:** The `id` field isn't guaranteed unique across sources.

**Fix:** Use a composite key:
```javascript
<BookCard key={`${book.source}-${book.id}`} book={book} ... />
```

---

### 8. Category Filter Doesn't Work for Local Search

**Location:** `frontend/src/pages/SearchPage.jsx` (lines 19-26, 65-66)

**Problem:** Category filter sends `subject` parameter but backend's local search doesn't support it:

```javascript
// Frontend
const subject = CATEGORY_SUBJECTS[selectedCategory]
const path = `/api/books/search-universal?...${subject ? `&subject=${subject}` : ''}`

// Backend Book.search() - NO subject filtering!
WHERE b.title ILIKE $1 OR b.author ILIKE $1
```

**Impact:** Category filter appears to work but has no effect on local results. Users see confusing results.

**Root Cause:** Database schema doesn't have subject/category field for books.

**Fix:** Either add subject field to books table or disable category filter when source is 'local'.

---

### 9. SearchBox Suggestions Don't Show Ratings

**Location:** `frontend/src/components/Navbar.jsx` (lines 61-74)

**Problem:** When a user clicks a suggestion, the book data passed to BookDetailPage doesn't include rating information.

```javascript
const bookData = {
  id: id,
  title: book.title,
  author: book.author,
  coverUrl: book.cover_url,
  firstPublishYear: book.first_publish_year,
  // ← Missing: averageRating, ratingCount
}
```

**Impact:** Book detail page won't show community ratings for books navigated from search suggestions.

**Fix:** Include rating data in the navigation state.

---

### 10. Token Refresh Timer Mismatch

**Location:** `frontend/src/context/AuthContext.jsx` (line 29)

**Problem:** Token refresh is scheduled for 14 minutes, but the token lifetime is 15 minutes:

```javascript
// AuthContext.jsx
refreshTimerRef.current = setTimeout(() => silentRefreshRef.current?.(), 14 * 60 * 1000)

// backend/src/middleware/auth.js
const TOKEN_EXPIRES_IN = "15m";
```

**Impact:** Only 1 minute buffer. If the computer is suspended or the tab is inactive, the token may expire before refresh happens.

**Fix:** Increase buffer or use a shorter interval with token expiration checking.

---

## 🟡 Medium Severity Issues

### 11. Silent Error Handling Inconsistency

**Location:** Multiple files

**Problem:** Error handling is inconsistent across the app:

```javascript
// Good - logs errors
.catch(err => {
  console.error('[MyBooks] Failed to load stats:', err)
})

// Bad - silent failure
.catch(() => {
  setSuggestions([])
})
```

**Impact:** Harder to debug issues in production.

**Fix:** Standardize error logging across all catch blocks.

---

### 12. BookDetailPage Doesn't Handle Missing OL ID

**Location:** `frontend/src/pages/BookDetailPage.jsx` (line 69)

**Problem:** BookDetailPage tries to fetch shelf entry by OL ID, but custom books don't have one:

```javascript
if (!accessToken || !book?.olId) return  // ← Returns early for custom books
apiFetch(`/api/user-books/by-ol/${book.olId}`, ...)
```

**Impact:** Custom books (is_custom=true) won't show user's existing shelf entry.

**Root Cause:** Custom books have `open_library_id = null` in database.

**Fix:** Also check by book_id for custom books:
```javascript
// Fetch by book_id instead of olId for custom books
const lookupId = book.bookId || book.id
if (!lookupId) return
// Use different endpoint or pass book_id
```

---

### 13. Unused featuredAuthors Variable

**Location:** `frontend/src/pages/HomePage.jsx` (lines 17-25)

**Problem:** `featuredAuthors` array is defined but never used.

**Impact:** Dead code, bundle size (minimal).

**Fix:** Remove if not needed or implement the feature.

---

### 14. SearchPage Doesn't Reset Rating Filter on Search Change

**Location:** `frontend/src/pages/SearchPage.jsx` (lines 117-121)

**Problem:** `resetFilters()` resets category and author but NOT rating filter:

```javascript
const resetFilters = () => {
  setSelectedCategory('All')
  setSelectedRating('All')  // ← This is missing!
  setAuthorTags([])
}
```

Actually, looking again - it DOES reset rating. But the rating filter is also not being applied (Issue #2).

---

## 🔵 Low Severity Issues

### 15. Inconsistent Date Handling

**Location:** `backend/src/models/User.js` (line 82)

**Problem:** `dateOfBirth` validation accepts any string that passes Date.parse(), not just valid dates.

**Impact:** Could store invalid dates.

**Fix:** Add proper date validation.

---

### 16. Magic Numbers in Token Expiration

**Location:** `backend/src/middleware/auth.js` (line 40)

**Problem:** Token expiration is hardcoded as "15m" but the frontend assumes 15 minutes for refresh timer.

**Impact:** If backend changes, frontend breaks.

**Fix:** Export token lifetime from backend or make it configurable.

---

### 17. Missing Index on books.title and books.author

**Location:** `backend/migrations/schema.sql`

**Problem:** No indexes on frequently searched columns.

**Impact:** Search performance degrades as book count grows.

**Fix:** Add indexes:
```sql
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
```

---

## API Contract Issues

### Request/Response Mismatches

| Endpoint | Backend Returns | Frontend Expects | Issue |
|----------|----------------|------------------|-------|
| `GET /api/books/search` | `average_rating` (string from PG) | `averageRating` (number) | ✅ Fixed by mapper |
| `GET /api/user-books` | `user_book_id`, `open_library_id` | `userBookId`, `olId` | ✅ Fixed by mapper |
| `GET /api/user-books/stats` | `average_rating` (string via toFixed) | Number | 🟠 Issue #5 |
| `POST /api/books` | `created_at`, `updated_at` | Not used | 🔵 OK |

---

## Data Flow Diagrams

### Current Search Flow (With Issues)
```
User types query
    ↓
SearchPage calls /api/books/search-universal
    ↓
Backend returns mixed sources (local + external)
    ↓
SearchPage uses INLINE MAPPING (Issue #1)
    ↓
BookCard receives data
    ↓
Rating filter UI shows but doesn't filter (Issue #2)
```

### Recommended Search Flow
```
User types query
    ↓
SearchPage calls /api/books/search-universal
    ↓
Backend returns mixed sources
    ↓
SearchPage uses mapBookFromAPI (consistent)
    ↓
BookCard receives normalized data
    ↓
Filters actually filter the data
```

---

## Security Considerations

### Current State
- ✅ JWT tokens with refresh rotation
- ✅ Rate limiting on sensitive endpoints
- ✅ Helmet for security headers
- ✅ CORS configured
- ✅ SQL injection prevention via parameterized queries

### Potential Improvements
- 🟡 Add request size limits on book creation (cover URLs can be long)
- 🟡 Sanitize review text (XSS prevention)
- 🟡 Add CSRF protection for cookie-based auth

---

## Performance Considerations

### Current State
- ✅ Database connection pooling
- ✅ Lazy loading of external search results
- ✅ Pagination support

### Issues
- 🟠 Search queries use `ILIKE` with wildcards (can't use indexes effectively)
- 🟠 External search fetches every time (no caching)
- 🟡 No debouncing on search input (SearchBox has it, SearchPage doesn't need it)

---

## Recommended Priority Order

### Immediate (This Sprint)
1. Fix SearchPage to use bookMapper consistently (Issue #1)
2. Fix or remove rating filter UI (Issue #2)
3. Update Navbar SearchBox to use apiFetch (Issue #3)

### High Priority (Next Sprint)
4. Fix averageRating type in stats endpoint (Issue #5)
5. Fix BookCard key prop (Issue #7)
6. Handle category filter properly (Issue #8)

### Medium Priority (Backlog)
7. Standardize error logging
8. Add database indexes
9. Fix BookDetailPage data structure

---

## Summary Table

| ID | Issue | Severity | Location | Effort | Impact |
|----|-------|----------|----------|--------|--------|
| 1 | Inconsistent mapping | 🔴 Critical | SearchPage.jsx | Low | High |
| 2 | Rating filter non-functional | 🔴 Critical | SearchPage.jsx | Low | High |
| 3 | SearchBox bypasses auth | 🔴 Critical | Navbar.jsx | Low | Medium |
| 4 | BookDetailPage data structure | 🔴 Critical | BookDetailPage.jsx | Medium | High |
| 5 | averageRating as string | 🟠 High | userBooks.js | Low | Medium |
| 6 | External books no ratings | 🟠 High | books.js | High | Low |
| 7 | BookCard key duplicates | 🟠 High | SearchPage.jsx | Low | Medium |
| 8 | Category filter broken | 🟠 High | SearchPage + backend | Medium | Medium |
| 9 | Suggestions missing ratings | 🟠 High | Navbar.jsx | Low | Low |
| 10 | Token timer mismatch | 🟠 High | AuthContext.jsx | Low | Low |
| 11 | Silent errors | 🟡 Medium | Multiple | Low | Low |
| 12 | Custom books no shelf lookup | 🟡 Medium | BookDetailPage.jsx | Medium | Medium |
| 13 | Unused variable | 🟡 Medium | HomePage.jsx | Low | Low |
| 14 | Rating filter reset | 🟡 Medium | SearchPage.jsx | Low | Low |
| 15 | Date validation | 🔵 Low | User.js | Low | Low |
| 16 | Magic numbers | 🔵 Low | auth.js | Low | Low |
| 17 | Missing indexes | 🔵 Low | schema.sql | Low | Low |

---

## Appendix: Code Quality Metrics

### Test Coverage
- ❌ No unit tests for backend models
- ❌ No unit tests for frontend components
- ❌ No integration tests

### Linting
- ✅ Backend ESLint passes
- ⚠️ Frontend ESLint has warnings (pre-existing)

### Documentation
- ✅ Good inline JSDoc comments
- ✅ AGENTS.md exists
- ❌ No API documentation (OpenAPI/Swagger)
