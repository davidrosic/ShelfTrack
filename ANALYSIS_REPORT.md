# ShelfTrack Frontend-Backend Analysis Report

**Date:** 2026-03-10  
**Scope:** Full-stack analysis of frontend (React + Vite) and backend (Express + PostgreSQL)  
**Objective:** Identify inconsistencies, errors, redundant code, and security issues

---

## Executive Summary

The codebase implements a book tracking application with authentication, book search, and personal library management. The **backend is generally well-structured** with proper security measures (token rotation, httpOnly cookies, password hashing). The **frontend has several issues** including incomplete auth integration, navigation inconsistencies, and UI that doesn't reflect authentication state.

### Critical Issues Found: 7
### Warnings Found: 12
### Redundant Code: 4 locations

---

## 1. CRITICAL ISSUES

### 1.1 Navbar Shows Login/Signup Buttons Regardless of Auth State

**Location:** `frontend/src/components/Navbar.jsx` (lines 31-46)

**Issue:** The Navbar component always displays "Sign in" and "Sign up" buttons, even when the user is logged in. There's no logout button or user profile indication.

**Current Code:**
```jsx
<div className="flex items-center gap-3">
  <button onClick={() => navigate("/signin")}>Sign in</button>
  <button onClick={() => navigate("/signup")}>Sign up</button>
</div>
```

**Expected Behavior:** Should use `useAuth()` hook to conditionally show:
- Login/Signup buttons when NOT authenticated
- User profile/logout when authenticated

**Impact:** Users cannot log out from the main navigation. Confusing UX.

**Fix:** Import `useAuth` and conditionally render based on `isLoggedIn`:
```jsx
import { useAuth } from "../context/AuthContext";

const Navbar = ({ showSearch = true }) => {
  const navigate = useNavigate();
  const { isLoggedIn, logout, user } = useAuth();
  
  // ... render auth-aware buttons
};
```

---

### 1.2 Navbar Search Input is Non-Functional

**Location:** `frontend/src/components/Navbar.jsx` (lines 18-28, 50-58)

**Issue:** The search inputs in Navbar are purely presentational. They don't:
- Capture input state
- Trigger search on submit
- Navigate to search results

**Current Code:**
```jsx
<input
  type="text"
  placeholder="Need help finding your book?"
  className="..."
  // No onChange, no onSubmit, no value binding
/>
```

**Expected Behavior:** Per CONNECT.md section 6, Navbar should have "Live Inline Search" with debounced API calls to `/api/books?q=`.

**Impact:** Users cannot search from the navbar as designed.

---

### 1.3 Frontend Does Not Handle 401 Errors with Automatic Token Refresh

**Location:** `frontend/src/utils/apiFetch.js`

**Issue:** The `apiFetch` wrapper doesn't handle 401 (Unauthorized) responses by attempting a silent refresh before failing. This means when the access token expires, API calls fail instead of transparently refreshing.

**Current Code:**
```js
if (!res.ok) {
  const err = await res.json().catch(() => ({ message: 'Request failed' }));
  throw new Error(err.message || res.statusText);
}
```

**Expected Behavior:** Per CONNECT.md architecture diagram, apiFetch should:
1. On 401, attempt silent refresh via `/api/auth/refresh`
2. Retry the original request with new token
3. Only fail if refresh also fails

**Impact:** Users are logged out unexpectedly when access tokens expire (every 15 minutes).

**Fix:** The AuthContext has `silentRefresh` but it's not integrated into `apiFetch`. Options:
- Add a global 401 handler that triggers auth refresh
- Pass a callback to apiFetch for auth failures
- Use an axios-like interceptor pattern

---

### 1.4 BookCard Uses Wrong Property for ID

**Location:** `frontend/src/components/BookCard.jsx` (line 13, implicit)

**Issue:** BookCard receives `book` prop but the parent components pass different ID fields:
- `SearchPage.jsx` passes: `id: b.book_id` (line 51)
- `MyBooksPage.jsx` passes: `id: entry.book_id` AND `userBookId: entry.user_book_id` (lines 32-33)

When clicking a book in MyBooksPage, it navigates to `/bookdetail/${book.id}` which uses `book_id`. However, the deletion and status updates require `user_book_id`.

