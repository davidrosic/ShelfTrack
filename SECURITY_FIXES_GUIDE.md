# Security Fixes Guide

**Quick reference for fixing security issues identified in the audit.**

---

## 🔴 CRITICAL FIXES (Do These First)

### 1. Remove .env from Git History

```bash
# Remove from git tracking
git rm --cached backend/.env

# Add to .gitignore
echo "backend/.env" >> .gitignore
echo "frontend/.env" >> .gitignore

# Commit the removal
git add .gitignore
git commit -m "security: Remove .env files from repository"

# IMPORTANT: Rotate the JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Update backend/.env with the new secret
```

### 2. Add XSS Sanitization

**Install dependency:**
```bash
cd frontend
npm install dompurify
```

**Create sanitizer utility (`frontend/src/utils/sanitize.js`):**
```javascript
import DOMPurify from 'dompurify';

export function sanitizeText(text) {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}
```

**Update BookCard.jsx (line 74):**
```javascript
import { sanitizeText } from '../utils/sanitize';

// Replace:
{book.review && (
  <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">"{book.review}"</p>
)}

// With:
{book.review && (
  <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">"{sanitizeText(book.review)}"</p>
)}
```

### 3. Fix SSRF in Book Model

**Update `backend/src/models/Book.js` (searchExternal function):**

```javascript
static async searchExternal(searchTerm, { limit = 20, offset = 0, subject = null } = {}) {
  // SSRF Protection
  const MAX_SEARCH_LENGTH = 200;
  const BLOCKED_PATTERNS = /[\r\n\x00]|^(http|https|ftp|file):\/\//i;
  
  if (!searchTerm || searchTerm.length > MAX_SEARCH_LENGTH) {
    throw new ValidationError("Search term must be between 1 and 200 characters");
  }
  
  if (BLOCKED_PATTERNS.test(searchTerm)) {
    throw new ValidationError("Invalid characters in search term");
  }
  
  // Also validate subject if provided
  if (subject && (subject.length > 100 || BLOCKED_PATTERNS.test(subject))) {
    throw new ValidationError("Invalid subject filter");
  }

  const OL_API = "https://openlibrary.org/search.json";
  const fields = "key,title,author_name,first_publish_year,cover_i";
  
  // Use URL constructor for safer URL building
  const url = new URL(OL_API);
  url.searchParams.set("q", searchTerm.trim());
  url.searchParams.set("limit", String(Math.min(parseInt(limit) || 20, 50)));
  url.searchParams.set("offset", String(parseInt(offset) || 0));
  url.searchParams.set("fields", fields);
  if (subject) {
    url.searchParams.set("subject", subject);
  }

  // ... rest of function
}
```

---

## 🟠 HIGH PRIORITY FIXES

### 4. Add CSRF Protection

**Install dependency:**
```bash
cd backend
npm install csurf
```

**Update `backend/src/server.js`:**

```javascript
import csrf from 'csurf';

// After cookieParser middleware
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Apply to state-changing routes
app.use('/api/user-books', csrfProtection, userBookRoutes);
app.use('/api/users/me', csrfProtection, userRoutes);
```

**Frontend: Update apiFetch.js to include CSRF token:**
```javascript
async function doFetch(path, options, accessToken) {
  // Get CSRF token from cookie
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('_csrf='))
    ?.split('=')[1];

  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(csrfToken ? { 'CSRF-Token': csrfToken } : {}),
    ...options.headers,
  };
  // ... rest
}
```

### 5. Fix Timing Attack on Password Comparison

**Update `backend/src/models/User.js`:**

```javascript
static async verifyPassword(plainPassword, hashedPassword) {
  // Prevent timing attacks by always performing bcrypt comparison
  const dummyHash = '$2a$12$' + '0'.repeat(53);
  const hashToCompare = hashedPassword || dummyHash;
  const passwordToCompare = plainPassword || '';
  
  return bcrypt.compare(passwordToCompare, hashToCompare);
}
```

### 6. Add Rate Limiting to Book Creation

**Update `backend/src/routes/books.js`:**

```javascript
import rateLimit from 'express-rate-limit';

const bookCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 books per hour per user
  keyGenerator: (req) => req.user?.user_id || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: "RateLimitError",
      message: "Book creation limit exceeded. Maximum 50 books per hour."
    });
  }
});

// Apply to book creation
router.post("/", bookCreateLimiter, validateBody(schemas.book.create), async (req, res, next) => {
  // ... existing code
});
```

### 7. Validate LIMIT/OFFSET Parameters

**Update `backend/src/models/UserBook.js` (getUserShelf function):**

