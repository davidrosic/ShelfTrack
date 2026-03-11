import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { SearchIcon } from './Icons'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/apiFetch'

const SearchBox = () => {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Debounced fetch - uses backend universal search
  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        // Use backend universal search with auto source
        const data = await apiFetch(
          `/api/books/search-universal?q=${encodeURIComponent(q)}&limit=6&source=auto`,
          {},
          accessToken
        )
        // Map backend response to suggestion format
        setSuggestions(data.books || [])
        setOpen(true)
      } catch (err) {
        console.error('[SearchBox] Failed to fetch suggestions:', err)
        setSuggestions([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmit = e => {
    e.preventDefault()
    const q = value.trim()
    if (q) {
      setOpen(false)
      navigate(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  const handlePick = book => {
    // book.id is open_library_id for external books, or book_id for local
    const id = book.open_library_id || book.book_id
    const bookData = {
      id: id,
      title: book.title,
      author: book.author,
      coverUrl: book.cover_url,
      firstPublishYear: book.first_publish_year,
      averageRating: book.average_rating ? parseFloat(book.average_rating) : null,
      ratingCount: parseInt(book.rating_count, 10) || 0,
    }
    setValue('')
    setOpen(false)
    navigate(`/bookdetail/${id}`, { state: { book: bookData } })
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        onSubmit={handleSubmit}
        className="flex items-center w-full px-4 py-2 rounded-full border border-gray-200 bg-gray-50"
      >
        <SearchIcon />
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Need help finding your book?"
          className="ml-2 flex-1 bg-transparent text-sm text-gray-600 placeholder-gray-400 focus:outline-none min-w-0"
        />
      </form>

      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 overflow-hidden">
          {suggestions.map(book => (
            <li key={book.open_library_id || book.book_id}>
              <button
                type="button"
                onMouseDown={() => handlePick(book)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
              >
                {book.cover_url ? (
                  <img
                    src={book.cover_url.replace('-M.jpg', '-S.jpg')}
                    alt=""
                    className="w-8 h-11 object-cover rounded shrink-0"
                  />
                ) : (
                  <div className="w-8 h-11 rounded shrink-0 bg-gray-100" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{book.title}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {book.author || 'Unknown Author'}
                  </p>
                </div>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onMouseDown={handleSubmit}
              className="w-full px-4 py-2.5 text-xs font-medium text-center hover:bg-gray-50"
              style={{ color: '#8B7355' }}
            >
              See all results for "{value.trim()}"
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

const Navbar = ({ showSearch = true }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isLoggedIn, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef(null)

  const shouldShowSearch = showSearch && pathname !== '/mybooks' && pathname !== '/search'

  const guestNav = [
    { path: '/signin', label: 'Sign In' },
    { path: '/signup', label: 'Sign Up' },
  ]

  const loggedInNav = [
    { path: '/search', label: 'Search' },
    { path: '/mybooks', label: 'My Books' },
    {
      path: null,
      label: 'Log out',
      action: async () => {
        await logout()
        navigate('/')
      },
    },
  ]

  const navItems = isLoggedIn ? loggedInNav : guestNav

  // Close mobile menu on outside click
  useEffect(() => {
    const handler = e => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false)
      }
    }
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [mobileMenuOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleNavClick = item => {
    setMobileMenuOpen(false)
    if (item.action) {
      item.action()
    } else {
      navigate(item.path)
    }
  }

  return (
    <nav className="px-4 sm:px-6 lg:px-12 py-4 border-b border-gray-100">
      {/* Top row: logo + search (desktop) + nav buttons */}
      <div className="flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-lg font-bold" style={{ color: '#1C1C1C' }}>
            shelf<span style={{ color: '#D4A574' }}>Track</span>
          </span>
        </div>

        {/* Desktop search bar */}
        {shouldShowSearch && (
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <SearchBox />
          </div>
        )}

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-2 md:gap-3">
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={() => (item.action ? item.action() : navigate(item.path))}
              className="px-3 md:px-5 py-2 text-sm font-medium rounded-full transition-colors hover:bg-gray-100"
              style={{ color: '#1C1C1C' }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="sm:hidden relative" ref={mobileMenuRef}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: '#1C1C1C' }}
            >
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="absolute top-full right-4 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
              {navItems.map(item => (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  className="w-full px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-gray-50"
                  style={{ color: pathname === item.path ? '#8B7355' : '#1C1C1C' }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile search bar — second row */}
      {shouldShowSearch && (
        <div className="flex md:hidden mt-3">
          <SearchBox />
        </div>
      )}
    </nav>
  )
}

export default Navbar
