import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import HomePage from './pages/HomePage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import SearchPage from './pages/SearchPage'
import BookDetailPage from './pages/BookDetailPage'
import MyBooksPage from './pages/MyBooksPage'
import Navbar from './components/Navbar'

function FloatingNav({ isLoggedIn }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [navVisible, setNavVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setNavVisible(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const guestNav = [
    { path: '/', label: 'Home' },
    { path: '/signin', label: 'Sign In' },
    { path: '/signup', label: 'Sign Up' },
  ]

  const loggedInNav = [
    { path: '/', label: 'Home' },
    { path: '/search', label: 'Search' },
    { path: '/mybooks', label: 'My Books' },
  ]

  const navItems = isLoggedIn ? loggedInNav : guestNav

  return (
    <div
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex gap-0.5 sm:gap-1 p-1 rounded-full shadow-lg transition-all duration-300"
      style={{
        backgroundColor: 'rgba(28,28,28,0.9)',
        backdropFilter: 'blur(8px)',
        opacity: navVisible ? 1 : 0,
        transform: `translateX(-50%) translateY(${navVisible ? '0' : '-12px'})`,
        pointerEvents: navVisible ? 'auto' : 'none',
      }}
    >
      {navItems.map(item => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className="px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-full transition-all"
          style={{
            backgroundColor: location.pathname === item.path ? '#8B7355' : 'transparent',
            color: location.pathname === item.path ? '#fff' : '#999',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const { isLoggedIn, authLoading } = useAuth()

  if (authLoading) return null

  return (
    <>
      <Navbar isLoggedIn={isLoggedIn} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/bookdetail/:id" element={<BookDetailPage />} />
        <Route path="/mybooks" element={<MyBooksPage />} />
      </Routes>
    </>
  )
}
