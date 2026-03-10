import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { SearchIcon } from './Icons'
import { useAuth } from '../context/AuthContext'

const OL_SEARCH = 'https://openlibrary.org/search.json'

const SearchBox = () => {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Debounced fetch
  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${OL_SEARCH}?q=${encodeURIComponent(q)}&limit=6&fields=key,title,author_name,cover_i`
        )
        const data = await res.json()
        setSuggestions(data.docs || [])
        setOpen(true)
      } catch {
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

  const handlePick = doc => {
    const olId = doc.key.split('/').pop()
    const book = {
      id: olId,
      title: doc.title,
      author: doc.author_name?.[0] || 'Unknown Author',
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    }
    setValue('')
    setOpen(false)
    navigate(`/bookdetail/${olId}`, { state: { book } })
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
          className="ml-2 flex-1 bg-transparent text-sm text-gray-600 placeholder-gray-400 focus:outline-none"
        />
      </form>

      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 overflow-hidden">
          {suggestions.map(doc => (
            <li key={doc.key}>
              <button
                type="button"
                onMouseDown={() => handlePick(doc)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
              >
                {doc.cover_i ? (
                  <img
                    src={`https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg`}
                    alt=""
                    className="w-8 h-11 object-cover rounded shrink-0"
                  />
                ) : (
                  <div className="w-8 h-11 rounded shrink-0 bg-gray-100" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {doc.author_name?.[0] || 'Unknown Author'}
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

  return (
    <nav className="px-6 lg:px-12 py-4 border-b border-gray-100">
      {/* Top row: logo + search (desktop) + buttons */}
      <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-3">
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={() => (item.action ? item.action() : navigate(item.path))}
              className="px-5 py-2 text-sm font-medium rounded-full transition-colors hover:bg-gray-100"
              style={{ color: '#1C1C1C' }}
            >
              {item.label}
            </button>
          ))}
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
