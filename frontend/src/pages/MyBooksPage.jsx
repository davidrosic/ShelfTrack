import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BookCard from '../components/BookCard'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/apiFetch'

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'want_to_read', label: 'Want to read' },
  { value: 'reading', label: 'Currently reading' },
  { value: 'read', label: 'Finished' },
]

const MyBooksPage = () => {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [activeTab, setActiveTab] = useState('all')
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadShelf = useCallback(() => {
    setLoading(true)
    setError(null)
    const url = activeTab === 'all' ? '/api/user-books' : '/api/user-books?status=' + activeTab
    apiFetch(url, {}, accessToken)
      .then(data => {
        setBooks(
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
        )
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [activeTab, accessToken])

  useEffect(() => { loadShelf() }, [loadShelf])

  const counts = {
    all: books.length,
    want_to_read: books.filter(b => b.status === 'want_to_read').length,
    reading: books.filter(b => b.status === 'reading').length,
    read: books.filter(b => b.status === 'read').length,
  }

  const filteredBooks = activeTab === 'all' ? books : books.filter(b => b.status === activeTab)

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="flex px-6 lg:px-12 py-8 gap-8">
        {/* ===== SIDEBAR ===== */}
        <aside className="hidden lg:block w-56 shrink-0">
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}>
            My Library
          </h2>

          <div className="mb-6">
            <div className="text-xs font-bold text-white px-3 py-2 rounded-t-lg" style={{ backgroundColor: '#8B7355' }}>
              General
            </div>
            <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors"
                  style={{
                    backgroundColor: activeTab === tab.value ? '#F5E6D3' : 'transparent',
                    color: activeTab === tab.value ? '#5C4E35' : '#666',
                    fontWeight: activeTab === tab.value ? '600' : '400',
                  }}
                >
                  <span>{tab.label}</span>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: activeTab === tab.value ? '#8B7355' : '#e5e7eb', color: activeTab === tab.value ? '#fff' : '#666' }}>
                    {counts[tab.value]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => navigate('/search')}
            className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: '#8B7355' }}>
            + Add Books
          </button>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="flex-1">
          {/* Mobile tabs */}
          <div className="lg:hidden flex gap-2 mb-6 overflow-x-auto pb-2">
            {STATUS_TABS.map(tab => (
              <button key={tab.value} onClick={() => setActiveTab(tab.value)}
                className="shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor: activeTab === tab.value ? '#8B7355' : 'transparent',
                  color: activeTab === tab.value ? '#fff' : '#666',
                  border: '1px solid ' + (activeTab === tab.value ? '#8B7355' : '#d1d5db'),
                }}>
                {tab.label} ({counts[tab.value]})
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}>
              {STATUS_TABS.find(t => t.value === activeTab)?.label || 'All Books'}
            </h1>
            <span className="text-xs text-gray-400">
              {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
            </span>
          </div>

          {loading && (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#8B7355', borderTopColor: 'transparent' }} />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-20">
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <button onClick={loadShelf} className="text-xs font-medium hover:underline" style={{ color: '#8B7355' }}>Try again</button>
            </div>
          )}

          {!loading && !error && filteredBooks.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#F5E6D3' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8B7355" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-4">No books in this category yet</p>
              <button onClick={() => navigate('/search')} className="px-6 py-2 rounded-full text-sm font-medium text-white transition-all hover:brightness-110" style={{ backgroundColor: '#8B7355' }}>
                Browse books
              </button>
            </div>
          )}

          {!loading && !error && filteredBooks.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredBooks.map(book => (
                <BookCard key={book.userBookId} book={book} showStatus onClick={() => navigate('/bookdetail/' + book.id)} />
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  )
}

export default MyBooksPage
