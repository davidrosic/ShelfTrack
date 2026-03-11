import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookshelfIllustration from '../components/BookshelfIllustration'
import { GoogleIcon, AppleIcon } from '../components/Icons'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

const SignInPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      await login(formData.email, formData.password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Left - Light Form */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-20 bg-white">
          <div className="max-w-md w-full mx-auto">
            <h1
              className="text-3xl sm:text-4xl font-bold mb-2"
              style={{ fontFamily: "'Playfair Display', serif", color: '#1C1C1C' }}
            >
              Welcome back!
            </h1>
            <p className="text-sm text-gray-500 mb-10">
              Enter your Credentials to access your account
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Email address</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-600 transition-colors"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm text-gray-700">Password</label>
                  <button className="text-xs hover:underline" style={{ color: '#D4A574' }}>
                    forgot password
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-600 transition-colors"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm mt-6 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: '#8B7355' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <p className="text-center text-sm text-gray-500 mt-8">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="font-semibold hover:underline"
                style={{ color: '#D4A574' }}
              >
                Sign Up
              </button>
            </p>
          </div>
        </div>

        {/* Right - Illustration */}
        <div
          className="hidden lg:flex flex-1 items-center justify-center"
          style={{ backgroundColor: '#E8D5B7' }}
        >
          <BookshelfIllustration />
        </div>
      </div>
    </div>
  )
}

export default SignInPage