**Impact:** This creates confusion between:
- `book_id` (the book in the catalog)
- `user_book_id` (the user's shelf entry)

The BookDetailPage uses `bookId: book.book_id` when adding to shelf, which is correct. But removing from shelf would need `user_book_id`, not `book_id`.

---

### 1.5 MyBooksPage Filtering is Client-Side Only

**Location:** `frontend/src/pages/MyBooksPage.jsx` (lines 49-54, 56)

**Issue:** The shelf data is fetched once, then filtered client-side. For large libraries, this is inefficient. Also, the count badges calculate by filtering the already-fetched data, which won't reflect server-side changes.

**Current Code:**
```jsx
const counts = {
  all: books.length,
  want_to_read: books.filter(b => b.status === 'want_to_read').length,
  // ...
}
```

**Expected:** Should use the `/api/user-books/stats` endpoint for accurate counts.

---

### 1.6 FloatingNav Missing Logout and User State

**Location:** `frontend/src/App.jsx` (lines 11-61)

**Issue:** The FloatingNav component receives `isLoggedIn` but doesn't show user-specific actions like logout or profile. It also doesn't update when auth state changes in a meaningful way (just switches nav items).

**Related Issue:** There's no way to log out from the floating navigation.

---

### 1.7 API Endpoint Mismatch in CONNECT.md vs Implementation

**Location:** Documentation vs Code

**Issue:** CONNECT.md section "Page-by-Page API Wiring" lists endpoints that don't match the actual backend:

| CONNECT.md Spec | Actual Backend | Status |
|----------------|----------------|--------|
| `GET /api/books?q=` | `GET /api/books/search?q=` | ❌ Mismatch |
| `GET /api/books/:id` | `GET /api/books/:id` | ✅ Match |
| `POST /api/user-books` | `POST /api/user-books` | ✅ Match |
| `GET /api/user-books?status=` | `GET /api/user-books?status=` | ✅ Match |
| `PATCH /api/user-books/:id/status` | `PATCH /api/user-books/:id/status` | ✅ Match |
| `PUT /api/user-books/:id/review` | `PUT /api/user-books/:id/review` | ✅ Match |
| `DELETE /api/user-books/:id` | `DELETE /api/user-books/:id` | ✅ Match |

The search endpoint mismatch is significant. Frontend correctly uses `/api/books/search` (SearchPage.jsx line 45) but documentation says `/api/books?q=`.

---

## 2. SECURITY ISSUES

### 2.1 Refresh Token Cookie Path Inconsistency

**Location:** 
- `backend/src/routes/users.js` (line 129): `path: "/api/auth/refresh"`
- `backend/src/routes/auth.js` (line 70): `path: "/api/auth/refresh"`

**Analysis:** The cookie path is set to `/api/auth/refresh` which means:
- The cookie is ONLY sent to `/api/auth/refresh` endpoint
- This is correct per the CONNECT.md design (security best practice)
- The cookie won't be sent to other endpoints, reducing XSS attack surface

**Status:** ✅ This is intentionally correct.

---

### 2.2 CORS Configuration Missing in Production Check

**Location:** `backend/src/server.js` (lines 77-82)

**Issue:** The CORS configuration uses `FRONTEND_URL` from env, but if not set, falls back to `http://localhost:5173`. In production, this could allow unexpected origins if `FRONTEND_URL` is not explicitly set.

**Current Code:**
```js
cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
})
```

**Recommendation:** In production, require explicit `FRONTEND_URL`:
```js
const corsOrigin = process.env.NODE_ENV === 'production' 
  ? process.env.FRONTEND_URL 
  : (process.env.FRONTEND_URL || "http://localhost:5173");

if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.error('[FATAL] FRONTEND_URL required in production');
  process.exit(1);
}
```

---

### 2.3 No Rate Limiting on Auth Endpoints

**Location:** `backend/src/routes/users.js` (login, register), `backend/src/routes/auth.js` (refresh)

**Issue:** No rate limiting is implemented on authentication endpoints, making them vulnerable to brute force attacks.

**Recommendation:** Add `express-rate-limit`:
```js
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many attempts, please try again later' }
});

router.post('/login', authLimiter, ...);
```

---

## 3. DATA MODEL INCONSISTENCIES

### 3.1 Book Description Field Missing in Database

**Location:** 
- `backend/migrations/schema.sql`: No `description` column in books table
- `frontend/src/pages/BookDetailPage.jsx` (line 104-108): Checks for `book.description`

**Issue:** The frontend expects and displays a book description, but the database schema doesn't have this field. The Book model doesn't handle descriptions either.

**Schema:**
```sql
CREATE TABLE books (
    book_id SERIAL PRIMARY KEY,
    open_library_id VARCHAR(50) UNIQUE,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    cover_url TEXT,
    first_publish_year INTEGER,
    is_custom BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    -- NO description column
);
```

**Impact:** Book descriptions from Open Library are never stored or displayed.

---

### 3.2 Refresh Token Schema Mismatch with CONNECT.md

**Location:** 
- `backend/migrations/schema.sql` (lines 56-62)
- `CONNECT.md` (lines 67-73)

**CONNECT.md specifies:**
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
```

**Actual schema:**
```sql
id SERIAL PRIMARY KEY,
user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
```

**Analysis:** The actual implementation uses SERIAL/INTEGER while CONNECT.md specifies UUID. This is actually fine because:
- The users table uses SERIAL (not UUID)
- INTEGER is more efficient for internal references
- CONNECT.md was a design spec that evolved

**Status:** Not an issue, just documentation drift.

---

### 3.3 Book Model getOrCreateFromOpenLibrary Not Used

**Location:** `backend/src/models/Book.js` (lines 180-207)

**Issue:** The method `getOrCreateFromOpenLibrary` is defined but never called anywhere in the codebase. Open Library integration appears incomplete.

**Impact:** Dead code. The search functionality only searches the local database, not Open Library.

---

## 4. ERROR HANDLING ISSUES

### 4.1 Error Handler Imports ValidationError from User Model Only

**Location:** `backend/src/middleware/errorHandler.js` (line 29)

**Current Code:**
```js
import { ValidationError, NotFoundError } from "../models/User.js";
```

**Issue:** The error handler imports error classes only from User.js, but:
- `Book.js` defines its own `ValidationError` and `NotFoundError`
- `UserBook.js` defines its own error classes including `ForbiddenError`

These are separate class instances, so `instanceof` checks won't work for errors from Book or UserBook models.

**Fix Options:**
1. Create a shared `errors.js` module with all error classes
2. Use duck typing (check `err.name` or `err.statusCode`)
3. Use a base error class that all models extend

**Current Impact:** Errors from Book/UserBook models may not get proper HTTP status codes.

---

### 4.2 AuthContext Doesn't Surface Refresh Failures

**Location:** `frontend/src/context/AuthContext.jsx` (lines 13-33)

**Issue:** When `silentRefresh` fails, it silently sets `accessToken` and `user` to null without any notification to the user or logging. This could cause confusion about why the user was logged out.

---

## 5. REDUNDANT CODE

### 5.1 Multiple ValidationError Definitions

**Locations:**
- `backend/src/models/User.js` (lines 33-39)
- `backend/src/models/Book.js` (lines 27-33)
- `backend/src/models/UserBook.js` (lines 32-38)

**Issue:** Same error class defined 3 times. Should be in a shared module.

---

### 5.2 Multiple NotFoundError Definitions

**Locations:**
- `backend/src/models/User.js` (lines 41-47)
- `backend/src/models/Book.js` (lines 35-41)
- `backend/src/models/UserBook.js` (lines 40-46)

**Issue:** Same error class defined 3 times.

---

### 5.3 Comment Drift in auth.js

**Location:** `backend/src/middleware/auth.js` (lines 1-25 comments)

**Issue:** Comments say:
- "24 hour expiration for security" (line 9)
- "No cookie support (SPA/mobile friendly)" (line 23)

But the code implements:
- 15 minute expiration (line 40: `const TOKEN_EXPIRES_IN = "15m";`)
- Cookie-based refresh tokens (in users.js and auth.js)

**Fix:** Update comments to match implementation.

---

### 5.4 Refresh Token Cookie Constants Duplicated

**Locations:**
- `backend/src/routes/users.js` (lines 38-39)
- `backend/src/routes/auth.js` (lines 16-17)

**Current:** Both files define:
```js
const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
```

**Fix:** Export from a shared config module.

---

## 6. API CONSISTENCY ISSUES

### 6.1 Login Response Structure

**Location:** `backend/src/routes/users.js` (lines 138-142)

**Response:**
```js
res.json({
  message: "Login successful",
  token: accessToken,
  user: userWithoutPassword,
});
```

**AuthContext expects:** (line 51-52)
```js
setAccessToken(data.token);
setUser(data.user);
```

**Status:** ✅ Match. No issue.

---

### 6.2 User Books Endpoint Returns Joined Data

**Location:** `backend/src/models/UserBook.js` (lines 152-159)

The `getUserShelf` method returns a JOIN of `user_books` and `books`:
```sql
SELECT ub.user_book_id, ub.user_id, ub.book_id, ub.status, ub.rating, 
       ub.review, ub.notes, ub.created_at, ub.updated_at,
       b.title, b.author, b.cover_url, b.first_publish_year, b.open_library_id
```

**MyBooksPage mapping** (lines 31-40):
```js
data.shelf.map(entry => ({
  id: entry.book_id,
  userBookId: entry.user_book_id,
  title: entry.title,
  author: entry.author,
  coverUrl: entry.cover_url,
  firstPublishYear: entry.first_publish_year,
  rating: entry.rating,
  status: entry.status,
}))
```

**Status:** ✅ Correct mapping. The joined data prevents N+1 queries.

---

### 6.3 Book Detail Page Uses Wrong ID for API Call

**Location:** `frontend/src/pages/BookDetailPage.jsx` (line 46)

**Current Code:**
```js
const body = { bookId: book.book_id, status: selectedStatus }
```

But `book` state is populated from `/api/books/${id}` which returns:
```js
res.json({ book });  // from books.js line 111
```

The book object from the API has `book_id` (PostgreSQL column name), not `book_id` mapped to `id`.

**Backend Book.findById returns:**
```js
return result.rows[0];  // has book_id (not id)
```

**Frontend expects:**
```js
book.book_id  // This should work
```

**But the route param is:**
```js
const { id } = useParams();  // This is the URL param
```

**Status:** This is actually correct - the API returns `book_id` and the frontend uses it correctly. The confusion is in naming conventions.

---

## 7. MISSING FEATURES (Per CONNECT.md)

### 7.1 Navbar Live Search Not Implemented

**CONNECT.md Section 6:** "Debounced search in the Navbar input that fires GET /api/books?q= and shows a dropdown of results"

**Status:** ❌ Not implemented. Navbar search input is non-functional.

---

### 7.2 User Stats Endpoint Not Used

**Location:** `backend/src/routes/userBooks.js` (lines 114-133)

The endpoint `GET /api/user-books/stats` exists and returns:
```js
{
  userId,
  stats: {
    wantToRead: parseInt(stats.want_to_read_count, 10) || 0,
    reading: parseInt(stats.reading_count, 10) || 0,
    read: parseInt(stats.read_count, 10) || 0,
    total: parseInt(stats.total_count, 10) || 0,
    averageRating: ...
  }
}
```

**MyBooksPage** calculates counts client-side instead of using this endpoint.

---

### 7.3 No Password Confirmation on Registration

**Location:** `frontend/src/pages/SignUpPage.jsx`

**Issue:** Registration form only has one password field. No confirmation field to prevent typos.

---

## 8. MINOR ISSUES

### 8.1 Unused Dependencies

**Backend package.json:**
- `multer` (^2.1.1) - Not used anywhere (no file uploads implemented)

### 8.2 Frontend Shows "Sign in with Google/Apple" Without Implementation

**Locations:**
- `frontend/src/pages/SignInPage.jsx` (lines 93-100)
- `frontend/src/pages/SignUpPage.jsx` (lines 157-163)

**Issue:** OAuth buttons are present but non-functional. No backend endpoints exist for OAuth.

### 8.3 Footer Newsletter Input Non-Functional

**Location:** `frontend/src/components/Footer.jsx` (lines 53-64)

The newsletter subscription form has no onSubmit handler.

### 8.4 Categories Filter is Client-Side Only (No Effect)

**Location:** `frontend/src/pages/SearchPage.jsx` (lines 29, 127-147)

The category filter UI exists but:
- Categories are not sent to the backend
- Backend search doesn't support category filtering
- Filter is only applied client-side (but categories aren't in the book data)

### 8.5 Rating Filter Non-Functional

**Location:** `frontend/src/pages/SearchPage.jsx` (lines 30, 190-211)

The rating filter UI exists but ratings aren't sent to backend, and backend search doesn't support rating filtering.

---

## 9. RECOMMENDATIONS

### Priority 1 (Fix Immediately)

1. **Add logout to Navbar** - Users can't log out currently
2. **Fix apiFetch to handle 401s with silent refresh** - Critical for UX
3. **Make Navbar search functional** - Core feature per spec

### Priority 2 (Fix Soon)

4. **Create shared error classes module** - Fix instanceof checks
5. **Add book description column** - Match frontend expectations
6. **Remove or implement OAuth buttons** - Don't show non-functional UI
7. **Add rate limiting** - Security hardening

### Priority 3 (Nice to Have)

8. **Use stats endpoint in MyBooksPage** - More efficient
9. **Add password confirmation** - Better UX
10. **Extract cookie constants** - Code quality

---

## 10. VERIFICATION CHECKLIST

### Authentication Flow
- [x] Login returns access token + sets refresh cookie
- [x] Refresh endpoint rotates tokens correctly
- [x] Logout clears cookie and deletes from DB
- [ ] Silent refresh on 401 in apiFetch
- [ ] Logout button in UI
- [ ] Auth state reflected in Navbar

### API Integration
- [x] Search page fetches from `/api/books/search`
- [x] Book detail loads from `/api/books/:id`
- [x] Add to shelf POSTs to `/api/user-books`
- [x] My books loads from `/api/user-books`
- [ ] Navbar search implemented
- [ ] Category filtering works
- [ ] Rating filtering works

### Security
- [x] Passwords hashed with bcrypt
- [x] JWT tokens have expiry
- [x] Refresh tokens are httpOnly
- [x] SameSite=Strict on cookies
- [ ] Rate limiting on auth endpoints
- [ ] CORS origin validation in production

---

## Appendix: File-by-File Summary

| File | Issues | Status |
|------|--------|--------|
| `backend/src/server.js` | CORS fallback in prod | ⚠️ Warning |
| `backend/src/middleware/auth.js` | Comment drift | ⚠️ Warning |
| `backend/src/middleware/errorHandler.js` | Imports wrong error classes | ❌ Bug |
| `backend/src/middleware/validate.js` | None | ✅ OK |
| `backend/src/routes/auth.js` | None | ✅ OK |
| `backend/src/routes/users.js` | None | ✅ OK |
| `backend/src/routes/books.js` | None | ✅ OK |
| `backend/src/routes/userBooks.js` | None | ✅ OK |
| `backend/src/models/User.js` | Duplicated error classes | ⚠️ Warning |
| `backend/src/models/Book.js` | Duplicated error classes, dead code | ⚠️ Warning |
| `backend/src/models/UserBook.js` | Duplicated error classes | ⚠️ Warning |
| `backend/src/models/RefreshToken.js` | None | ✅ OK |
| `frontend/src/context/AuthContext.jsx` | Doesn't handle 401s from apiFetch | ❌ Bug |
| `frontend/src/utils/apiFetch.js` | No 401/refresh handling | ❌ Bug |
| `frontend/src/components/Navbar.jsx` | No auth awareness, search non-functional | ❌ Bug |
| `frontend/src/components/BookCard.jsx` | None | ✅ OK |
| `frontend/src/App.jsx` | No logout in FloatingNav | ⚠️ Warning |
| `frontend/src/pages/SignInPage.jsx` | OAuth buttons non-functional | ⚠️ Warning |
| `frontend/src/pages/SignUpPage.jsx` | OAuth buttons non-functional, no confirm password | ⚠️ Warning |
| `frontend/src/pages/SearchPage.jsx` | Filters non-functional | ⚠️ Warning |
| `frontend/src/pages/BookDetailPage.jsx` | None | ✅ OK |
| `frontend/src/pages/MyBooksPage.jsx` | Uses client-side filtering | ⚠️ Warning |
| `frontend/src/pages/HomePage.jsx` | None | ✅ OK |

---

*Report generated by comprehensive static analysis of the ShelfTrack codebase.*
