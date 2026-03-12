import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import BookDetailPage from './BookDetailPage'
import { apiFetch } from '../utils/apiFetch'
import { useAuth } from '../context/AuthContext'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// vi.hoisted ensures these are available inside vi.mock factories (which are hoisted)
const { mockNavigate, mockUseParams, mockUseLocation } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseParams: vi.fn(),
  mockUseLocation: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: mockUseParams,
    useLocation: mockUseLocation,
  }
})

vi.mock('../utils/apiFetch', () => ({ apiFetch: vi.fn() }))

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

vi.mock('../components/Navbar', () => ({ default: () => <div data-testid="navbar" /> }))
vi.mock('../components/Footer', () => ({ default: () => <div data-testid="footer" /> }))
vi.mock('../components/StarRating', () => ({
  default: ({ rating, onChange, interactive }) => (
    <div data-testid="star-rating" data-rating={rating}>
      {interactive && [1, 2, 3, 4, 5].map(s => (
        <button key={s} onClick={() => onChange(s)}>star {s}</button>
      ))}
    </div>
  ),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BOOK = {
  id: 'OL1',
  openLibraryId: 'OL1',
  bookId: null,
  title: 'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  coverUrl: null,
  firstPublishYear: 1925,
  averageRating: 4.2,
  ratingCount: 100,
  description: null,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <BookDetailPage />
    </MemoryRouter>
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockNavigate.mockClear()
  apiFetch.mockReset()
  useAuth.mockReturnValue({ accessToken: null })
  mockUseParams.mockReturnValue({ id: 'OL1' })
  mockUseLocation.mockReturnValue({ state: null })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookDetailPage', () => {

  // ─── With navigation state ─────────────────────────────────────────────────

  describe('when book is passed via navigation state', () => {
    beforeEach(() => {
      mockUseLocation.mockReturnValue({ state: { book: BOOK } })
    })

    it('renders the book title immediately without fetching', () => {
      renderPage()
      expect(screen.getByRole('heading', { name: 'The Great Gatsby' })).toBeInTheDocument()
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('renders the book author', () => {
      renderPage()
      expect(screen.getByText('F. Scott Fitzgerald')).toBeInTheDocument()
    })

    it('renders the first publish year', () => {
      renderPage()
      expect(screen.getByText('First published 1925')).toBeInTheDocument()
    })

    it('renders the cover image when coverUrl is present', () => {
      const book = { ...BOOK, coverUrl: 'https://example.com/cover.jpg' }
      mockUseLocation.mockReturnValue({ state: { book } })
      renderPage()
      expect(screen.getByRole('img', { name: 'The Great Gatsby' })).toHaveAttribute('src', 'https://example.com/cover.jpg')
    })

    it('renders title as placeholder when there is no cover', () => {
      renderPage()
      // Title text appears twice: heading + placeholder cover
      expect(screen.getAllByText('The Great Gatsby').length).toBeGreaterThanOrEqual(2)
    })

    it('renders all three status buttons', () => {
      renderPage()
      expect(screen.getByRole('button', { name: /Want to read/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Currently reading/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Read$/i })).toBeInTheDocument()
    })

    it('"Save to library" is disabled when no status is selected', () => {
      renderPage()
      expect(screen.getByRole('button', { name: 'Save to library' })).toBeDisabled()
    })

    it('shows the "Select a reading status" hint when nothing is selected', () => {
      renderPage()
      expect(screen.getByText('Select a reading status to save')).toBeInTheDocument()
    })
  })

  // ─── Without navigation state (fetch by ID) ────────────────────────────────

  describe('when there is no navigation state', () => {
    it('shows a loading spinner while fetching', () => {
      apiFetch.mockReturnValue(new Promise(() => {})) // never resolves
      renderPage()
      // Spinner is a div, check it exists by querying the animate-spin class
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('fetches the book by ID and renders it on success', async () => {
      apiFetch.mockResolvedValue({ book: {
        open_library_id: 'OL1', title: 'Fetched Book', author: 'Some Author',
        cover_url: null, first_publish_year: 2000,
        average_rating: '3.5', rating_count: '20',
      }})
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Fetched Book' })).toBeInTheDocument()
    })

    it('shows the error message and "Back to search" link when fetch fails', async () => {
      apiFetch.mockRejectedValue(new Error('Book not found'))
      renderPage()
      expect(await screen.findByText('Book not found')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back to search' })).toBeInTheDocument()
    })

    it('"Back to search" navigates to /search', async () => {
      apiFetch.mockRejectedValue(new Error('Error'))
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: 'Back to search' }))
      expect(mockNavigate).toHaveBeenCalledWith('/search')
    })
  })

  // ─── Shelf entry prefetch ──────────────────────────────────────────────────

  describe('shelf entry prefetch when logged in', () => {
    beforeEach(() => {
      mockUseLocation.mockReturnValue({ state: { book: BOOK } })
      useAuth.mockReturnValue({ accessToken: 'tok' })
    })

    it('prefetches the shelf entry for the book', async () => {
      apiFetch.mockResolvedValue({ entry: { status: 'reading', rating: 4, review: '' } })
      renderPage()
      await waitFor(() =>
        expect(apiFetch).toHaveBeenCalledWith(
          '/api/user-books/by-ol/OL1',
          {},
          'tok'
        )
      )
    })

    it('pre-selects the saved status', async () => {
      apiFetch.mockResolvedValue({ entry: { status: 'reading', rating: 0, review: '' } })
      renderPage()
      // After prefetch, "Currently reading" should show a checkmark
      expect(await screen.findByText(/✓/)).toBeInTheDocument()
    })

    it('pre-populates the review textarea when a review exists', async () => {
      apiFetch.mockResolvedValue({ entry: { status: 'read', rating: 5, review: 'Great book!' } })
      renderPage()
      const textarea = await screen.findByPlaceholderText('What did you think about this book?')
      expect(textarea.value).toBe('Great book!')
    })
  })

  // ─── Status selection ──────────────────────────────────────────────────────

  describe('status selection', () => {
    beforeEach(() => {
      mockUseLocation.mockReturnValue({ state: { book: BOOK } })
    })

    it('enables the Save button after a status is selected', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /Want to read/i }))
      expect(screen.getByRole('button', { name: 'Save to library' })).not.toBeDisabled()
    })

    it('shows a checkmark on the selected status button', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /Want to read/i }))
      // The checkmark span and label are adjacent with no text space — accessible name is "✓Want to read"
      expect(screen.getByRole('button', { name: '✓Want to read' })).toBeInTheDocument()
    })
  })

  // ─── Save to library ───────────────────────────────────────────────────────

  describe('saving to library', () => {
    beforeEach(() => {
      mockUseLocation.mockReturnValue({ state: { book: BOOK } })
    })

    it('redirects to /signin when Save is clicked while logged out', async () => {
      useAuth.mockReturnValue({ accessToken: null })
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /Want to read/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Save to library' }))
      expect(mockNavigate).toHaveBeenCalledWith('/signin')
    })

    it('calls apiFetch twice (upsert book then add to shelf) on success', async () => {
      useAuth.mockReturnValue({ accessToken: 'tok' })
      apiFetch
        .mockRejectedValueOnce(new Error('Not found'))   // shelf prefetch (not on shelf)
        .mockResolvedValueOnce({ book: { book_id: 99 } }) // upsert
        .mockResolvedValueOnce({})                         // add to shelf

      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /Want to read/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Save to library' }))

      await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3))
      expect(apiFetch).toHaveBeenNthCalledWith(
        2,
        '/api/books',
        expect.objectContaining({ method: 'POST' }),
        'tok'
      )
      expect(apiFetch).toHaveBeenNthCalledWith(
        3,
        '/api/user-books',
        expect.objectContaining({ method: 'POST' }),
        'tok'
      )
    })

    it('shows "✓ Saved to library" after a successful save', async () => {
      useAuth.mockReturnValue({ accessToken: 'tok' })
      apiFetch
        .mockRejectedValueOnce(new Error('Not found'))   // shelf prefetch
        .mockResolvedValueOnce({ book: { book_id: 99 } })
        .mockResolvedValueOnce({})

      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /Want to read/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Save to library' }))

      expect(await screen.findByRole('button', { name: '✓ Saved to library' })).toBeInTheDocument()
    })

    it('shows "Saving..." while the request is in flight', async () => {
      useAuth.mockReturnValue({ accessToken: 'tok' })
      apiFetch
        .mockRejectedValueOnce(new Error('Not found'))   // shelf prefetch
        .mockReturnValue(new Promise(() => {}))           // upsert never resolves

      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /Want to read/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Save to library' }))

      expect(await screen.findByRole('button', { name: 'Saving...' })).toBeInTheDocument()
    })

    it('shows a save error when the request fails', async () => {
      useAuth.mockReturnValue({ accessToken: 'tok' })
      apiFetch
        .mockRejectedValueOnce(new Error('Not found'))  // shelf prefetch
        .mockRejectedValue(new Error('Server error'))   // upsert fails

      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /Want to read/i }))
      fireEvent.click(screen.getByRole('button', { name: 'Save to library' }))

      expect(await screen.findByText('Server error')).toBeInTheDocument()
    })
  })

  // ─── Review form ───────────────────────────────────────────────────────────

  describe('review form', () => {
    beforeEach(() => {
      mockUseLocation.mockReturnValue({ state: { book: BOOK } })
    })

    it('shows "+ Write a review" link initially', () => {
      renderPage()
      expect(screen.getByRole('button', { name: '+ Write a review' })).toBeInTheDocument()
    })

    it('shows the review textarea after clicking "+ Write a review"', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: '+ Write a review' }))
      expect(screen.getByPlaceholderText('What did you think about this book?')).toBeInTheDocument()
    })
  })

  // ─── Navigation ────────────────────────────────────────────────────────────

  describe('navigation', () => {
    beforeEach(() => {
      mockUseLocation.mockReturnValue({ state: { book: BOOK } })
    })

    it('"Back" button calls navigate(-1)', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })
})
