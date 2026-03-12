import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SignInPage from './SignInPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
const mockLogin = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSignIn() {
  return render(
    <MemoryRouter>
      <SignInPage />
    </MemoryRouter>
  )
}

function fillForm({ email = 'user@test.com', password = 'password123' } = {}) {
  fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: password },
  })
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockNavigate.mockClear()
  mockLogin.mockReset()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SignInPage', () => {

  // ─── Rendering ───────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('shows the welcome heading', () => {
      renderSignIn()
      expect(screen.getByText('Welcome back!')).toBeInTheDocument()
    })

    it('renders email and password inputs', () => {
      renderSignIn()
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    })

    it('renders the Sign in button', () => {
      renderSignIn()
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    })

    it('renders the Sign Up navigation link', () => {
      renderSignIn()
      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument()
    })
  })

  // ─── Form inputs ─────────────────────────────────────────────────────────────

  describe('form inputs', () => {
    it('updates the email field when typed', () => {
      renderSignIn()
      const input = screen.getByPlaceholderText('Enter your email')
      fireEvent.change(input, { target: { value: 'hello@test.com' } })
      expect(input.value).toBe('hello@test.com')
    })

    it('updates the password field when typed', () => {
      renderSignIn()
      const input = screen.getByPlaceholderText('Password')
      fireEvent.change(input, { target: { value: 'secret' } })
      expect(input.value).toBe('secret')
    })
  })

  // ─── Submission ───────────────────────────────────────────────────────────────

  describe('form submission', () => {
    it('calls login with the entered email and password', async () => {
      mockLogin.mockResolvedValue()
      renderSignIn()
      fillForm({ email: 'a@a.com', password: 'mypass' })
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@a.com', 'mypass'))
    })

    it('navigates to / after successful login', async () => {
      mockLogin.mockResolvedValue()
      renderSignIn()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    })

    it('submits when Enter is pressed in the password field', async () => {
      mockLogin.mockResolvedValue()
      renderSignIn()
      fillForm()
      fireEvent.keyDown(screen.getByPlaceholderText('Password'), { key: 'Enter' })
      await waitFor(() => expect(mockLogin).toHaveBeenCalled())
    })

    it('shows "Signing in…" while the login request is in flight', async () => {
      mockLogin.mockReturnValue(new Promise(() => {})) // never resolves
      renderSignIn()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeInTheDocument()
    })

    it('disables the button while loading', async () => {
      mockLogin.mockReturnValue(new Promise(() => {}))
      renderSignIn()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled()
    })
  })

  // ─── Error handling ───────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('shows the error message when login fails', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid credentials'))
      renderSignIn()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
    })

    it('shows "Login failed" when the error has no message', async () => {
      mockLogin.mockRejectedValue(new Error())
      renderSignIn()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      expect(await screen.findByText('Login failed')).toBeInTheDocument()
    })

    it('clears the error on a new submission attempt', async () => {
      mockLogin
        .mockRejectedValueOnce(new Error('Invalid credentials'))
        .mockResolvedValueOnce()
      renderSignIn()
      fillForm()

      // First attempt — error appears
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      await screen.findByText('Invalid credentials')

      // Second attempt — error should clear
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      await waitFor(() =>
        expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument()
      )
    })

    it('re-enables the button after a failed login', async () => {
      mockLogin.mockRejectedValue(new Error('Bad credentials'))
      renderSignIn()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
      await screen.findByText('Bad credentials')
      expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled()
    })
  })

  // ─── Navigation ───────────────────────────────────────────────────────────────

  describe('navigation', () => {
    it('navigates to /signup when the Sign Up button is clicked', () => {
      renderSignIn()
      fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))
      expect(mockNavigate).toHaveBeenCalledWith('/signup')
    })
  })
})
