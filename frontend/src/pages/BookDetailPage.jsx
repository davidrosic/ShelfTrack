import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import StarRating from '../components/StarRating'

// Mock data — replace with API fetch by book ID
const MOCK_BOOK = {
  id: 1,
  title: 'Forget a mentor (Find a Sponsor)',
  author: 'Sylvia Ann Hewlett',
  firstPublishYear: 2013,
  description:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam eu turpis molestie, dictum est a, mattis tellus. Sed dignissim, metus nec fringilla accumsan, risus sem sollicitudin lacus, ut interdum tellus elit sed risus. Maecenas eget condimentum velit, sit amet feugiat lectus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Praesent auctor purus luctus enim egestas, ac scelerisque ante pulvinar. Donec ut rhoncus ex. Suspendisse ac rhoncus nisl, sit amet tempor ipsum. Consectetur adipiscing elit rhoncus id vulputate.',
  coverUrl: null,
  pageCount: 256,
  genre: 'Business',
}

const STATUS_OPTIONS = [
  { value: 'want_to_read', label: 'Want to read', color: '#8B7355' },
  { value: 'reading', label: 'Currently reading', color: '#2563EB' },
  { value: 'read', label: 'Read', color: '#059669' },
]

const BookDetailPage = () => {
  const navigate = useNavigate()
  const [book] = useState(MOCK_BOOK)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [userRating, setUserRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // TODO: POST to your API — save book + status + rating + review to user_books
    setSaved(true)
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="px-6 lg:px-12 py-10 max-w-4xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-8 transition-colors"
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to results
        </button>

        {/* ===== BOOK HEADER ===== */}
        <div className="flex flex-col md:flex-row gap-8 mb-10">
          {/* Cover */}
          <div className="w-full md:w-64 shrink-0">
            <div className="aspect-3/4 rounded-xl overflow-hidden border border-gray-200 shadow-md">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center p-6"
                  style={{ backgroundColor: '#E8D5B7' }}
                >
                  <span
                    className="text-lg font-bold text-center"
                    style={{ color: '#5C4E35', fontFamily: "'Playfair Display', serif" }}
                  >
                    {book.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
            >
              {book.title}
            </h1>
            <p className="text-sm text-gray-500 mb-1">
              by <span className="font-medium text-gray-700">{book.author}</span>
            </p>
            <p className="text-xs text-gray-400 mb-6">
              First published {book.firstPublishYear} · {book.pageCount} pages · {book.genre}
            </p>

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-sm font-bold mb-2" style={{ color: '#1C1C1C' }}>
                Description
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">{book.description}</p>
            </div>

            {/* ===== STATUS SELECTION ===== */}
            <div className="mb-6">
              <h2 className="text-sm font-bold mb-3" style={{ color: '#1C1C1C' }}>
                Add to your library
              </h2>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedStatus(opt.value)}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: selectedStatus === opt.value ? opt.color : 'transparent',
                      color: selectedStatus === opt.value ? '#fff' : '#666',
                      border: `1.5px solid ${selectedStatus === opt.value ? opt.color : '#d1d5db'}`,
                    }}
                  >
                    {selectedStatus === opt.value && <span className="mr-1">✓</span>}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ===== RATING ===== */}
            <div className="mb-6">
              <h2 className="text-sm font-bold mb-2" style={{ color: '#1C1C1C' }}>
                Your rating
              </h2>
              <StarRating rating={userRating} size={24} interactive onChange={setUserRating} />
            </div>

            {/* ===== REVIEW ===== */}
            <div className="mb-6">
              {!showReviewForm ? (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="text-sm font-medium hover:underline"
                  style={{ color: '#8B7355' }}
                >
                  + Write a review
                </button>
              ) : (
                <div>
                  <h2 className="text-sm font-bold mb-2" style={{ color: '#1C1C1C' }}>
                    Your review
                  </h2>
                  <textarea
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    placeholder="What did you think about this book?"
                    rows={4}
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-amber-600 resize-none transition-colors"
                  />
                </div>
              )}
            </div>

            {/* ===== SAVE BUTTON ===== */}
            <button
              onClick={handleSave}
              disabled={!selectedStatus}
              className="px-8 py-3 rounded-lg text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#8B7355' }}
            >
              {saved ? '✓ Saved to library' : 'Save to library'}
            </button>
            {!selectedStatus && (
              <p className="text-xs text-gray-400 mt-2">Select a reading status to save</p>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default BookDetailPage
