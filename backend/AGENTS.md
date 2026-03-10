# Backend Development Guide

## Agent Workflow Guidelines

### DO NOT Use `git add`

**Never run `git add` to stage files.** The user prefers to review diffs themselves before committing.

- Generate or modify files as requested
- Show the user what changed using `git diff` or file summaries
- Let the user decide when to stage and commit
- This allows the user to review all changes before they're committed to history

## Technology Stack

- **Runtime**: Node.js 20 (LTS)
- **Database**: PostgreSQL 15+
- **Primary Dependencies**:
  - `pg` - PostgreSQL client with connection pooling
  - `express` - Web framework
  - `dotenv` - Environment configuration
  - `bcryptjs` - Password hashing
  - `jsonwebtoken` - JWT authentication
  - `helmet` - Security headers
  - `cors` - Cross-origin resource sharing

## Project Structure

```
backend/
├── src/
│   ├── config/         # Database and app configuration
│   ├── routes/         # API route definitions
│   │   ├── users.js    # User registration, login, profile
│   │   ├── books.js    # Book creation, search, lookup
│   │   └── userBooks.js # Reading list management
│   ├── middleware/     # Express middleware
│   │   ├── auth.js     # JWT authentication
│   │   ├── errorHandler.js # Global error handling
│   │   └── validate.js # Request body validation
│   ├── models/         # Data access layer
│   │   ├── User.js     # User CRUD and auth
│   │   ├── Book.js     # Book management
│   │   └── UserBook.js # Reading list operations
│   ├── services/       # Business logic (when models grow too large)
│   └── utils/          # Helper functions
├── migrations/         # SQL schema migrations (*.sql files)
├── scripts/            # Development and deployment scripts
│   ├── migrate.js      # Run migrations (all environments)
│   └── setup-db.js     # Create DB + migrations (dev only)
├── tests/              # Test files
├── .env                # Environment variables (not in git)
└── .env.example        # Environment template
```

## Database Architecture

### Infrastructure vs Application Separation

A critical principle in this architecture is the separation between **infrastructure concerns** and **application concerns**:

| Concern | Example | Who Handles It | Tool |
|---------|---------|----------------|------|
| Infrastructure | Database exists, users, replication | Platform/Ops | Terraform, CloudFormation |
| Application | Table schemas, indexes, constraints | Development | Migration scripts |

**Why this separation matters:**

1. **Least Privilege**: Production app users should not have `CREATEDB` permissions
2. **Audit Compliance**: Database provisioning must go through approved infrastructure pipelines
3. **Safety**: Prevents accidental production database creation/deletion
4. **Consistency**: Infrastructure tools handle backups, encryption, security groups

### Scripts Reference

| Script | Purpose | Environment | Why |
|--------|---------|-------------|-----|
| `setup-db.js` | Create DB + run migrations | Development only | Requires elevated DB privileges |
| `migrate.js` | Run migrations only | All environments | Least-privilege, safe for production |

### Development Workflow

```bash
# Development: Create database and apply migrations
node scripts/setup-db.js

# Production/Staging: Only apply migrations
# (Database must be provisioned by infrastructure first)
node scripts/migrate.js
```

## Connection Management

### Connection Pooling

Always use `pg.Pool` instead of `pg.Client`:

```javascript
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT, 10),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: /* see SSL section */,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout for new connections
});
```

**Why pooling matters:**
- Creating connections is expensive (TCP handshake + PostgreSQL process fork)
- Without pooling, each HTTP request creates a new connection
- At high load, this exhausts PostgreSQL's `max_connections` limit

### SSL/TLS Configuration

SSL is automatically configured based on the host:

```javascript
// Automatically disabled for localhost
// Automatically enabled for remote hosts (AWS RDS, GCP Cloud SQL, etc.)
const isLocalhost = process.env.PGHOST === 'localhost' || process.env.PGHOST === '127.0.0.1';
const sslConfig = isLocalhost
  ? false
  : { rejectUnauthorized: false }; // Allow self-signed certs from managed DB services
```

**Why `rejectUnauthorized: false`?**
- Managed database services (AWS RDS, etc.) use self-signed certificates
- These certificates are trusted because we connect to known endpoints
- Disabling this option would require managing CA certificates

## Migration System

### How It Works

1. **Tracking Table**: `_migrations` table records which SQL files have been applied
2. **Idempotent**: Running twice won't re-apply migrations
3. **Transactional**: Each migration runs in a transaction (all-or-nothing)
4. **Ordered**: Files are applied in alphabetical order (use timestamps as prefixes)

### Creating Migrations

