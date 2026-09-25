
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('./db');

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// DATABASE SETUP
// --------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    isbn TEXT,
    available INTEGER DEFAULT 1,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS issued_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    issue_date TEXT,
    due_date TEXT,
    return_date TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

function getColumns(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all();
}

function ensureColumn(tableName, columnName, definition) {
  const columns = getColumns(tableName);

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    );
  }
}

// Ensure columns in existing databases
ensureColumn('books', 'author', 'TEXT');
ensureColumn('books', 'isbn', 'TEXT');
ensureColumn('books', 'available', 'INTEGER DEFAULT 1');
ensureColumn('books', 'image_url', 'TEXT');

ensureColumn('issued_books', 'issue_date', 'TEXT');
ensureColumn('issued_books', 'due_date', 'TEXT');
ensureColumn('issued_books', 'return_date', 'TEXT');
ensureColumn('issued_books', 'user_id', 'INTEGER NOT NULL DEFAULT 1');

ensureColumn('users', 'student_id', 'TEXT');

db.exec(`
  UPDATE books
  SET available = 1
  WHERE available IS NULL;
`);

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// --------------------------------------------------
// REGISTER USER
// --------------------------------------------------

app.post('/api/register', (req, res) => {
  try {
    const { fullName, studentId, email, password } = req.body;

    if (!fullName || !studentId || !email || !password) {
      return res.status(400).json({
        message: 'All fields are required'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existingUser = db.prepare(`
      SELECT id FROM users WHERE email = ?
    `).get(cleanEmail);

    if (existingUser) {
      return res.status(409).json({
        message: 'Email already registered'
      });
    }

    const salt = crypto.randomBytes(16).toString('hex');

    const hashedPassword = crypto
      .scryptSync(password, salt, 64)
      .toString('hex');

    const storedPassword = `${salt}:${hashedPassword}`;

    const result = db.prepare(`
      INSERT INTO users (name, student_id, email, password)
      VALUES (?, ?, ?, ?)
    `).run(
      fullName.trim(),
      studentId.trim(),
      cleanEmail,
      storedPassword
    );

    res.status(201).json({
      message: 'Registration successful!',
      user: {
        id: result.lastInsertRowid,
        name: fullName.trim(),
        studentId: studentId.trim(),
        email: cleanEmail
      }
    });

  } catch (error) {
    console.error('REGISTER ERROR:', error);

    res.status(500).json({
      message: error.message
    });
  }
});

// --------------------------------------------------
// LOGIN USER
// --------------------------------------------------

app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    const user = db.prepare(`
      SELECT * FROM users WHERE email = ?
    `).get(email.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    const [salt, savedHash] = user.password.split(':');

    if (!salt || !savedHash) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    const enteredHash = crypto
      .scryptSync(password, salt, 64)
      .toString('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(savedHash, 'hex'),
      Buffer.from(enteredHash, 'hex')
    );

    if (!isValid) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    res.json({
      message: 'Login successful!',
      user: {
        id: user.id,
        name: user.name,
        studentId: user.student_id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    res.status(500).json({
      message: error.message
    });
  }
});

// --------------------------------------------------
// BASIC CHECKS
// --------------------------------------------------

app.get('/', (req, res) => {
  res.send('Library Management System Backend is running!');
});

app.get('/test-db', (req, res) => {
  try {
    const result = db.prepare('SELECT 1 AS result').get();

    res.json({
      message: 'SQLite connected successfully!',
      data: result
    });
  } catch (error) {
    console.error('DATABASE CHECK ERROR:', error);

    res.status(500).json({
      message: error.message
    });
  }
});

// --------------------------------------------------
// GET ALL BOOKS
// --------------------------------------------------

app.get('/api/books', (req, res) => {
  try {
    const books = db.prepare(`
      SELECT * FROM books
      ORDER BY id DESC
    `).all();

    res.json(books);
  } catch (error) {
    console.error('GET BOOKS ERROR:', error);

    res.status(500).json({
      message: error.message
    });
  }
});

// --------------------------------------------------
// ADD ONE BOOK
// --------------------------------------------------

app.post('/api/books', (req, res) => {
  try {
    const { title, author, isbn, image_url } = req.body;

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        message: 'Book title is required'
      });
    }

    const result = db.prepare(`
      INSERT INTO books
        (title, author, isbn, available, image_url)
      VALUES (?, ?, ?, 1, ?)
    `).run(
      title.trim(),
      author || null,
      isbn || null,
      image_url || null
    );

    res.status(201).json({
      message: 'Book added successfully!',
      bookId: result.lastInsertRowid
    });

  } catch (error) {
    console.error('ADD BOOK ERROR:', error);

    res.status(500).json({
      message: error.message
    });
  }
});

// --------------------------------------------------
// IMPORT BOOKS FROM CSV
// --------------------------------------------------

app.post('/api/import-books', (req, res) => {
  const csvPath = path.join(
    __dirname,
    '../frontend/public/data/Books.csv'
  );

  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({
      message: 'Books.csv file not found',
      path: csvPath
    });
  }

  let imported = 0;
  let finished = false;

  const findBook = db.prepare(`
    SELECT id FROM books WHERE isbn = ?
  `);

  const updateBook = db.prepare(`
    UPDATE books
    SET image_url = ?
    WHERE id = ?
  `);

  const insertBook = db.prepare(`
    INSERT INTO books
      (title, author, isbn, available, image_url)
    VALUES (?, ?, ?, 1, ?)
  `);

  const stream = fs.createReadStream(csvPath).pipe(csv());

  stream.on('data', (book) => {
    console.log('CSV IMAGE COLUMNS:', {
  small: book['Image-URL-S'],
  medium: book['Image-URL-M'],
  large: book['Image-URL-L']
});
    if (finished) return;

    try {
      const title = book['Book-Title'];
      const author = book['Book-Author'];
      const isbn = book['ISBN'];

      const imageUrl =
        book['Image-URL-M'] ||
        book['Image-URL-L'] ||
        book['Image-URL-S'] ||
        null;

      if (title && title.trim()) {
        const existingBook = isbn
          ? findBook.get(isbn)
          : null;

        if (existingBook) {
          updateBook.run(
            imageUrl,
            existingBook.id
          );
        } else {
          insertBook.run(
            title.trim(),
            author || null,
            isbn || null,
            imageUrl
          );
        }

        imported++;
      }
    } catch (error) {
      finished = true;
      stream.destroy();

      console.error('CSV IMPORT ERROR:', error);

      res.status(500).json({
        message: 'Import failed',
        error: error.message
      });
    }
  });

  stream.on('end', () => {
    if (finished) return;

    finished = true;

    res.json({
      message: 'Books imported successfully!',
      totalImported: imported
    });
  });

  stream.on('error', (error) => {
    if (finished) return;

    finished = true;

    console.error('CSV STREAM ERROR:', error);

    res.status(500).json({
      message: 'CSV import failed',
      error: error.message
    });
  });
});

