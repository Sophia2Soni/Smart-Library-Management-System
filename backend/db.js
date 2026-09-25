
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(
  path.join(__dirname, 'library.db')
);

// Create books table
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    isbn TEXT,
    available INTEGER DEFAULT 1,
    image_url TEXT
  );
`);

// Create issued_books table
db.exec(`
  CREATE TABLE IF NOT EXISTS issued_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER,
    issue_date TEXT,
    due_date TEXT,
    return_date TEXT,
    user_id INTEGER NOT NULL DEFAULT 1,
    penalty INTEGER DEFAULT 0
  );
`);

// Add missing columns to existing books table
const bookColumns = db.prepare(
  "PRAGMA table_info(books)"
).all();

if (!bookColumns.some(column => column.name === 'image_url')) {
  db.exec("ALTER TABLE books ADD COLUMN image_url TEXT");
}

// Add missing columns to existing issued_books table
const issuedColumns = db.prepare(
  "PRAGMA table_info(issued_books)"
).all();

if (!issuedColumns.some(column => column.name === 'user_id')) {
  db.exec(`
    ALTER TABLE issued_books
    ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1
  `);
}

if (!issuedColumns.some(column => column.name === 'penalty')) {
  db.exec(`
    ALTER TABLE issued_books
    ADD COLUMN penalty INTEGER DEFAULT 0
  `);
}

module.exports = db;