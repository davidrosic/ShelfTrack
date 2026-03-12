import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import HomePage from './HomePage'
import { apiFetch } from '../utils/apiFetch'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../utils/apiFetch', () => ({ apiFetch: vi.fn() }))

vi.mock('../components/Navbar', () => ({ default: () => <div data-testid="navbar" /> }))
vi.mock('../components/Footer', () => ({ default: () => <div data-testid="footer" /> }))

// Render BookCard as a simple button so click handlers are testable
vi.mock('../components/BookCard', () => ({
  default: ({ book, onClick }) => (
    <button data-testid="book-card" onClick={() => onClick?.(book)}>
      {book.title}
    </button>
  ),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBook(n) {
  return {
    open_library_id: `OL${n}`,
    title: `Book ${n}`,
    author: `Author ${n}`,
    cover_url: null,
    first_publish_year: 2000 + n,
    average_rating: '4.0',
    rating_count: '10',
    source: 'local',
  }
}

// 11 books so HomePage can pick 3 hero + 8 regular
const BOOKS = Array.from({ length: 11 }, (_, i) => makeBook(i + 1))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockNavigate.mockClear()
  apiFetch.mockReset()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HomePage', () => {

  // ─── Rendering ────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the hero heading', () => {
      apiFetch.mockReturnValue(new Promise(() => {}))
      renderHomePage()
      expect(screen.getByText('What Book')).toBeInTheDocument()
    })

    it('renders the testimonial quote', () => {
      apiFetch.mockReturnValue(new Promise(() => {}))
      renderHomePage()
      expect(screen.getByText(/ShelfTrack makes tracking/i)).toBeInTheDocument()
    })

    it('shows skeleton placeholders while books are loading', () => {
      apiFetch.mockReturnValue(new Promise(() => {}))
      renderHomePage()
      // 5 skeleton loaders rendered before books arrive
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders the "Explore Now" button', () => {
      apiFetch.mockReturnValue(new Promise(() => {}))
      renderHomePage()
      expect(screen.getByRole('button', { name: 'Explore Now' })).toBeInTheDocument()
    })

    it('renders section headings', () => {
      apiFetch.mockReturnValue(new Promise(() => {}))
      renderHomePage()
      expect(screen.getByText(/Award-Winning Books/i)).toBeInTheDocument()
      expect(screen.getByText(/Discover Authors/i)).toBeInTheDocument()
    })
  })

  // ─── After books load ──────────────────────────────────────────────────────

  describe('after books load', () => {
    beforeEach(() => {
      apiFetch.mockResolvedValue({ books: BOOKS })
    })

    it('renders book cards from the collection section', async () => {
      renderHomePage()
      await waitFor(() =>
        expect(screen.getAllByTestId('book-card').length).toBeGreaterThan(0)
      )
    })

    it('renders author cards', async () => {
      renderHomePage()
      await waitFor(() =>
        expect(screen.getAllByText(/Explore their books/i).length).toBeGreaterThan(0)
      )
    })

    it('removes the skeleton loaders after books arrive', async () => {
      renderHomePage()
      await waitFor(() =>
        expect(screen.getAllByTestId('book-card').length).toBeGreaterThan(0)
      )
      expect(document.querySelectorAll('.animate-pulse').length).toBe(0)
    })
  })

  // ─── Navigation ───────────────────────────────────────────────────────────

  describe('navigation', () => {
    it('"Explore Now" navigates to /search', () => {
      apiFetch.mockReturnValue(new Promise(() => {}))
      renderHomePage()
      fireEvent.click(screen.getByRole('button', { name: 'Explore Now' }))
      expect(mockNavigate).toHaveBeenCalledWith('/search')
    })

    it('clicking a book card navigates to /bookdetail/:id', async () => {
      apiFetch.mockResolvedValue({ books: BOOKS })
      renderHomePage()

      const cards = await screen.findAllByTestId('book-card')
      fireEvent.click(cards[0])

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('/bookdetail/'),
          expect.objectContaining({ state: expect.objectContaining({ book: expect.any(Object) }) })
        )
      )
    })

    it('clicking an author card navigates to /search?q=<author>', async () => {
      apiFetch.mockResolvedValue({ books: BOOKS })
      renderHomePage()

      // Wait for author cards to appear and click the first one
      const authorLinks = await screen.findAllByText(/Explore their books/i)
      fireEvent.click(authorLinks[0].parentElement)

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringMatching(/^\/search\?q=/)
        )
      )
    })
  })

  // ─── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('renders the page without crashing when the fetch fails', async () => {
      apiFetch.mockRejectedValue(new Error('Network error'))
      renderHomePage()

      // Page still shows hero heading
      await waitFor(() =>
        expect(screen.getByText('What Book')).toBeInTheDocument()
      )
    })

    it('shows skeleton placeholders (no books) when the fetch fails', async () => {
      apiFetch.mockRejectedValue(new Error('Network error'))
      renderHomePage()

      await waitFor(() =>
        // No book cards rendered
        expect(screen.queryAllByTestId('book-card').length).toBe(0)
      )
    })
  })

  // ─── API call ──────────────────────────────────────────────────────────────

  describe('API call', () => {
    it('fetches books with a broad query on mount', () => {
      apiFetch.mockReturnValue(new Promise(() => {}))
      renderHomePage()
      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/books/search')
      )
    })

    it('only fetches once on mount', () => {
      apiFetch.mockReturnValue(new Promise(() => {}))
      renderHomePage()
      expect(apiFetch).toHaveBeenCalledOnce()
    })
  })
})