1. Create a new `.sql` file in `migrations/`:
   ```sql
   -- migrations/001_create_users_table.sql
   CREATE TABLE users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email VARCHAR(255) UNIQUE NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. Use timestamp prefixes for ordering:
   ```
   migrations/
   ├── 20240101000000_create_users_table.sql
   ├── 20240102000000_add_user_indexes.sql
   └── 20240103000000_create_orders_table.sql
   ```

3. Apply migrations:
   ```bash
   node scripts/migrate.js
   ```

### Dry Run Mode

Preview migrations without applying:

```bash
node scripts/migrate.js --dry-run
```

### Migration Best Practices

1. **Never modify existing migration files** after they've been applied
2. **Create new migrations** to fix or alter existing schemas
3. **Test migrations** on a copy of production data before deploying
4. **Keep migrations small** - easier to debug and rollback

## Code Standards

### Module System

Use ES modules exclusively:

```javascript
// package.json must contain: "type": "module"

import express from 'express';
import { query } from './config/database.js';
```

### Async Patterns

Always use async/await with proper error handling:

```javascript
// CORRECT
app.get('/users', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// WRONG - Unhandled promise rejection
app.get('/users', (req, res) => {
  query('SELECT * FROM users').then(result => {
    res.json(result.rows);
  });
});
```

### Query Safety

**Never use string concatenation for SQL.** Always use parameterized queries:

```javascript
// CORRECT - PostgreSQL driver handles escaping
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

// WRONG - SQL injection vulnerability
const result = await query(`SELECT * FROM users WHERE id = ${userId}`);
```

### Environment Configuration

All configuration comes from environment variables with validation:

```javascript
const requiredEnvVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
```

## Security Requirements

1. **SQL Injection Prevention**: Always use parameterized queries (`$1`, `$2`, etc.)
2. **Password Hashing**: Use bcryptjs with cost factor 12 or higher
3. **Environment Isolation**: Separate credentials for dev/staging/production
4. **Least Privilege**: Database user should have minimal required permissions
   - `SELECT`, `INSERT`, `UPDATE`, `DELETE` on application tables
   - No `CREATE DATABASE`, `DROP DATABASE` permissions in production
5. **Secrets Management**: Never commit `.env` files or credentials

## Logging Standards

### Structured Logging

All scripts use structured logging:

```javascript
function log(level, message) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [SCRIPT] [${level}] ${message}`);
}

log('INFO', 'Starting operation');
log('SUCCESS', 'Operation completed');
log('ERROR', 'Operation failed');
```

**Why stderr for logs?**
- stdout is reserved for machine-readable output (JSON, CSV, etc.)
- stderr is for human-readable diagnostic information
- This allows `script.js | jq .` to work even with verbose logging

### No Emojis

Professional codebases avoid emojis:
- Terminal compatibility issues
- Parsing difficulties in log aggregation systems
- Inconsistent rendering across platforms

## Testing

Use the built-in Node.js test runner:

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { query, closePool } from '../src/config/database.js';

describe('User model', () => {
  test('should create user', async () => {
    const result = await query(
      'INSERT INTO users (email) VALUES ($1) RETURNING *',
      ['test@example.com']
    );
    assert.equal(result.rows[0].email, 'test@example.com');
  });
});

// Clean up
process.on('exit', () => closePool());
```

Run tests:
```bash
node --test
```

## Environment Variables

Required variables (see `.env.example`):

```
# PostgreSQL
PGHOST=localhost              # Database host
PGPORT=5432                   # Database port
PGUSER=your_username          # Database user
PGPASSWORD=your_password      # Database password
PGDATABASE=shelftrack         # Database name
PGPOOL_MAX=20                 # (Optional) Max pool connections

# Server
PORT=3000                     # Application port
NODE_ENV=development          # Environment (development/staging/production)
```

## Authentication & Authorization

### JWT-Based Authentication

The API uses stateless JWT (JSON Web Token) authentication:

```javascript
// Login returns a token
POST /api/users/login
// Response: { token: "eyJhbGciOiJIUzI1NiIs...", user: {...} }

// Subsequent requests include the token
Authorization: Bearer <token>
```

**Why JWT?**
- Stateless: No server-side sessions to manage
- Scalable: Works across multiple server instances
- Mobile/SPA friendly: Easy to store in memory or secure storage

**Token Contents:**
```javascript
{ user_id: 123 }  // Minimal payload - just the user ID
```

**Security Considerations:**
- Tokens expire after 24 hours (configurable)
- JWT_SECRET must be strong and unique per environment
- Tokens are signed but not encrypted (don't put sensitive data in payload)
- Use HTTPS in production to prevent token interception

### Authorization Pattern

Users can only access their own resources. This is enforced at two levels:

1. **Authentication Middleware** - Verifies valid JWT
```javascript
router.use(authenticate);  // All routes below require valid token
```

2. **Ownership in Queries** - Database enforces access control
```javascript
// User can only update their own records
UPDATE user_books SET status = $1 
WHERE user_book_id = $2 AND user_id = $3  // <-- Ownership check
```

**Key Principle:** Never trust client-provided user IDs. Always use `req.user.user_id` from the JWT.

## API Architecture

### Layered Architecture

```
HTTP Request
    ↓
Express Router (routes/)
    ↓
Middleware (auth, validation)
    ↓
Model (models/)
    ↓
Database
```

**Responsibilities:**
- **Routes**: HTTP handling, input extraction, response formatting
- **Middleware**: Cross-cutting concerns (auth, validation, errors)
- **Models**: Data access, SQL queries, business rules
- **Config**: External services (database, etc.)

### Error Handling Pattern

Centralized error handling with custom error classes:

```javascript
// models/User.js
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

// routes/users.js
router.post("/", async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);  // Pass to centralized handler
  }
});

