#!/usr/bin/env node
/**
 * Database Seed Script
 *
 * PURPOSE:
 *   Populates the database with realistic development data.
 *   Safe to run repeatedly — skips if seed data already exists.
 *
 * USAGE:
 *   node scripts/seed.js           # Seed if not already seeded
 *   node scripts/seed.js --fresh   # Wipe existing data and re-seed
 *   node scripts/seed.js --dry-run # Preview without writing to DB
 *
 * CREDENTIALS (all seeded users):
 *   password: ShelfTrack2024!
 *
 * EXIT CODES:
 *   0 - Success
 *   1 - Error (connection failed, constraint violation, etc.)
 */

import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

const { Pool } = pg;
dotenv.config();

const BCRYPT_ROUNDS = 12;
const SEED_PASSWORD = "ShelfTrack2024!";
const FRESH = process.argv.includes("--fresh");
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [SEED] [${level}] ${message}`);
}

// ---------------------------------------------------------------------------
// DB connection (own pool — does not import from database.js)
// ---------------------------------------------------------------------------

function validateEnvironment() {
  const required = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

function createPool() {
  const isLocalhost =
    process.env.PGHOST === "localhost" || process.env.PGHOST === "127.0.0.1";
  return new Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT, 10),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const USERS = [
  {
    email: "demo@shelftrack.com",
    username: "emilym",
    firstName: "Emily",
    lastName: "Morrison",
    dateOfBirth: "1995-04-12",
  },
  {
    email: "alex@shelftrack.com",
    username: "alexlemon",
    firstName: "Alex",
    lastName: "Lemon",
    dateOfBirth: "1990-08-23",
  },
  {
    email: "jon@shelftrack.com",
    username: "jrivera",
    firstName: "Jonathan",
    lastName: "Rivera",
    dateOfBirth: "1988-01-30",
  },
];

const BOOKS = [
  {
    openLibraryId: "OL7353617M",
    title: "The Subtle Art of Not Giving a F*ck",
    author: "Mark Manson",
    coverUrl: null,
    firstPublishYear: 2016,
  },
  {
    openLibraryId: "OL27822539M",
    title: "Atomic Habits",
    author: "James Clear",
    coverUrl: null,
    firstPublishYear: 2018,
  },
  {
    openLibraryId: "OL32768611M",
    title: "It Ends with Us",
    author: "Colleen Hoover",
    coverUrl: null,
    firstPublishYear: 2016,
  },
  {
    openLibraryId: "OL35702082M",
    title: "It Starts with Us",
    author: "Colleen Hoover",
    coverUrl: null,
    firstPublishYear: 2022,
  },
  {
    openLibraryId: "OL28277680M",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    coverUrl: null,
    firstPublishYear: 2020,
  },
  {
    openLibraryId: "OL17930368M",
    title: "Fish in a Tree",
    author: "Lynda Mullaly Hunt",
    coverUrl: null,
    firstPublishYear: 2015,
  },
  {
    openLibraryId: "OL27200595M",
    title: "An Ember in the Ashes",
    author: "Sabaa Tahir",
    coverUrl: null,
    firstPublishYear: 2015,
  },
  {
    openLibraryId: "OL26321890M",
    title: "Happy",
    author: "Alex Lemon",
    coverUrl: null,
    firstPublishYear: 2008,
  },
  {
    openLibraryId: "OL7353618M",
    title: "How to Stop Worrying and Start Living",
    author: "Dale Carnegie",
    coverUrl: null,
    firstPublishYear: 1948,
  },
  {
    openLibraryId: "OL27065553M",
    title: "Forget a Mentor, Find a Sponsor",
    author: "Sylvia Ann Hewlett",
    coverUrl: null,
    firstPublishYear: 2013,
  },
  {
    openLibraryId: "OL29247088M",
    title: "The Midnight Library",
    author: "Matt Haig",
    coverUrl: null,
    firstPublishYear: 2020,
  },
  {
    openLibraryId: "OL27274343M",
    title: "Educated",
    author: "Tara Westover",
    coverUrl: null,
    firstPublishYear: 2018,
  },
  {
    openLibraryId: "OL7353619M",
    title: "The Alchemist",
    author: "Paulo Coelho",
    coverUrl: null,
    firstPublishYear: 1988,
  },
  {
    openLibraryId: "OL7353620M",
    title: "Dune",
    author: "Frank Herbert",
    coverUrl: null,
    firstPublishYear: 1965,
  },
  {
    openLibraryId: "OL7353621M",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    coverUrl: null,
    firstPublishYear: 1925,
  },
  {
    openLibraryId: "OL25396044M",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    coverUrl: null,
    firstPublishYear: 2011,
  },
  {
    openLibraryId: "OL7353622M",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    coverUrl: null,
    firstPublishYear: 2011,
  },
  {
    openLibraryId: "OL7353623M",
    title: "The 4-Hour Workweek",
    author: "Tim Ferriss",
    coverUrl: null,
    firstPublishYear: 2007,
  },
  {
    openLibraryId: "OL7353624M",
    title: "The Power of Now",
    author: "Eckhart Tolle",
    coverUrl: null,
    firstPublishYear: 1997,
  },
  {
    openLibraryId: "OL26432115M",
    title: "Big Magic",
    author: "Elizabeth Gilbert",
    coverUrl: null,
    firstPublishYear: 2015,
  },
];

// user_books: [userIndex, bookIndex, status, rating, review]
// Indices reference the USERS and BOOKS arrays above (0-based)
const USER_BOOKS = [
  // Emily's library
  [0, 0, "read", 4, "Really changed how I think about priorities."],
  [0, 1, "read", 5, "The best book on habit formation I have read."],
  [0, 2, "read", 5, "Emotionally devastating in the best way."],
  [0, 4, "reading", null, null],
  [0, 10, "want_to_read", null, null],
  [0, 15, "want_to_read", null, null],
  [0, 16, "read", 4, "Dense but rewarding."],
  // Alex's library
  [1, 5, "read", 4, null],
  [1, 6, "read", 5, "Could not put it down."],
  [1, 7, "read", 5, "A personal favourite."],
  [1, 8, "reading", null, null],
  [1, 9, "want_to_read", null, null],
  [1, 11, "read", 5, "One of the most honest memoirs I have read."],
  [1, 12, "read", 4, null],
  // Jonathan's library
  [2, 13, "read", 5, "A masterpiece of world-building."],
  [2, 14, "read", 3, null],
  [2, 17, "read", 4, "Practical and motivating."],
  [2, 18, "reading", null, null],
  [2, 19, "want_to_read", null, null],
  [2, 3, "want_to_read", null, null],
];

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

async function checkAlreadySeeded(client) {
  const { rows } = await client.query(
    "SELECT COUNT(*) FROM users WHERE email = $1",
    [USERS[0].email],
  );
  return parseInt(rows[0].count, 10) > 0;
}

async function wipeData(client) {
  log("INFO", "Wiping existing seed data...");
  await client.query("DELETE FROM refresh_tokens");
  await client.query("DELETE FROM user_books");
  await client.query("DELETE FROM books WHERE is_custom = FALSE");
  await client.query(
    "DELETE FROM users WHERE email = ANY($1::text[])",
    [USERS.map((u) => u.email)],
  );
  log("INFO", "Wipe complete");
}

async function seedUsers(client, passwordHash) {
  const ids = [];
  for (const user of USERS) {
    const { rows } = await client.query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name, date_of_birth)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id`,
      [
        user.email,
        user.username,
        passwordHash,
        user.firstName,
        user.lastName,
        user.dateOfBirth,
      ],
    );
    ids.push(rows[0].user_id);
    log("INFO", `Created user: ${user.email} (user_id: ${rows[0].user_id})`);
  }
  return ids;
}

