import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BookCard from '../components/BookCard'

const CATEGORIES = [
  'All',
  'Fiction',
  'Educational',
  'Religious & Spiritual',
  'Poetry',
  'Graphic Novels & Comics',
]
const RATINGS = ['All', '5 stars', '4 stars', '3 stars', '2 stars', '1 star']

// Mock data — replace with Open Library API
const MOCK_BOOKS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  title: 'Book name',
  author: 'Author',
  rating: Math.floor(Math.random() * 3) + 3,
  coverUrl: null,
}))

const SearchPage = () => {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedRating, setSelectedRating] = useState('All')
  const [authorTags, setAuthorTags] = useState([])
  const [authorInput, setAuthorInput] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = 10

  const addAuthorTag = e => {
    if (e.key === 'Enter' && authorInput.trim()) {
      if (!authorTags.includes(authorInput.trim())) {
        setAuthorTags(prev => [...prev, authorInput.trim()])
      }
      setAuthorInput('')
    }
  }

  const removeAuthorTag = tag => {
    setAuthorTags(prev => prev.filter(t => t !== tag))
  }

  const resetFilters = () => {
    setSelectedCategory('All')
    setSelectedRating('All')
    setAuthorTags([])
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

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
            {/* Categories */}
            <div>
              <div
                className="text-xs font-bold text-white px-3 py-2 rounded-t-lg"
                style={{ backgroundColor: '#8B7355' }}
              >
                Categories
              </div>
              <div className="border border-t-0 border-gray-200 rounded-b-lg p-3 space-y-2">
                {CATEGORIES.map(cat => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === cat}
                      onChange={() => setSelectedCategory(cat)}
                      className="w-3.5 h-3.5 accent-amber-700"
                    />
                    <span className="text-xs text-gray-600">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

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
          <div className="flex items-center justify-between mb-6">
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
            >
              Books
            </h1>
          </div>

          {/* Book Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {MOCK_BOOKS.map(book => (
              <BookCard key={book.id} book={book} onClick={() => navigate('/bookdetail')} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 mt-12">
            {[1, 2, 3, '...', totalPages].map((page, i) => (
              <button
                key={i}
                onClick={() => typeof page === 'number' && setCurrentPage(page)}
                className="w-9 h-9 rounded-full text-sm font-medium flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: currentPage === page ? '#8B7355' : 'transparent',
                  color: currentPage === page ? '#fff' : '#666',
                  border: currentPage === page ? 'none' : '1px solid #e5e7eb',
                }}
              >
                {page}
              </button>
            ))}
            <button
              className="w-9 h-9 rounded-full text-sm flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-50"
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            >
              ›
            </button>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}

export default SearchPage