```javascript
static async getUserShelf(userId, statusFilter = null, { limit = 50, offset = 0 } = {}) {
  // ... existing validation

  const MAX_LIMIT = 100;
  const MAX_OFFSET = 100000;
  
  const validatedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), MAX_LIMIT);
  const validatedOffset = Math.min(Math.max(parseInt(offset, 10) || 0, 0), MAX_OFFSET);
  
  // Use validated values in query
  params.push(validatedLimit, validatedOffset);
  // ... rest
}
```

### 8. Add Input Validation for Search

**Update `backend/src/routes/books.js`:**

```javascript
router.get("/search-universal", async (req, res, next) => {
  try {
    const { q, limit = 20, source = 'auto', offset = 0, subject = null } = req.query;

    // Validate search term
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Search query parameter 'q' is required",
      });
    }
    
    if (q.length > 200) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Search query too long (max 200 characters)",
      });
    }
    
    // Block potential injection patterns
    const blockedPattern = /[<>\"'%;()&+\r\n]/;
    if (blockedPattern.test(q)) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Invalid characters in search query",
      });
    }

    // ... rest of function
  }
});
```

---

## 🟡 MEDIUM PRIORITY FIXES

### 9. Strengthen JWT Secret Validation

**Update `backend/src/middleware/auth.js`:**

```javascript
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("[FATAL] JWT_SECRET environment variable is required");
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.error("[FATAL] JWT_SECRET must be at least 32 characters long");
  process.exit(1);
}
```

### 10. Add Security Headers

**Update `backend/src/server.js`:**

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "https://covers.openlibrary.org", "data:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "same-origin" }
}));
```

### 11. Add Password Complexity Validation

**Update `backend/src/middleware/validate.js`:**

```javascript
user: {
  register: {
    fields: {
      // ... other fields
      password: { 
        type: "string", 
        min: 8, 
        max: 255, 
        required: true,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/
      },
    },
    required: ["email", "username", "password", "firstName", "lastName"],
  },
}
```

Add validation message:
```javascript
if (rules.pattern && !rules.pattern.test(value)) {
  errors[field] = errors[field] || [];
  if (field === 'password') {
    errors[field].push("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)");
  } else {
    errors[field].push(`${field} format is invalid`);
  }
}
```

### 12. Validate Book ID Format

**Create `frontend/src/utils/validation.js`:**

```javascript
export function isValidBookId(id) {
  if (!id) return false;
  // Allow alphanumeric, hyphens, and underscores (for OL IDs like "OL123W")
  return /^[a-zA-Z0-9_-]+$/.test(String(id));
}
```

**Update `frontend/src/pages/SearchPage.jsx`:**

```javascript
import { isValidBookId } from '../utils/validation';

const handleBookClick = book => {
  if (!isValidBookId(book.id)) {
    console.error('Invalid book ID');
    return;
  }
  navigate(`/bookdetail/${book.id}`, { state: { book: mapBookForNavigation(book) } });
}
```

---

## 🔧 Development Environment Security

### 13. Secure Development Environment Variables

**Update `backend/.env.example`:**
```bash
# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=your_username
PGPASSWORD=your_password
PGDATABASE=shelftrack

# Server
PORT=3000
FRONTEND_URL=http://localhost:5173

# Security - GENERATE A STRONG SECRET
tmp_secret=$(openssl rand -base64 64)
JWT_SECRET=$tmp_secret

# Environment
NODE_ENV=development
```

**Add setup script (`scripts/setup-env.sh`):**
```bash
#!/bin/bash
# Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 64)

cat > backend/.env << EOF
# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=$USER
PGPASSWORD=changeme
PGDATABASE=shelftrack

# Server
PORT=3000
FRONTEND_URL=http://localhost:5173

# Security
JWT_SECRET=$JWT_SECRET

# Environment
NODE_ENV=development
EOF

echo "Environment file created with secure JWT secret"
echo "Please update the database credentials"
```

---

## ✅ Post-Fix Verification Checklist

After applying fixes, verify:

- [ ] `.env` file is in `.gitignore` and not tracked by git
- [ ] XSS payload `<img src=x onerror=alert(1)>` is sanitized in reviews
- [ ] SSRF attempt with newlines in search is blocked
- [ ] Rate limiting blocks excessive book creation
- [ ] CSRF token is required for POST /api/user-books
- [ ] Password comparison timing is consistent
- [ ] JWT secret is at least 32 characters
- [ ] All tests pass

---

## Emergency Contacts

If you discover an active exploitation of these vulnerabilities:

1. **Immediately** rotate the JWT_SECRET
2. **Clear all refresh tokens** from the database
3. **Force all users to re-login**
4. **Review application logs** for suspicious activity
5. **Notify users** if data breach is suspected

---

*Last updated: 2026-03-10*
