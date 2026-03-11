import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BookCard from '../components/BookCard'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/apiFetch'
import { mapBookFromAPI, mapBookForNavigation, getBookUrlId } from '../utils/bookMapper'

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'want_to_read', label: 'Want to read' },
  { value: 'reading', label: 'Currently reading' },
  { value: 'read', label: 'Finished' },
]

const RATINGS = ['All', '5', '4', '3', '2', '1']

const MyBooksPage = () => {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [activeTab, setActiveTab] = useState('all')
  const [books, setBooks] = useState([])
  const [counts, setCounts] = useState({ all: 0, want_to_read: 0, reading: 0, read: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filterTitle, setFilterTitle] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterRating, setFilterRating] = useState('All')

  // Mobile filter visibility
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const resetFilters = () => {
    setFilterTitle('')
    setFilterAuthor('')
    setFilterYear('')
    setFilterRating('All')
  }

  // Count active filters
  const activeFilterCount = [
    filterTitle !== '',
    filterAuthor !== '',
    filterYear !== '',
    filterRating !== 'All',
  ].filter(Boolean).length

  const loadStats = useCallback(() => {
    apiFetch('/api/user-books/stats', {}, accessToken)
      .then(data => {
        setCounts({
          all: data.stats.total,
          want_to_read: data.stats.wantToRead,
          reading: data.stats.reading,
          read: data.stats.read,
        })
      })
      .catch(err => {
        // non-critical, don't show UI error for stats, but log for debugging
        console.error('[MyBooks] Failed to load stats:', err)
      })
  }, [accessToken])

  const loadShelf = useCallback(() => {
    setLoading(true)
    setError(null)
    const url = activeTab === 'all' ? '/api/user-books' : '/api/user-books?status=' + activeTab
    apiFetch(url, {}, accessToken)
      .then(data => {
        setBooks((data.shelf || []).map(mapBookFromAPI))
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [activeTab, accessToken])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    loadShelf()
  }, [loadShelf])

  const filteredBooks = books.filter(book => {
    if (filterTitle && !book.title.toLowerCase().includes(filterTitle.toLowerCase())) return false
    if (filterAuthor && !book.author.toLowerCase().includes(filterAuthor.toLowerCase())) return false
    if (filterYear && book.firstPublishYear && book.firstPublishYear < parseInt(filterYear)) return false
    if (filterRating !== 'All' && (book.rating || 0) < parseInt(filterRating)) return false
    return true
  })

  const handleRemove = book => {
    apiFetch(`/api/user-books/${book.userBookId}`, { method: 'DELETE' }, accessToken)
      .then(() => {
        setBooks(prev => prev.filter(b => b.userBookId !== book.userBookId))
        loadStats()
      })
      .catch(err => setError(err.message))
  }

  const handleBookClick = book => {
    navigate('/bookdetail/' + getBookUrlId(book), {
      state: { book: mapBookForNavigation(book) },
    })
  }

  // Filter panel content - reused for desktop sidebar and mobile drawer
  const FilterContent = () => (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <div className="text-xs font-bold text-white px-3 py-2 rounded-t-lg" style={{ backgroundColor: '#8B7355' }}>
          Title
        </div>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-3">
          <input
            type="text"
            placeholder="Search title..."
            value={filterTitle}
            onChange={e => setFilterTitle(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-amber-600"
          />
        </div>
      </div>

      {/* Author */}
      <div>
        <div className="text-xs font-bold text-white px-3 py-2 rounded-t-lg" style={{ backgroundColor: '#8B7355' }}>
          Author
        </div>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-3">
          <input
            type="text"
            placeholder="Search author..."
            value={filterAuthor}
            onChange={e => setFilterAuthor(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-amber-600"
          />
        </div>
      </div>

      {/* Year published from */}
      <div>
        <div className="text-xs font-bold text-white px-3 py-2 rounded-t-lg" style={{ backgroundColor: '#8B7355' }}>
          Published from year
        </div>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-3">
          <input
            type="number"
            placeholder="e.g. 2000"
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-amber-600"
            min="0"
            max="2100"
          />
        </div>
      </div>

      {/* Rating */}
      <div>
        <div className="text-xs font-bold text-white px-3 py-2 rounded-t-lg" style={{ backgroundColor: '#8B7355' }}>
          Min. rating
        </div>
        <div className="border border-t-0 border-gray-200 rounded-b-lg p-3 space-y-2">
          {RATINGS.map(r => (
            <label key={r} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mybooks-rating"
                checked={filterRating === r}
                onChange={() => setFilterRating(r)}
                className="w-3.5 h-3.5 accent-amber-700"
              />
              <span className="text-xs text-gray-600">
                {r === 'All' ? 'All' : `${r} star${r !== '1' ? 's' : ''} & up`}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="flex px-4 sm:px-6 lg:px-12 py-6 sm:py-8 gap-8">
        {/* ===== SIDEBAR (Desktop) ===== */}
        <aside className="hidden lg:block w-56 shrink-0">
          <h2
            className="text-xl font-bold mb-6"
            style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
          >
            My Library
          </h2>

          <div className="mb-6">
            <div
              className="text-xs font-bold text-white px-3 py-2 rounded-t-lg"
              style={{ backgroundColor: '#8B7355' }}
            >
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
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{
                      backgroundColor: activeTab === tab.value ? '#8B7355' : '#e5e7eb',
                      color: activeTab === tab.value ? '#fff' : '#666',
                    }}
                  >
                    {counts[tab.value]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/search')}
            className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: '#8B7355' }}
          >
            + Add Books
          </button>

          {/* Filters */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: '#1C1C1C' }}>Filter</span>
              <button
                onClick={resetFilters}
                className="text-xs font-medium hover:underline"
                style={{ color: '#D4A574' }}
              >
                Reset
              </button>
            </div>
            <FilterContent />
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {/* Mobile Header with Tabs and Filter */}
          <div className="lg:hidden mb-4 space-y-4">
            {/* Status Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className="shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: activeTab === tab.value ? '#8B7355' : 'transparent',
                    color: activeTab === tab.value ? '#fff' : '#666',
                    border: '1px solid ' + (activeTab === tab.value ? '#8B7355' : '#d1d5db'),
                  }}
                >
                  {tab.label} ({counts[tab.value]})
                </button>
              ))}
            </div>

            {/* Mobile Filter Toggle */}
            <div className="flex gap-3">
              <button
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium"
                style={{ color: '#1C1C1C' }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span
                    className="ml-1 px-2 py-0.5 rounded-full text-xs text-white"
                    style={{ backgroundColor: '#8B7355' }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => navigate('/search')}
                className="flex-1 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:brightness-110"
                style={{ backgroundColor: '#8B7355' }}
              >
                + Add Books
              </button>
            </div>
          </div>

          {/* Mobile Filters Panel */}
          {mobileFiltersOpen && (
            <div className="lg:hidden mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold" style={{ color: '#1C1C1C' }}>Filter</span>
                <button
                  onClick={resetFilters}
                  className="text-xs font-medium hover:underline"
                  style={{ color: '#D4A574' }}
                >
                  Reset
                </button>
              </div>
              <FilterContent />
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <h1
              className="text-xl sm:text-2xl font-bold truncate mr-4"
              style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
            >
              {STATUS_TABS.find(t => t.value === activeTab)?.label || 'All Books'}
            </h1>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}
            </span>
          </div>

          {loading && (
            <div className="flex justify-center py-20">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#8B7355', borderTopColor: 'transparent' }}
              />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-20">
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <button
                onClick={loadShelf}
                className="text-xs font-medium hover:underline"
                style={{ color: '#8B7355' }}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && filteredBooks.length === 0 && (
            <div className="text-center py-20">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: '#F5E6D3' }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#8B7355"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-4">No books in this category yet</p>
              <button
                onClick={() => navigate('/search')}
                className="px-6 py-2 rounded-full text-sm font-medium text-white transition-all hover:brightness-110"
                style={{ backgroundColor: '#8B7355' }}
              >
                Browse books
              </button>
            </div>
          )}

          {!loading && !error && filteredBooks.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredBooks.map(book => (
                <BookCard
                  key={book.userBookId}
                  book={book}
                  showStatus
                  showAverageRating={false}
                  onClick={() => handleBookClick(book)}
                  onRemove={handleRemove}
                />
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
