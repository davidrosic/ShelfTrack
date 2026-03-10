import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BookCard from '../components/BookCard'
import { SearchIcon } from '../components/Icons'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const CATEGORIES = [
  'All',
  'Fiction',
  'Educational',
  'Religious & Spiritual',
  'Poetry',
  'Graphic Novels & Comics',
]

const CATEGORY_SUBJECTS = {
  'Fiction': 'fiction',
  'Educational': 'education',
  'Religious & Spiritual': 'religion',
  'Poetry': 'poetry',
  'Graphic Novels & Comics': 'comics',
}
const RATINGS = ['All', '5 stars', '4 stars', '3 stars', '2 stars', '1 star']

const SearchPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''

  const [inputValue, setInputValue] = useState(q)
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedRating, setSelectedRating] = useState('All')
  const [authorTags, setAuthorTags] = useState([])
  const [authorInput, setAuthorInput] = useState('')

  useEffect(() => {
    if (!q.trim()) {
      setBooks([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const subject = CATEGORY_SUBJECTS[selectedCategory]
    let url = `${API_URL}/api/books/search?q=${encodeURIComponent(q)}&limit=50`
    if (subject) url += `&subject=${subject}`

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Search failed')
        return r.json()
      })
      .then(data => {
        if (!cancelled) {
          setBooks(
            (data.books || []).map(b => ({
              id: b.open_library_id || String(b.book_id),
              olId: b.open_library_id,
              title: b.title,
              author: b.author,
              coverUrl: b.cover_url,
              firstPublishYear: b.first_publish_year || null,
              rating: b.average_rating ? parseFloat(b.average_rating) : 0,
              source: b.source,
            }))
          )
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [q, selectedCategory])

  const handleSearch = e => {
    e.preventDefault()
    const trimmed = inputValue.trim()
    if (trimmed) setSearchParams({ q: trimmed })
  }

  const addAuthorTag = e => {
    if (e.key === 'Enter' && authorInput.trim()) {
      if (!authorTags.includes(authorInput.trim())) {
        setAuthorTags(prev => [...prev, authorInput.trim()])
      }
      setAuthorInput('')
    }
  }

  const removeAuthorTag = tag => setAuthorTags(prev => prev.filter(t => t !== tag))

  const resetFilters = () => {
    setSelectedCategory('All')
    setSelectedRating('All')
    setAuthorTags([])
  }

  const visibleBooks =
    authorTags.length > 0
      ? books.filter(b =>
          authorTags.some(tag => b.author.toLowerCase().includes(tag.toLowerCase()))
        )
      : books

  const handleBookClick = book => {
    navigate(`/bookdetail/${book.id}`, { state: { book } })
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex px-6 lg:px-12 py-8 gap-8">
        {/* ===== SIDEBAR FILTERS ===== */}
        <aside className="hidden lg:block w-60 shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold" style={{ color: '#1C1C1C' }}>
              Filter Option
            </h2>
            <button
              onClick={resetFilters}
              className="text-xs font-medium hover:underline"
              style={{ color: '#D4A574' }}
            >
              Reset All
            </button>
          </div>

          <div className="space-y-5">
            {/* Author */}
            <div>
              <div
                className="text-xs font-bold text-white px-3 py-2 rounded-t-lg"
                style={{ backgroundColor: '#8B7355' }}
              >
                Author
              </div>
              <div className="border border-t-0 border-gray-200 rounded-b-lg p-3">
                <input
                  type="text"
                  placeholder="Author's name"
                  value={authorInput}
                  onChange={e => setAuthorInput(e.target.value)}
                  onKeyDown={addAuthorTag}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-amber-600 mb-2"
                />
                {authorTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {authorTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                        style={{ backgroundColor: '#F5E6D3', color: '#5C4E35' }}
                      >
                        {tag}
                        <button
                          onClick={() => removeAuthorTag(tag)}
                          className="hover:text-red-600 font-bold leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rating */}
            <div>
              <div
                className="text-xs font-bold text-white px-3 py-2 rounded-t-lg"
                style={{ backgroundColor: '#8B7355' }}
              >
                Rating
              </div>
              <div className="border border-t-0 border-gray-200 rounded-b-lg p-3 space-y-2">
                {RATINGS.map(r => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rating"
                      checked={selectedRating === r}
                      onChange={() => setSelectedRating(r)}
                      className="w-3.5 h-3.5 accent-amber-700"
                    />
                    <span className="text-xs text-gray-600">{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="flex-1">
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex items-center px-4 py-3 rounded-full border border-gray-200 bg-gray-50 gap-3">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search by title or author..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue('')
                    setSearchParams({})
                  }}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  ×
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full text-white text-xs font-semibold transition-all hover:brightness-110"
                style={{ backgroundColor: '#8B7355' }}
              >
                Search
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between mb-6">
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
            >
              {q ? `Results for "${q}"` : 'Books'}
            </h1>
            {visibleBooks.length > 0 && (
              <span className="text-xs text-gray-400">
                {visibleBooks.length} {visibleBooks.length === 1 ? 'book' : 'books'}
              </span>
            )}
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
                onClick={() => setSearchParams({ q })}
                className="text-xs font-medium hover:underline"
                style={{ color: '#8B7355' }}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && !q && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-sm">Enter a title or author above to search.</p>
            </div>
          )}

          {!loading && !error && q && visibleBooks.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-sm">No books found for "{q}".</p>
            </div>
          )}

          {!loading && !error && visibleBooks.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {visibleBooks.map(book => (
                <BookCard key={book.id} book={book} onClick={() => handleBookClick(book)} />
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  )
}

export default SearchPage