// --------------------------------------------------
// ISSUE A BOOK
// --------------------------------------------------

app.post('/api/issue/:bookId', (req, res) => {
  try {
    const bookId = Number(req.params.bookId);

    if (!Number.isInteger(bookId) || bookId <= 0) {
      return res.status(400).json({
        message: 'Invalid book ID'
      });
    }

    const book = db.prepare(`
      SELECT * FROM books WHERE id = ?
    `).get(bookId);

    if (!book) {
      return res.status(404).json({
        message: 'Book not found'
      });
    }

    const userId = req.body?.userId ?? 1;

    const activeIssue = db.prepare(`
      SELECT id
      FROM issued_books
      WHERE book_id = ?
      AND return_date IS NULL
    `).get(bookId);

    if (activeIssue || Number(book.available) === 0) {
      return res.status(400).json({
        message: 'Book is already issued'
      });
    }

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 10);

    const issueDateText = formatDate(issueDate);
    const dueDateText = formatDate(dueDate);

    const issueBook = db.transaction(() => {
      const updateResult = db.prepare(`
        UPDATE books
        SET available = 0
        WHERE id = ? AND available = 1
      `).run(bookId);

      if (updateResult.changes !== 1) {
        throw new Error('Book is no longer available');
      }

      db.prepare(`
        INSERT INTO issued_books
         (book_id, user_id, issue_date, due_date, return_date, penalty)
          VALUES (?, ?, ?, ?, NULL, 0)
        `)

      .run(
         bookId,
         userId,
         issueDateText,
         dueDateText
      );
    });

    issueBook();

    res.json({
      message: 'Book issued successfully!',
      bookId,
      userId,
      issueDate: issueDateText,
      dueDate: dueDateText
    });

  } catch (error) {
    console.error('BOOK ISSUE ERROR:', error);

    res.status(500).json({
      message: error.message || 'Book issue failed'
    });
  }
});

// --------------------------------------------------
// GET ISSUED BOOKS
// --------------------------------------------------

app.get('/api/issued-books', (req, res) => {
  try {
    const issuedBooks = db.prepare(`
      SELECT
        ib.id AS issueId,
        b.id AS bookId,
        b.title AS title,
        b.author AS author,
        b.isbn AS isbn,
        b.image_url AS image_url,
        ib.user_id AS userId,
        ib.issue_date AS issueDate,
        ib.due_date AS dueDate,
        ib.return_date AS returnDate,
        ib.penalty AS penalty
      FROM issued_books ib
      JOIN books b ON b.id = ib.book_id
      ORDER BY ib.id DESC
    `).all();

    res.json(issuedBooks);

  } catch (error) {
    console.error('GET ISSUED BOOKS ERROR:', error);

    res.status(500).json({
      message: error.message
    });
  }
});

// --------------------------------------------------
// RETURN A BOOK
// --------------------------------------------------

app.post('/api/return/:issueId', (req, res) => {
  try {
    const issueId = Number(req.params.issueId);

    if (!Number.isInteger(issueId) || issueId <= 0) {
      return res.status(400).json({
        message: 'Invalid issue ID'
      });
    }

    const issue = db.prepare(`
      SELECT * FROM issued_books
      WHERE id = ? AND return_date IS NULL
    `).get(issueId);

    if (!issue) {
      return res.status(404).json({
        message: 'Active issued book not found'
      });
    }

    const returnDate = formatDate(new Date());
    const due = new Date(issue.due_date + 'T00:00:00Z');
const returned = new Date(returnDate + 'T00:00:00Z');

const daysLate = Math.max(
  0,
  Math.floor((returned - due) / (1000 * 60 * 60 * 24))
);

const penalty = Math.max(0, daysLate - 1) * 10;

    const returnBook = db.transaction(() => {
      const updateIssue = db.prepare(`
        UPDATE issued_books
        SET return_date = ?, penalty = ?
        WHERE id = ? AND return_date IS NULL 
        
      `)
      .run(returnDate, penalty, issueId);

      if (updateIssue.changes !== 1) {
        throw new Error('Book has already been returned');
      }

      db.prepare(`
        UPDATE books
        SET available = 1
        WHERE id = ?
      `).run(issue.book_id);
    });

    returnBook();

    res.json({
  message: 'Book returned successfully!',
  returnDate,
  daysLate,
  penalty
});

  } catch (error) {
    console.error('BOOK RETURN ERROR:', error);

    res.status(500).json({
      message: error.message || 'Book return failed'
    });
  }
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});