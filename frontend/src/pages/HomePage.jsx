import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BookCard from '../components/BookCard'
import { ChevronRight } from '../components/Icons'
import { apiFetch } from '../utils/apiFetch'
import { mapBookFromAPI, mapBookForNavigation, getBookUrlId } from '../utils/bookMapper'

const AUTHOR_COLORS = ['#F5E6D3', '#E8D5B7', '#D4C4A8', '#C4B896']

// Pick `n` random items from an array
const pickRandom = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n)

const HomePage = () => {
  const navigate = useNavigate()
  const [books, setBooks] = useState([])
  const [authors, setAuthors] = useState([])

  useEffect(() => {
    // Fetch books from the DB using a broad query, then pick random ones client-side
    apiFetch('/api/books/search?q=e&limit=100')
      .then(data => {
        const allBooks = (data.books || []).map(mapBookFromAPI)
        setBooks(pickRandom(allBooks, 8))

        // Extract 4 random unique authors
        const uniqueAuthors = [...new Map(
          allBooks
            .filter(b => b.author && b.author !== 'Unknown Author')
            .map(b => [b.author, b])
        ).values()]
        setAuthors(pickRandom(uniqueAuthors, 4))
      })
      .catch(err => {
        console.error('[HomePage] Failed to load books:', err)
      })
  }, [])

  const handleBookClick = book => {
    navigate(`/bookdetail/${getBookUrlId(book)}`, { state: { book: mapBookForNavigation(book) } })
  }

  // Hero books: first 3 from the random set (or placeholders if still loading)
  const heroBooks = books.slice(0, 3)
  const placeholderColors = ['#6BA5A5', '#E8C840', '#D4956A']

  // Responsive book sizes for hero section
  const bookSizes = [
    { mobile: { w: '100px', h: '140px' }, sm: { w: '120px', h: '165px' }, md: { w: '140px', h: '190px' }, lg: { w: '180px', h: '240px' } },
    { mobile: { w: '110px', h: '155px' }, sm: { w: '135px', h: '185px' }, md: { w: '155px', h: '215px' }, lg: { w: '200px', h: '270px' } },
    { mobile: { w: '100px', h: '140px' }, sm: { w: '120px', h: '165px' }, md: { w: '140px', h: '190px' }, lg: { w: '180px', h: '240px' } },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden">
        <div className="px-4 sm:px-6 lg:px-12 pt-8 sm:pt-12 pb-16 sm:pb-20 lg:pb-28">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8 sm:gap-12">
            {/* Left content */}
            <div className="flex-1 max-w-lg">
              <h1
                className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold leading-tight mb-4 sm:mb-6"
                style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
              >
                What Book{' '}
                <span style={{ fontStyle: 'italic', fontFamily: "'Playfair Display', serif" }}>
                  Are
                </span>
                <br />
                <span className="whitespace-nowrap">
                  You Looking For<span style={{ color: '#D4A574' }}> ?</span>
                </span>
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-gray-500 mb-4 max-w-sm leading-relaxed">
                Not Sure What To Read Next?
                <br />
                Our solution will cost you 5 minutes to find your next best.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => navigate('/search')}
                  className="px-5 sm:px-6 py-2 sm:py-2.5 text-sm font-medium border-2 rounded-full transition-all hover:bg-gray-50"
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
            <div className="flex-1 flex justify-center relative w-full lg:w-auto overflow-hidden">
              <div className="flex gap-3 sm:gap-4 items-end">
                {[0, 1, 2].map(i => {
                  const book = heroBooks[i]
                  const sizes = bookSizes[i]
                  return (
                    <div
                      key={i}
                      onClick={() => book && handleBookClick(book)}
                      className="rounded-lg shadow-lg overflow-hidden cursor-pointer transition-transform hover:scale-105"
                      style={{
                        width: sizes.mobile.w,
                        height: sizes.mobile.h,
                        transform: i === 0 ? 'rotate(-5deg)' : i === 2 ? 'rotate(5deg)' : 'none',
                        backgroundColor: placeholderColors[i],
                      }}
                    >
                      {/* Responsive sizes using inline styles with media query-like approach via CSS */}
                      <style>{`
                        @media (min-width: 640px) {
                          .hero-book-${i} { width: ${sizes.sm.w} !important; height: ${sizes.sm.h} !important; }
                        }
                        @media (min-width: 768px) {
                          .hero-book-${i} { width: ${sizes.md.w} !important; height: ${sizes.md.h} !important; }
                        }
                        @media (min-width: 1024px) {
                          .hero-book-${i} { width: ${sizes.lg.w} !important; height: ${sizes.lg.h} !important; }
                        }
                      `}</style>
                      {book?.coverUrl ? (
                        <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-end justify-center p-2 sm:p-3">
                          <p className="text-[10px] sm:text-xs font-semibold text-white drop-shadow text-center">
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
        <div className="w-full h-12 sm:h-16 flex">
          {['#E74C3C','#E67E22','#F1C40F','#2ECC71','#3498DB','#9B59B6','#E74C3C','#E67E22','#F1C40F','#2ECC71'].map((c, i) => (
            <div key={i} className="flex-1 h-full" style={{ backgroundColor: c, opacity: 0.85 }} />
          ))}
        </div>
      </section>

      {/* ===== AWARD-WINNING BOOKS ===== */}
      <section className="px-4 sm:px-6 lg:px-12 py-12 sm:py-16" style={{ backgroundColor: '#FAFAFA' }}>
        <div className="mb-6 text-center">
          <h2
            className="text-base sm:text-lg font-bold mb-6"
            style={{ color: '#1C1C1C', fontFamily: "'Playfair Display', serif" }}
          >
            Explore Our Collection of Award-Winning Books
          </h2>
        </div>
        {books.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
            {books.map((book, i) => (
              <div key={book.id} className={i >= 2 ? 'hidden sm:block' : ''}>
                <BookCard
                  book={book}
                  onClick={() => handleBookClick(book)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-24 sm:w-28 h-36 sm:h-40 rounded-lg bg-gray-200 animate-pulse"
              />
            ))}
          </div>
        )}
      </section>

      {/* ===== AUTHORS ===== */}
      <section className="px-4 sm:px-6 lg:px-12 py-12 sm:py-16">
        <h2
          className="text-lg sm:text-xl font-bold mb-6 sm:mb-8"
          style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
        >
          Discover Authors You Might Love
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {authors.map((author, i) => (
            <div
              key={i}
              onClick={() => navigate(`/search?q=${encodeURIComponent(author.author)}`)}
              className="p-4 sm:p-6 rounded-xl cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              style={{ backgroundColor: AUTHOR_COLORS[i % AUTHOR_COLORS.length] }}
            >
              <h3 className="font-bold text-base sm:text-lg" style={{ color: '#1C1C1C' }}>
                {author.author}
              </h3>
              <p className="text-xs mt-1" style={{ color: '#5C4E35' }}>
                Explore their books
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== TESTIMONIAL ===== */}
      <section className="px-4 sm:px-6 lg:px-12 py-12 sm:py-16 text-center" style={{ backgroundColor: '#F5F0EB' }}>
        <div
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full mx-auto mb-4 sm:mb-6"
          style={{ backgroundColor: '#D4A574' }}
        />
        <p
          className="text-base sm:text-lg italic max-w-xl mx-auto leading-relaxed px-4"
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