// middleware/errorHandler.js
export function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: "ValidationError", message: err.message });
  }
  // ... handle other error types
}
```

**Error Response Format:**
```json
{
  "error": "ValidationError",
  "message": "Email already registered"
}
```

### Request Validation

Schema-based validation for all write operations:

```javascript
import { validateBody, schemas } from "../middleware/validate.js";

router.post(
  "/register",
  validateBody(schemas.user.register),  // Validates before handler
  async (req, res, next) => { ... }
);
```

**Validation Features:**
- Required field checking
- Type validation (string, number, email, date)
- Length constraints (min/max)
- Enum validation (status values)
- Pattern matching (regex)
- Automatic string trimming

### Response Standards

All API responses follow consistent patterns:

**Success (GET):**
```json
{
  "user": { "user_id": 1, "email": "user@example.com", ... }
}
```

**Success (Collection):**
```json
{
  "count": 5,
  "books": [...]
}
```

**Success (POST/PUT/PATCH):**
```json
{
  "message": "Book added to shelf",
  "entry": { ... }
}
```

**Error:**
```json
{
  "error": "NotFoundError",
  "message": "Book not found"
}
```

### Route Patterns

| Pattern | Example | Purpose |
|---------|---------|---------|
| `GET /resources` | `GET /api/books` | List/search |
| `GET /resources/:id` | `GET /api/books/123` | Get by ID |
| `POST /resources` | `POST /api/books` | Create |
| `PATCH /resources/:id` | `PATCH /api/user-books/456/status` | Partial update |
| `PUT /resources/:id` | `PUT /api/user-books/456/review` | Replace/update |
| `DELETE /resources/:id` | `DELETE /api/user-books/456` | Delete |
| `GET /resources/stats` | `GET /api/user-books/stats` | Aggregate data |

## Security Headers

Helmet middleware sets security headers automatically:

- `Content-Security-Policy`: Prevents XSS attacks
- `X-Frame-Options: DENY`: Prevents clickjacking
- `X-Content-Type-Options: nosniff`: Prevents MIME sniffing
- `Strict-Transport-Security`: Forces HTTPS (production)

## Production Deployment Checklist

- [ ] Database provisioned by infrastructure as code (Terraform/CloudFormation)
- [ ] Database user has minimal required permissions (no CREATEDB)
- [ ] Environment variables configured in deployment platform
  - [ ] JWT_SECRET set to strong random string (min 256 bits)
  - [ ] NODE_ENV set to "production"
  - [ ] All PG* variables configured
- [ ] SSL enabled for database connections (automatic for non-localhost)
- [ ] Application logging configured (structured JSON recommended)
- [ ] Health check endpoint implemented (`/health` or similar)
- [ ] Database migrations run as part of deployment pipeline
- [ ] Backups configured for PostgreSQL (automated by managed service)
- [ ] Connection pool size tuned for expected load
- [ ] SIGTERM handler implemented for graceful shutdown
- [ ] Rate limiting configured for auth endpoints (`express-rate-limit`)
- [ ] HTTPS termination configured (reverse proxy or load balancer)
- [ ] CORS origin restricted to known frontend domains

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Ensure PostgreSQL is running: `brew services start postgresql`
- Verify PGHOST/PGPORT match your PostgreSQL instance

### Database Does Not Exist

```
Error: database "shelftrack" does not exist
```
- Development: Run `node scripts/setup-db.js` to create database
- Production: Database must be provisioned by infrastructure tools

### Permission Denied

```
Error: permission denied for table users
```
- Check that database user has appropriate GRANT permissions
- Verify you're connecting to the correct database

### Migration Failed

```
Error: relation "users" already exists
```
- Migration is not idempotent - ensure CREATE statements use IF NOT EXISTS
- Or check if migration was manually applied outside the system
