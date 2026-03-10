import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import StarRating from '../components/StarRating'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/apiFetch'

const STATUS_OPTIONS = [
  { value: 'want_to_read', label: 'Want to read', color: '#8B7355' },
  { value: 'reading', label: 'Currently reading', color: '#2563EB' },
  { value: 'read', label: 'Read', color: '#059669' },
]

const BookDetailPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { accessToken } = useAuth()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [userRating, setUserRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch('/api/books/' + id)
      .then(data => { if (!cancelled) setBook(data.book) })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const handleSave = async () => {
    if (!selectedStatus) return
    setSaveError(null)
    setSaving(true)
    try {
      const body = { bookId: book.book_id, status: selectedStatus }
      if (userRating > 0) body.rating = userRating
      if (reviewText.trim()) body.review = reviewText.trim()
      await apiFetch('/api/user-books', { method: 'POST', body: JSON.stringify(body) }, accessToken)
      setSaved(true)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-white"><Navbar />
      <div className="flex justify-center py-40">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#8B7355', borderTopColor: 'transparent' }} />
      </div>
    </div>
  )

  if (error || !book) return (
    <div className="min-h-screen bg-white"><Navbar />
      <div className="text-center py-40">
        <p className="text-sm text-red-500 mb-4">{error || 'Book not found'}</p>
        <button onClick={() => navigate('/search')} className="text-xs font-medium hover:underline" style={{ color: '#8B7355' }}>Back to search</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="px-6 lg:px-12 py-10 max-w-4xl mx-auto">
        <button onClick={() => navigate('/search')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-8 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to results
        </button>

        <div className="flex flex-col md:flex-row gap-8 mb-10">
          <div className="w-full md:w-64 shrink-0">
            <div className="aspect-3/4 rounded-xl overflow-hidden border border-gray-200 shadow-md">
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-6" style={{ backgroundColor: '#E8D5B7' }}>
                  <span className="text-lg font-bold text-center" style={{ color: '#5C4E35', fontFamily: "'Playfair Display', serif" }}>{book.title}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}>{book.title}</h1>
            <p className="text-sm text-gray-500 mb-1">by <span className="font-medium text-gray-700">{book.author}</span></p>
            {book.first_publish_year && <p className="text-xs text-gray-400 mb-6">First published {book.first_publish_year}</p>}

            {book.description && (
              <div className="mb-8">
                <h2 className="text-sm font-bold mb-2" style={{ color: '#1C1C1C' }}>Description</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{book.description}</p>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-sm font-bold mb-3" style={{ color: '#1C1C1C' }}>Add to your library</h2>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { setSelectedStatus(opt.value); setSaved(false) }}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                    style={{ backgroundColor: selectedStatus === opt.value ? opt.color : 'transparent', color: selectedStatus === opt.value ? '#fff' : '#666', border: '1.5px solid ' + (selectedStatus === opt.value ? opt.color : '#d1d5db') }}>
                    {selectedStatus === opt.value && <span className="mr-1">&#10003;</span>}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-bold mb-2" style={{ color: '#1C1C1C' }}>Your rating</h2>
              <StarRating rating={userRating} size={24} interactive onChange={setUserRating} />
            </div>

            <div className="mb-6">
              {!showReviewForm ? (
                <button onClick={() => setShowReviewForm(true)} className="text-sm font-medium hover:underline" style={{ color: '#8B7355' }}>+ Write a review</button>
              ) : (
                <div>
                  <h2 className="text-sm font-bold mb-2" style={{ color: '#1C1C1C' }}>Your review</h2>
                  <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="What did you think about this book?" rows={4} className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-amber-600 resize-none transition-colors" />
                </div>
              )}
            </div>

            <button onClick={handleSave} disabled={!selectedStatus || saving}
              className="px-8 py-3 rounded-lg text-white text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#8B7355' }}>
              {saving ? 'Saving...' : saved ? '✓ Saved to library' : 'Save to library'}
            </button>
            {!selectedStatus && <p className="text-xs text-gray-400 mt-2">Select a reading status to save</p>}
            {saveError && <p className="text-xs text-red-500 mt-2">{saveError}</p>}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default BookDetailPage
