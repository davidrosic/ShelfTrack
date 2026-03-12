import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Navbar from './Navbar'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/apiFetch'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockNavigate, mockUseLocation } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseLocation: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: mockUseLocation,
  }
})

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../utils/apiFetch', () => ({ apiFetch: vi.fn() }))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderNavbar(props = {}) {
  return render(
    <MemoryRouter>
      <Navbar {...props} />
    </MemoryRouter>
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockNavigate.mockClear()
  mockUseLocation.mockReturnValue({ pathname: '/' })
  useAuth.mockReturnValue({ isLoggedIn: false, logout: vi.fn() })
  apiFetch.mockResolvedValue({ books: [] })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Navbar', () => {
  // ─── Logo ─────────────────────────────────────────────────────────────────

  describe('logo', () => {
    it('renders the shelfTrack logo text', () => {
      renderNavbar()
      expect(screen.getByText('shelf')).toBeInTheDocument()
      expect(screen.getByText('Track')).toBeInTheDocument()
    })

    it('navigates to / when the logo is clicked', () => {
      renderNavbar()
      fireEvent.click(screen.getByText('shelf').closest('div'))
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  // ─── Guest navigation ─────────────────────────────────────────────────────

  describe('when logged out', () => {
    it('shows "Sign In" and "Sign Up" buttons', () => {
      renderNavbar()
      expect(screen.getAllByRole('button', { name: 'Sign In' }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: 'Sign Up' }).length).toBeGreaterThan(0)
    })

    it('does not show "Log out"', () => {
      renderNavbar()
      expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
    })

    it('navigates to /signin when "Sign In" is clicked', () => {
      renderNavbar()
      fireEvent.click(screen.getAllByRole('button', { name: 'Sign In' })[0])
      expect(mockNavigate).toHaveBeenCalledWith('/signin')
    })

    it('navigates to /signup when "Sign Up" is clicked', () => {
      renderNavbar()
      fireEvent.click(screen.getAllByRole('button', { name: 'Sign Up' })[0])
      expect(mockNavigate).toHaveBeenCalledWith('/signup')
    })
  })

  // ─── Logged-in navigation ─────────────────────────────────────────────────

  describe('when logged in', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ isLoggedIn: true, logout: vi.fn() })
    })

    it('shows "Search", "My Books", and "Log out" buttons', () => {
      renderNavbar()
      expect(screen.getAllByRole('button', { name: 'Search' }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: 'My Books' }).length).toBeGreaterThan(0)
      expect(screen.getAllByRole('button', { name: 'Log out' }).length).toBeGreaterThan(0)
    })

    it('does not show "Sign In" or "Sign Up"', () => {
      renderNavbar()
      expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sign Up' })).not.toBeInTheDocument()
    })

    it('navigates to /search when "Search" is clicked', () => {
      renderNavbar()
      fireEvent.click(screen.getAllByRole('button', { name: 'Search' })[0])
      expect(mockNavigate).toHaveBeenCalledWith('/search')
    })

    it('navigates to /mybooks when "My Books" is clicked', () => {
      renderNavbar()
      fireEvent.click(screen.getAllByRole('button', { name: 'My Books' })[0])
      expect(mockNavigate).toHaveBeenCalledWith('/mybooks')
    })

    it('calls logout() and navigates to / when "Log out" is clicked', async () => {
      const mockLogout = vi.fn().mockResolvedValue()
      useAuth.mockReturnValue({ isLoggedIn: true, logout: mockLogout })
      renderNavbar()

      fireEvent.click(screen.getAllByRole('button', { name: 'Log out' })[0])

      await waitFor(() => expect(mockLogout).toHaveBeenCalled())
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    })
  })

  // ─── Search bar visibility ─────────────────────────────────────────────────

  describe('search bar', () => {
    // The Navbar renders two SearchBox instances (desktop + mobile), both in the DOM
    it('shows search inputs on the home page by default', () => {
      mockUseLocation.mockReturnValue({ pathname: '/' })
      renderNavbar()
      expect(screen.getAllByPlaceholderText('Need help finding your book?').length).toBeGreaterThan(
        0
      )
    })

    it('hides the search bar on /search', () => {
      mockUseLocation.mockReturnValue({ pathname: '/search' })
      renderNavbar()
      expect(screen.queryByPlaceholderText('Need help finding your book?')).not.toBeInTheDocument()
    })

    it('hides the search bar on /mybooks', () => {
      mockUseLocation.mockReturnValue({ pathname: '/mybooks' })
      renderNavbar()
      expect(screen.queryByPlaceholderText('Need help finding your book?')).not.toBeInTheDocument()
    })

    it('hides the search bar when showSearch prop is false', () => {
      renderNavbar({ showSearch: false })
      expect(screen.queryByPlaceholderText('Need help finding your book?')).not.toBeInTheDocument()
    })
  })

  it('closes the mobile menu when clicking outside', () => {
    renderNavbar()

    const toggle = screen.getByRole('button', { name: 'Toggle menu' })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.mouseDown(document.body)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  // ─── Search box behaviour ──────────────────────────────────────────────────

  describe('search box', () => {
    it('navigates to /search?q=<term> when the form is submitted', () => {
      renderNavbar()
      const input = screen.getAllByPlaceholderText('Need help finding your book?')[0]
      fireEvent.change(input, { target: { value: 'Dune' } })
      fireEvent.submit(input.closest('form'))
      expect(mockNavigate).toHaveBeenCalledWith('/search?q=Dune')
    })

    it('does not navigate when the search input is empty', () => {
      renderNavbar()
      const input = screen.getAllByPlaceholderText('Need help finding your book?')[0]
      fireEvent.submit(input.closest('form'))
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('fetches suggestions after a delay when typing', async () => {
      vi.useFakeTimers()
      renderNavbar()

      const input = screen.getAllByPlaceholderText('Need help finding your book?')[0]
      fireEvent.change(input, { target: { value: 'Hobbit' } })

      expect(apiFetch).not.toHaveBeenCalled()

      await vi.advanceTimersByTime(300) // or vi.advanceTimersByTime(300) if your Vitest version makes it sync

      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('q=Hobbit'),
        expect.any(Object),
        undefined
      )

      vi.useRealTimers()
    })
  })

  // ─── Mobile menu ──────────────────────────────────────────────────────────

  describe('mobile menu', () => {
    it('renders the hamburger toggle button', () => {
      renderNavbar()
      expect(screen.getByRole('button', { name: 'Toggle menu' })).toBeInTheDocument()
    })

    it('opens the mobile menu when the hamburger button is clicked', () => {
      renderNavbar()
      expect(screen.getByRole('button', { name: 'Toggle menu' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))
      expect(screen.getByRole('button', { name: 'Toggle menu' })).toHaveAttribute(
        'aria-expanded',
        'true'
      )
    })

    it('closes the mobile menu when the hamburger button is clicked again', () => {
      renderNavbar()
      fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))
      fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }))
      expect(screen.getByRole('button', { name: 'Toggle menu' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    })
  })
})
