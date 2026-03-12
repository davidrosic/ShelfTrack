import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SignUpPage from './SignUpPage'
import { apiFetch } from '../utils/apiFetch'

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

vi.mock('../utils/apiFetch', () => ({ apiFetch: vi.fn() }))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderSignUp() {
  return render(
    <MemoryRouter>
      <SignUpPage />
    </MemoryRouter>
  )
}

function fillForm({
  firstName = 'John',
  lastName = 'Doe',
  username = 'johndoe',
  email = 'john@test.com',
  password = 'password123',
  confirmPassword = 'password123',
  agreeTerms = true,
} = {}) {
  fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: firstName } })
  fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: lastName } })
  fireEvent.change(screen.getByPlaceholderText('Choose a username'), { target: { value: username } })
  fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText('Password (min 8 characters)'), { target: { value: password } })
  fireEvent.change(screen.getByPlaceholderText('Re-enter your password'), { target: { value: confirmPassword } })
  if (agreeTerms) {
    fireEvent.click(screen.getByRole('checkbox'))
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockNavigate.mockClear()
  mockLogin.mockReset()
  apiFetch.mockReset()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SignUpPage', () => {

  // ─── Rendering ───────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('shows the "Get Started Now" heading', () => {
      renderSignUp()
      expect(screen.getByText('Get Started Now')).toBeInTheDocument()
    })

    it('renders all form fields', () => {
      renderSignUp()
      expect(screen.getByPlaceholderText('First name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Last name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Choose a username')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Password (min 8 characters)')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Re-enter your password')).toBeInTheDocument()
    })

    it('renders the terms checkbox unchecked by default', () => {
      renderSignUp()
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })

    it('renders the Sign up button', () => {
      renderSignUp()
      expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
    })

    it('renders the Sign In navigation link', () => {
      renderSignUp()
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    })
  })

  // ─── Form inputs ─────────────────────────────────────────────────────────────

  describe('form inputs', () => {
    it('updates each text field when typed', () => {
      renderSignUp()
      const fields = [
        { placeholder: 'First name', value: 'Alice' },
        { placeholder: 'Last name', value: 'Smith' },
        { placeholder: 'Choose a username', value: 'asmith' },
        { placeholder: 'Enter your email', value: 'alice@test.com' },
      ]
      fields.forEach(({ placeholder, value }) => {
        const input = screen.getByPlaceholderText(placeholder)
        fireEvent.change(input, { target: { value } })
        expect(input.value).toBe(value)
      })
    })

    it('toggles the terms checkbox when clicked', () => {
      renderSignUp()
      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)
      expect(checkbox).toBeChecked()
      fireEvent.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })
  })

  // ─── Client-side validation ───────────────────────────────────────────────────

  describe('client-side validation', () => {
    it('shows an error when passwords do not match', async () => {
      renderSignUp()
      fillForm({ password: 'abc12345', confirmPassword: 'different', agreeTerms: false })
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    })

    it('does not call apiFetch when passwords do not match', () => {
      renderSignUp()
      fillForm({ password: 'abc12345', confirmPassword: 'different', agreeTerms: false })
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('shows an error when terms are not agreed', async () => {
      renderSignUp()
      fillForm({ agreeTerms: false })
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(await screen.findByText('You must agree to the terms & policy')).toBeInTheDocument()
    })

    it('does not call apiFetch when terms are not agreed', () => {
      renderSignUp()
      fillForm({ agreeTerms: false })
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('password mismatch is checked before terms', async () => {
      renderSignUp()
      // Both invalid — password check should fire first
      fillForm({ password: 'abc', confirmPassword: 'xyz', agreeTerms: false })
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
      expect(screen.queryByText('You must agree to the terms & policy')).not.toBeInTheDocument()
    })
  })

  // ─── Successful registration ──────────────────────────────────────────────────

  describe('successful registration', () => {
    beforeEach(() => {
      apiFetch.mockResolvedValue({})
      mockLogin.mockResolvedValue()
    })

    it('calls apiFetch with the correct registration data', async () => {
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
        '/api/users/register',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"email":"john@test.com"'),
        })
      ))
    })

    it('auto-logs in after successful registration', async () => {
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('john@test.com', 'password123'))
    })

    it('navigates to / after successful registration', async () => {
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    })

    it('shows "Creating account…" while loading', async () => {
      apiFetch.mockReturnValue(new Promise(() => {})) // never resolves
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(await screen.findByRole('button', { name: 'Creating account…' })).toBeInTheDocument()
    })

    it('disables the button while loading', async () => {
      apiFetch.mockReturnValue(new Promise(() => {}))
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(await screen.findByRole('button', { name: 'Creating account…' })).toBeDisabled()
    })
  })

  // ─── Server-side errors ───────────────────────────────────────────────────────

  describe('server-side errors', () => {
    it('shows a generic error when registration fails with a message', async () => {
      apiFetch.mockRejectedValue(new Error('Email already in use'))
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(await screen.findByText('Email already in use')).toBeInTheDocument()
    })

    it('shows "Registration failed" when error has no message', async () => {
      apiFetch.mockRejectedValue(new Error())
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(await screen.findByText('Registration failed')).toBeInTheDocument()
    })

    it('shows field-level errors when the server returns validation errors', async () => {
      const err = new Error('Validation failed')
      err.errors = { email: ['Email already taken'], username: ['Username is taken'] }
      apiFetch.mockRejectedValue(err)
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(await screen.findByText('Email already taken')).toBeInTheDocument()
      expect(screen.getByText('Username is taken')).toBeInTheDocument()
    })

    it('shows the "Please fix the errors below" summary message for field errors', async () => {
      const err = new Error('Validation failed')
      err.errors = { password: ['Password too short'] }
      apiFetch.mockRejectedValue(err)
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      expect(await screen.findByText('Please fix the errors below')).toBeInTheDocument()
    })

    it('re-enables the button after a failed registration', async () => {
      apiFetch.mockRejectedValue(new Error('Server error'))
      renderSignUp()
      fillForm()
      fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
      await screen.findByText('Server error')
      expect(screen.getByRole('button', { name: 'Sign up' })).not.toBeDisabled()
    })
  })

  // ─── Navigation ───────────────────────────────────────────────────────────────

  describe('navigation', () => {
    it('navigates to /signin when the Sign In button is clicked', () => {
      renderSignUp()
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
      expect(mockNavigate).toHaveBeenCalledWith('/signin')
    })
  })
})
