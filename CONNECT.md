# Backend–Frontend Integration Strategy

## Overview

The ShelfTrack frontend (React 18 + Vite + React Router v7) connects to the backend (Express + PostgreSQL + JWT) via a REST API. This document defines the exact changes needed on both sides and the order to implement them.

---

## Architecture

```
Browser
  ├── React App (in-memory access token via AuthContext)
  │     └── apiFetch wrapper (auto-attaches Authorization header, handles 401 silent refresh)
  │
  └── httpOnly Cookie (refresh token — unreadable by JS, auto-sent by browser to /api/auth/refresh)

Express API
  ├── POST /api/auth/login       → returns access token in body + sets refresh cookie
  ├── POST /api/auth/refresh     → reads refresh cookie → returns new access token
  ├── POST /api/auth/logout      → invalidates refresh token in DB + clears cookie
  └── All other /api/* routes    → require Authorization: Bearer <access-token>
```

---

## Auth Flow (Production-Grade)

**Why this pattern:**
- Access token in-memory → XSS cannot exfiltrate it durably (gone on tab close)
- Refresh token in httpOnly cookie → JavaScript cannot read it at all
- `SameSite=Strict` on refresh cookie → CSRF cannot trigger a refresh from a foreign origin
- Refresh token rotation → stolen refresh token is detectable

**Token lifetimes:**
- Access token: 15 minutes
- Refresh token: 7 days (rotated on every use)

---

## Backend Changes Required

### 1. New Dependencies

```bash
npm install cookie-parser
```

`cors` is already installed.

### 2. server.js — Add cookie-parser + CORS with credentials

```js
import cookieParser from 'cookie-parser';

app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL,   // e.g. http://localhost:5173
  credentials: true,                  // allow cookies to be sent cross-origin
}));
```

### 3. Database — New table for refresh tokens

