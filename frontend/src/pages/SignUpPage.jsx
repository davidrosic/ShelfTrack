import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookshelfIllustration from '../components/BookshelfIllustration'
import { GoogleIcon, AppleIcon } from '../components/Icons'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/apiFetch'

const SignUpPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  })
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!formData.agreeTerms) {
      setError('You must agree to the terms & policy')
      return
    }
    setError(null)
    setFieldErrors({})
    setLoading(true)
    try {
      await apiFetch('/api/users/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      })
      // Auto-login after successful registration
      await login(formData.email, formData.password)
      navigate('/')
    } catch (err) {
      // Check if it's a validation error with field details
      if (err.errors) {
        setFieldErrors(err.errors)
        setError('Please fix the errors below')
      } else {
        setError(err.message || 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const field = key => ({
    value: formData[key],
    onChange: e => setFormData({ ...formData, [key]: e.target.value }),
  })

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Left - Dark Form */}
        <div
          className="flex-1 flex flex-col justify-center px-12 lg:px-20"
          style={{ backgroundColor: '#1C1C1C' }}
        >
          <div className="max-w-md w-full mx-auto">
            <h1
              className="text-4xl font-bold text-white mb-10"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Get Started Now
            </h1>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm text-gray-300 mb-1.5">First name</label>
                  <input
                    type="text"
                    placeholder="First name"
                    className={`w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors ${fieldErrors.firstName ? 'border-red-500' : ''}`}
                    style={{ backgroundColor: 'transparent', borderColor: fieldErrors.firstName ? '#ef4444' : '#3a3a3a' }}
                    {...field('firstName')}
                  />
                  {fieldErrors.firstName && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.firstName.join(', ')}</p>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-300 mb-1.5">Last name</label>
                  <input
                    type="text"
                    placeholder="Last name"
                    className={`w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors ${fieldErrors.lastName ? 'border-red-500' : ''}`}
                    style={{ backgroundColor: 'transparent', borderColor: fieldErrors.lastName ? '#ef4444' : '#3a3a3a' }}
                    {...field('lastName')}
                  />
                  {fieldErrors.lastName && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.lastName.join(', ')}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Username</label>
                <input
                  type="text"
                  placeholder="Choose a username"
                  className={`w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors ${fieldErrors.username ? 'border-red-500' : ''}`}
                  style={{ backgroundColor: 'transparent', borderColor: fieldErrors.username ? '#ef4444' : '#3a3a3a' }}
                  {...field('username')}
                />
                {fieldErrors.username && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.username.join(', ')}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Email address</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className={`w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors ${fieldErrors.email ? 'border-red-500' : ''}`}
                  style={{ backgroundColor: 'transparent', borderColor: fieldErrors.email ? '#ef4444' : '#3a3a3a' }}
                  {...field('email')}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.email.join(', ')}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="Password (min 8 characters)"
                  className={`w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors ${fieldErrors.password ? 'border-red-500' : ''}`}
                  style={{ backgroundColor: 'transparent', borderColor: fieldErrors.password ? '#ef4444' : '#3a3a3a' }}
                  {...field('password')}
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.password.join(', ')}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  placeholder="Re-enter your password"
                  className="w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors"
                  style={{ backgroundColor: 'transparent', borderColor: '#3a3a3a' }}
                  {...field('confirmPassword')}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 mt-5 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-amber-700"
                checked={formData.agreeTerms}
                onChange={e => setFormData({ ...formData, agreeTerms: e.target.checked })}
              />
              <span className="text-xs text-gray-400">I agree to the terms & policy</span>
            </label>

            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm mt-6 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: '#8B7355' }}
            >
              {loading ? 'Creating account…' : 'Sign up'}
            </button>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500">or</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            <p className="text-center text-sm text-gray-400 mt-8">
              Have an account?{' '}
              <button
                onClick={() => navigate('/signin')}
                className="font-semibold hover:underline"
                style={{ color: '#D4A574' }}
              >
                Sign In
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

export default SignUpPage