async function seedBooks(client) {
  const ids = [];
  for (const book of BOOKS) {
    const { rows } = await client.query(
      `INSERT INTO books (open_library_id, title, author, cover_url, first_publish_year, is_custom)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING book_id`,
      [
        book.openLibraryId,
        book.title,
        book.author,
        book.coverUrl,
        book.firstPublishYear,
      ],
    );
    ids.push(rows[0].book_id);
    log("INFO", `Created book: "${book.title}" (book_id: ${rows[0].book_id})`);
  }
  return ids;
}

async function seedUserBooks(client, userIds, bookIds) {
  for (const [userIdx, bookIdx, status, rating, review] of USER_BOOKS) {
    await client.query(
      `INSERT INTO user_books (user_id, book_id, status, rating, review)
       VALUES ($1, $2, $3, $4, $5)`,
      [userIds[userIdx], bookIds[bookIdx], status, rating, review],
    );
  }
  log("INFO", `Created ${USER_BOOKS.length} user_book entries`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  log("INFO", `Starting seed (fresh: ${FRESH}, dry-run: ${DRY_RUN})`);

  validateEnvironment();

  const pool = createPool();

  try {
    await pool.query("SELECT 1");
    log(
      "INFO",
      `Connected to database: ${process.env.PGDATABASE}@${process.env.PGHOST}`,
    );

    const client = await pool.connect();
    try {
      if (!FRESH) {
        const seeded = await checkAlreadySeeded(client);
        if (seeded) {
          log(
            "INFO",
            "Seed data already exists — skipping. Use --fresh to re-seed.",
          );
          return;
        }
      }

      if (DRY_RUN) {
        log(
          "INFO",
          `Would insert ${USERS.length} users, ${BOOKS.length} books, ${USER_BOOKS.length} user_book entries`,
        );
        log("INFO", "Dry run complete — no changes made");
        return;
      }

      await client.query("BEGIN");
      try {
        if (FRESH) {
          await wipeData(client);
        }

        log("INFO", `Hashing passwords (bcrypt rounds: ${BCRYPT_ROUNDS})...`);
        const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

        const userIds = await seedUsers(client, passwordHash);
        const bookIds = await seedBooks(client);
        await seedUserBooks(client, userIds, bookIds);

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

seed()
  .then(() => {
    log("SUCCESS", `Seed complete`);
    log("INFO", `Login credentials for all seeded users: ${SEED_PASSWORD}`);
    log("INFO", `  demo@shelftrack.com  (Emily Morrison)`);
    log("INFO", `  alex@shelftrack.com  (Alex Lemon)`);
    log("INFO", `  jon@shelftrack.com   (Jonathan Rivera)`);
    process.exit(0);
  })
  .catch((err) => {
    log("ERROR", `Seed failed: ${err.message}`);
    process.exit(1);
  });
