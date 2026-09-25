
import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import './Dashboard.css'

const API_URL = 'http://localhost:5001/api'

function formatDate(dateString) {
  if (!dateString) return 'N/A'

  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-IN')
}

function Dashboard() {
  const [books, setBooks] = useState([])
  const [issuedBooks, setIssuedBooks] = useState([])
  const [returnedBooks, setReturnedBooks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Load books and issued books from backend
  const loadData = async () => {
    try {
      setError('')

      const [booksResponse, issuedResponse] = await Promise.all([
        fetch(`${API_URL}/books`),
        fetch(`${API_URL}/issued-books`)
      ])

      if (!booksResponse.ok) {
        throw new Error('Books load nahi ho paayi.')
      }

      if (!issuedResponse.ok) {
        throw new Error('Issued books load nahi ho paayi.')
      }

      const booksData = await booksResponse.json()
const issuedData = await issuedResponse.json()

const csvResponse = await fetch('/data/Books.csv')
const csvText = await csvResponse.text()

const csvData = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true
}).data

const imageMap = {}

csvData.forEach((book) => {
  const isbn = String(book.ISBN || '').trim()

  if (isbn) {
    imageMap[isbn] =
      book['Image-URL-M'] ||
      book['Image-URL-L'] ||
      book['Image-URL-S'] ||
      null
  }
})

const booksWithImages = booksData.map((book) => ({
  ...book,
  image_url:
    book.image_url ||
    imageMap[String(book.isbn || '').trim()] ||
    null
}))

setBooks(booksWithImages)
      setIssuedBooks(
  issuedData.filter((book) => !book.returnDate)
)

setReturnedBooks(
  issuedData.filter((book) => book.returnDate)
)
    } catch (err) {
      console.error(err)
      setError(
        'Data load nahi hua. Check karo backend port 5001 par running hai.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Search books by title or author
   const filteredBooks = books.filter((book) =>
  book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  book.author?.toLowerCase().includes(searchTerm.toLowerCase())
)

  const displayedBooks = filteredBooks.slice(0, 60)

  // Issue book through backend
  const handleIssueBook = async () => {
    if (!selectedBook || actionLoading) return

    try {
      setActionLoading(true)

      const response = await fetch(
        `${API_URL}/issue/${selectedBook.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Book issue nahi hui.')
      }

      alert(
        `Book issued successfully!\n\nDue Date: ${formatDate(result.dueDate)}`
      )

      setSelectedBook(null)
      await loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Return book through backend
  const handleReturnBook = async (issueId) => {
    if (actionLoading) return

    const confirmReturn = window.confirm(
      'Kya aap ye book return karna chahti hain?'
    )

    if (!confirmReturn) return

    try {
      setActionLoading(true)

      const response = await fetch(
        `${API_URL}/return/${issueId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Book return nahi hui.')
      }

      alert(
  `Book returned successfully!\n\n` +
  `Days Late: ${result.daysLate}\n` +
  `Penalty: ₹${result.penalty}`
)
      await loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const availableBooks = books.filter(
    (book) => Number(book.available) === 1
  ).length

  const overdueBooks = issuedBooks.filter((book) => {
    if (!book.dueDate) return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dueDate = new Date(book.dueDate + 'T00:00:00')
    return dueDate < today
  }).length

  return (
    <div className="dashboard">

      {/* HEADER */}
      <header className="dashboard-header">
        <div>
          <h1>K.R. Mangalam University</h1>
          <p>Smart Library Management System</p>
        </div>

        <button
          className="logout-button"
          onClick={() => {
            window.location.href = '/'
          }}
        >
          Logout
        </button>
      </header>

      {/* MAIN */}
      <main className="dashboard-content">

        <h2>Library Dashboard</h2>

        {/* STATISTICS */}
        <div className="stats-container">

          <div className="stat-card">
            <h3>Total Books</h3>
            <p>{books.length}</p>
          </div>

          <div className="stat-card">
            <h3>Available Books</h3>
            <p>{availableBooks}</p>
          </div>

          <div className="stat-card">
            <h3>Issued Books</h3>
            <p>{issuedBooks.length}</p>
          </div>

          <div className="stat-card">
            <h3>Overdue Books</h3>
            <p>{overdueBooks}</p>
          </div>

        </div>

        {/* BOOKS SECTION */}
        <section className="books-section">

          <div className="books-header">
            <h2>Books</h2>

            <input
              type="text"
              placeholder="Search books..."
              className="book-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading && (
            <p style={{ textAlign: 'center', margin: '30px' }}>
              Loading books...
            </p>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', margin: '30px' }}>
              <p style={{ color: 'red' }}>{error}</p>

              <button
                className="issue-button"
                onClick={loadData}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="books-container">

                {displayedBooks.map((book) => (
                  <div
                    className="book-card"
                    key={book.id}
                  >
                    {book.image_url && (
  <img
    src={book.image_url.replace('http://', 'https://')}
    alt={book.title}
    className="book-cover"
  />
)}
                    <h3>{book.title || 'Unknown Title'}</h3>

                    <p>
                      Author: {book.author || 'Unknown Author'}
                    </p>

                    <p>
                      ISBN: {book.isbn || 'N/A'}
                    </p>

                    <p
                      className={
                        Number(book.available) === 1
                          ? 'available'
                          : 'unavailable'
                      }
                    >
                      {Number(book.available) === 1
                        ? 'Available'
                        : 'Currently Issued'}
                    </p>

                    <button
                      className="issue-button"
                      onClick={() => setSelectedBook(book)}
                    >
                      View Details
                    </button>
                  </div>
                ))}

              </div>

              {filteredBooks.length === 0 && (
                <p style={{ textAlign: 'center', marginTop: '30px' }}>
                  No books found.
                </p>
              )}

              {filteredBooks.length > 60 && (
                <p style={{ textAlign: 'center', marginTop: '25px' }}>
                  Showing first 60 results out of {filteredBooks.length} books.
                </p>
              )}
            </>
          )}

        </section>

        {/* MY ISSUED BOOKS */}
        <section className="books-section">

          <div className="books-header">
            <h2>My Issued Books</h2>
          </div>

          {issuedBooks.length === 0 ? (
            <p style={{ textAlign: 'center', margin: '30px' }}>
              You have not issued any books yet.
            </p>
          ) : (
            <div className="books-container">

              {issuedBooks.map((book) => (
                <div
                  className="book-card"
                  key={book.issueId}
                >
                  <h3>{book.title || 'Unknown Title'}</h3>

                  <p>
                    Author: {book.author || 'Unknown'}
                  </p>

                  <p>
                    Issue Date: {formatDate(book.issueDate)}
                  </p>

                  <p>
                    Due Date: {formatDate(book.dueDate)}
                  </p>

                  <p className="available">
                    Currently Issued
                  </p>

                  <button
                    className="issue-button"
                    onClick={() => handleReturnBook(book.issueId)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Please wait...' : 'Return Book'}
                  </button>
                </div>
              ))}

            </div>
          )}

        </section>
         
        
{/* RETURNED BOOKS HISTORY */}
<section className="books-section">
  <div className="books-header">
    <h2>Returned Books History</h2>
  </div>

  {returnedBooks.length === 0 ? (
    <p style={{ textAlign: 'center', margin: '30px' }}>
      No returned books yet.
    </p>
  ) : (
    <div className="books-container">
      {returnedBooks.map((book) => (
        <div className="book-card" key={book.issueId}>
          {book.image_url && (
  <img
    src={book.image_url}
    alt={book.title}
    className="book-cover"
  />
)}
          <h3>{book.title || 'Unknown Title'}</h3>

          <p>Author: {book.author || 'Unknown'}</p>
          <p>Issue Date: {formatDate(book.issueDate)}</p>
          <p>Due Date: {formatDate(book.dueDate)}</p>
          <p>Return Date: {formatDate(book.returnDate)}</p>

          <p>
            Penalty: ₹{Number(book.penalty) || 0}
          </p>

          <p className="available">Returned</p>
        </div>
      ))}
    </div>
  )}
</section>

      </main>

      {/* BOOK DETAILS POPUP */}
      {selectedBook && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: 'white',
              width: '90%',
              maxWidth: '500px',
              padding: '30px',
              borderRadius: '16px',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setSelectedBook(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '15px',
                border: 'none',
                background: 'none',
                fontSize: '24px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>

            <h2>{selectedBook.title}</h2>

            <p>
              <strong>Author:</strong>{' '}
              {selectedBook.author || 'Unknown'}
            </p>

            <p>
              <strong>ISBN:</strong>{' '}
              {selectedBook.isbn || 'Unknown'}
            </p>

            <p
              className={
                Number(selectedBook.available) === 1
                  ? 'available'
                  : 'unavailable'
              }
            >
              {Number(selectedBook.available) === 1
                ? 'Available'
                : 'Currently Issued'}
            </p>

            {Number(selectedBook.available) === 1 ? (
              <button
                className="issue-button"
                onClick={handleIssueBook}
                disabled={actionLoading}
              >
                {actionLoading ? 'Issuing...' : 'Issue Book'}
              </button>
            ) : (
              <p>This book is already issued.</p>
            )}

          </div>
        </div>
      )}

    </div>
  )
}

export default Dashboard