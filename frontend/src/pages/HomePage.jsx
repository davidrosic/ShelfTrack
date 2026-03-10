import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BookCard from '../components/BookCard'
import { ChevronRight } from '../components/Icons'
import { apiFetch } from '../utils/apiFetch'

const categories = [
  { name: 'Romance', count: 5, color: '#F5E6D3' },
  { name: 'Fiction', count: 120, color: '#E8D5B7' },
  { name: 'Business', count: 67, color: '#D4C4A8' },
  { name: 'Health', count: 600, color: '#C4B896' },
]

const featuredAuthors = [
  { name: 'Jonathan Rivera', color: '#D4A574' },
  { name: 'Samuel Thompson', color: '#8B7355' },
  { name: 'Michael Collins', color: '#C4956A' },
  { name: 'Benjamin Parker', color: '#6B5B3E' },
  { name: 'David Lewis', color: '#E8D5B7' },
  { name: 'Ava Robinson', color: '#A68B6B' },
  { name: 'Joachim Rivera', color: '#7A6548' },
]

// Pick `n` random items from an array
const pickRandom = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

const HomePage = () => {
  const navigate = useNavigate()
  const [books, setBooks] = useState([])

  useEffect(() => {
    // Fetch books from the DB using a broad query, then pick random ones client-side
    apiFetch('/api/books/search?q=e&limit=100')
      .then(data => {
        const mapped = (data.books || []).map(b => ({
          id: b.open_library_id || String(b.book_id),
          olId: b.open_library_id,
          title: b.title,
          author: b.author,
          coverUrl: b.cover_url,
          firstPublishYear: b.first_publish_year,
          averageRating: b.average_rating ? parseFloat(b.average_rating) : null,
          ratingCount: parseInt(b.rating_count, 10) || 0,
        }))
        setBooks(pickRandom(mapped, 8))
      })
      .catch(err => {
        console.error('[HomePage] Failed to load books:', err)
      })
  }, [])

  const handleBookClick = book => {
    const urlId = book.olId || book.id
    navigate(`/bookdetail/${urlId}`, { state: { book } })
  }

  // Hero books: first 3 from the random set (or placeholders if still loading)
  const heroBooks = books.slice(0, 3)
  const placeholderColors = ['#6BA5A5', '#E8C840', '#D4956A']

  return (
    <div className="min-h-screen bg-white">
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden">
        <div className="px-6 lg:px-12 pt-12 pb-20 lg:pb-28">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-12">
            {/* Left content */}
            <div className="flex-1 max-w-lg">
              <h1
                className="text-5xl lg:text-7xl font-bold leading-tight mb-6"
                style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
              >
                What Book{' '}
                <span style={{ fontStyle: 'italic', fontFamily: "'Playfair Display', serif" }}>
                  Are
                </span>
                <br />
                <span style={{ whiteSpace: 'nowrap' }}>
                  You Looking For<span style={{ color: '#D4A574' }}> ?</span>
                </span>
              </h1>
              <p className="text-m lg:text-xl text-gray-500 mb-4 max-w-sm leading-relaxed">
                Not Sure What To Read Next?
                <br />
                Our solution will cost you 5 minutes to find your next best.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => navigate('/search')}
                  className="px-6 py-2.5 text-sm font-medium border-2 rounded-full transition-all hover:bg-gray-50"
                  style={{ borderColor: '#1C1C1C', color: '#1C1C1C' }}
                >
                  Explore Now
                </button>
                <button
                  onClick={() => navigate('/search')}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:brightness-110"
                  style={{ backgroundColor: '#8B7355' }}
                >
                  <ChevronRight />
                </button>
              </div>
            </div>

            {/* Right - Book covers */}
            <div className="flex-1 flex justify-center relative">
              <div className="flex gap-4 items-end">
                {[0, 1, 2].map(i => {
                  const book = heroBooks[i]
                  return (
                    <div
                      key={i}
                      onClick={() => book && handleBookClick(book)}
                      className="rounded-lg shadow-lg overflow-hidden cursor-pointer"
                      style={{
                        width: i === 1 ? '200px' : '180px',
                        height: i === 1 ? '270px' : '240px',
                        transform: i === 0 ? 'rotate(-5deg)' : i === 2 ? 'rotate(5deg)' : 'none',
                        backgroundColor: placeholderColors[i],
                      }}
                    >
                      {book?.coverUrl ? (
                        <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-end justify-center p-3">
                          <p className="text-xs font-semibold text-white drop-shadow text-center">
                            {book?.title || ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Colorful gradient band */}
        <div className="w-full h-16 flex">
          {['#E74C3C','#E67E22','#F1C40F','#2ECC71','#3498DB','#9B59B6','#E74C3C','#E67E22','#F1C40F','#2ECC71'].map((c, i) => (
            <div key={i} className="flex-1 h-full" style={{ backgroundColor: c, opacity: 0.85 }} />
          ))}
        </div>
      </section>

      {/* ===== AWARD-WINNING BOOKS ===== */}
      <section className="px-6 lg:px-12 py-16" style={{ backgroundColor: '#FAFAFA' }}>
        <div className="mb-6 text-center">
          <h2
            className="text-lg font-bold mb-6"
            style={{ color: '#1C1C1C', fontFamily: "'Playfair Display', serif" }}
          >
            Explore Our Collection of Award-Winning Books
          </h2>
        </div>
        {books.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4 justify-items-center">
            {books.map(book => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => handleBookClick(book)}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-28 h-40 rounded-lg bg-gray-200 animate-pulse"
              />
            ))}
          </div>
        )}
      </section>

      {/* ===== CATEGORIES ===== */}
      <section className="px-6 lg:px-12 py-16">
        <h2
          className="text-xl font-bold mb-8"
          style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
        >
          Choose the category for your next trip
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat, i) => (
            <div
              key={i}
              onClick={() => navigate(`/search?q=${cat.name}`)}
              className="p-6 rounded-xl cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              style={{ backgroundColor: cat.color }}
            >
              <h3 className="font-bold text-lg" style={{ color: '#1C1C1C' }}>
                {cat.name}
              </h3>
              <p className="text-xs mt-1" style={{ color: '#5C4E35' }}>
                {cat.count} Book reviewed
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== TESTIMONIAL ===== */}
      <section className="px-6 lg:px-12 py-16 text-center" style={{ backgroundColor: '#F5F0EB' }}>
        <div
          className="w-14 h-14 rounded-full mx-auto mb-6"
          style={{ backgroundColor: '#D4A574' }}
        />
        <p
          className="text-lg italic max-w-xl mx-auto leading-relaxed"
          style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
        >
          "ShelfTrack makes tracking my reading progress and writing reviews incredibly simple and
          enjoyable."
        </p>
        <p className="text-sm font-semibold mt-4" style={{ color: '#8B7355' }}>
          Emily Morrison
        </p>
      </section>

      <Footer />
    </div>
  )
}

export default HomePage