```sql
-- migrations/20260101000000_create_refresh_tokens.sql
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 hash of the raw token
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

### 4. routes/users.js — Login, Refresh, Logout

**POST /api/users/login** (modify existing):
- Sign a 15-min access token (payload: `{ user_id }`)
- Generate a random refresh token, hash it (SHA-256), store hash in DB with 7-day expiry
- Set the raw refresh token as an httpOnly cookie:
  ```js
  res.cookie('refresh_token', rawRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in ms
  });
  res.json({ token: accessToken, user: { user_id, email, username } });
  ```

**POST /api/auth/refresh** (new endpoint):
1. Read `req.cookies.refresh_token`
2. Hash it, look up in `refresh_tokens` table
3. Check `expires_at` — reject if expired
4. Issue a new access token
5. Rotate the refresh token: generate new raw token, hash it, update the DB row, set new cookie
6. Return `{ token: newAccessToken }`

**POST /api/auth/logout** (new endpoint):
1. Read `req.cookies.refresh_token`
2. Hash it, delete the matching row from `refresh_tokens`
3. Clear the cookie: `res.clearCookie('refresh_token', { path: '/api/auth/refresh' })`
4. Return `{ message: 'Logged out' }`

### 5. Reduce access token expiry

In `middleware/auth.js` (or wherever tokens are signed), change from `24h` to `15m`:
```js
jwt.sign({ user_id }, process.env.JWT_SECRET, { expiresIn: '15m' });
```

---

## Frontend Changes Required

### 1. New file: src/context/AuthContext.jsx

Provides `{ accessToken, user, login, logout, isLoggedIn }` to the whole app via React context.

```jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../utils/apiFetch';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const refreshTimerRef = useRef(null);

  const scheduleRefresh = useCallback((expiresInMs) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = expiresInMs - 60_000; // refresh 60s before expiry
    if (delay > 0) {
      refreshTimerRef.current = setTimeout(silentRefresh, delay);
    }
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) { setAccessToken(null); setUser(null); return; }
      const data = await res.json();
      setAccessToken(data.token);
      scheduleRefresh(15 * 60 * 1000); // 15 minutes
    } catch {
      setAccessToken(null);
      setUser(null);
    }
  }, [scheduleRefresh]);

  // On app mount: attempt silent refresh to restore session
  useEffect(() => {
    silentRefresh();
    return () => clearTimeout(refreshTimerRef.current);
  }, [silentRefresh]);

  const login = useCallback(async (email, password) => {
    const res = await apiFetch('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(res.token);
    setUser(res.user);
    scheduleRefresh(15 * 60 * 1000);
  }, [scheduleRefresh]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAccessToken(null);
    setUser(null);
    clearTimeout(refreshTimerRef.current);
  }, []);

  return (
    <AuthContext.Provider value={{ accessToken, user, login, logout, isLoggedIn: !!accessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 2. New file: src/utils/apiFetch.js

A thin wrapper around `fetch` that attaches the access token header automatically. Import and use this instead of raw `fetch` for all API calls.

```js
import { API_URL } from '../config';

export async function apiFetch(path, options = {}, accessToken = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',      // send cookies (refresh token)
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}
```

Usage in components:
```js
const { accessToken } = useAuth();
const data = await apiFetch('/api/books/search?q=gatsby', {}, accessToken);
```

### 3. main.jsx — Add AuthProvider

```jsx
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

### 4. App.jsx — Replace isLoggedIn state with useAuth

```jsx
import { useAuth } from './context/AuthContext';

export default function App() {
  const { isLoggedIn } = useAuth();
  return (
    <>
      <FloatingNav isLoggedIn={isLoggedIn} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/bookdetail/:id" element={<BookDetailPage />} />  {/* param added */}
        <Route path="/mybooks" element={<MyBooksPage />} />
      </Routes>
    </>
  );
}
```

Remove `onLogin` prop from `SignInPage` and `SignUpPage` — auth is handled inside `AuthContext`.

### 5. Route change: /bookdetail/:id

Change the route from `/bookdetail` to `/bookdetail/:id`.

In `BookDetailPage.jsx`:
```jsx
import { useParams } from 'react-router-dom';
const { id } = useParams();
// fetch book by id
```

Anywhere that navigates to book detail:
```js
navigate(`/bookdetail/${book.id}`);
```

### 6. Navbar — Live Inline Search

Debounced search in the Navbar input that fires `GET /api/books/search?q=<term>` and shows a dropdown of results below the search bar.

Key behavior:
- Debounce 300ms after the user stops typing
- Minimum 2 characters before triggering
- Show a dropdown absolutely positioned below the search input
- Click a result → navigate to `/bookdetail/:id`
- Click outside → close dropdown
- Loading spinner while fetching, "No results" state if empty

The search input already exists in `Navbar.jsx` — add `useState` for query + results, `useEffect` for debounce, and render the dropdown conditionally.

---

## Page-by-Page API Wiring

| Page | Action | API endpoint |
|---|---|---|
| SignInPage | Submit form | `POST /api/users/login` |
| SignUpPage | Submit form | `POST /api/users/register` |
| HomePage | — | No API calls (static) |
| SearchPage | Search books | `GET /api/books/search?q=&genre=&author=` |
| BookDetailPage | Load book | `GET /api/books/:id` |
| BookDetailPage | Save to library | `POST /api/user-books` |
| MyBooksPage | Load library | `GET /api/user-books?status=` |
| MyBooksPage | Update status | `PATCH /api/user-books/:id/status` |
| MyBooksPage | Update review/rating | `PUT /api/user-books/:id/review` |
| MyBooksPage | Remove book | `DELETE /api/user-books/:id` |
| Navbar search | Live results | `GET /api/books/search?q=` |

---

## Environment Variables

### Backend (.env)

```
FRONTEND_URL=http://localhost:5173
JWT_SECRET=<strong-random-256-bit-secret>
```

### Frontend (.env)

```
VITE_API_URL=http://localhost:3000
```

---

## Implementation Order

Work in this order to keep the app runnable at each step:

1. **Backend**: Add `cookie-parser`, configure CORS with `credentials: true`
2. **Backend**: Create `refresh_tokens` migration and run it
3. **Backend**: Modify login to issue 15-min token + set refresh cookie
4. **Backend**: Add `POST /api/auth/refresh` and `POST /api/auth/logout` endpoints
5. **Frontend**: Create `src/utils/apiFetch.js`
6. **Frontend**: Create `src/context/AuthContext.jsx`
7. **Frontend**: Wrap app in `AuthProvider` (main.jsx)
8. **Frontend**: Update App.jsx to use `useAuth`, change route to `/bookdetail/:id`
9. **Frontend**: Wire SignInPage and SignUpPage to real API via `useAuth().login`
10. **Frontend**: Wire SearchPage to `GET /api/books/search`
11. **Frontend**: Wire BookDetailPage to `GET /api/books/:id` and `POST /api/user-books`
12. **Frontend**: Wire MyBooksPage to `GET /api/user-books` and mutation endpoints
13. **Frontend**: Add live inline search to Navbar
