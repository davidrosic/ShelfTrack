import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import SearchPage from './SearchPage'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { apiFetch } from '../utils/apiFetch'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../utils/apiFetch', () => ({
  apiFetch: vi.fn(),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Raw API shape (before mapBookFromAPI transforms it)
const RAW_GATSBY = {
  open_library_id: 'OL1',
  title: 'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  cover_url: null,
  first_publish_year: 1925,
  average_rating: '4.2',
  rating_count: '100',
  source: 'local',
}

const RAW_DUNE = {
  open_library_id: 'OL2',
  title: 'Dune',
  author: 'Frank Herbert',
  cover_url: null,
  first_publish_year: 1965,
  average_rating: '4.8',
  rating_count: '200',
  source: 'external',
}

function renderSearchPage(query = '') {
  return render(
    <MemoryRouter initialEntries={[query ? `/search?q=${query}` : '/search']}>
      <AuthProvider>
        <SearchPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Silence AuthProvider's silentRefresh — it has no valid cookie in tests
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false }))
  // Default: searches return nothing
  apiFetch.mockResolvedValue({ books: [], hasMore: false })
  mockNavigate.mockClear()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SearchPage', () => {

  // ─── Empty state ─────────────────────────────────────────────────────────────

  it('shows prompt when nothing has been searched', () => {
    renderSearchPage()
    expect(screen.getByText('Enter a title or author above to search.')).toBeInTheDocument()
  })

  // ─── Search form ─────────────────────────────────────────────────────────────

  describe('search form', () => {
    it('does not show the clear button when the input is empty', () => {
      renderSearchPage()
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    })

    it('shows the clear button once the user types something', () => {
      renderSearchPage()
      fireEvent.change(screen.getByRole('textbox', { name: 'Search books' }), {
        target: { value: 'gatsby' },
      })
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
    })

    it('clears the input when the clear button is clicked', () => {
      renderSearchPage()
      const input = screen.getByRole('textbox', { name: 'Search books' })
      fireEvent.change(input, { target: { value: 'gatsby' } })
      fireEvent.click(screen.getByLabelText('Clear search'))
      expect(input.value).toBe('')
    })

    it('triggers a search when the form is submitted', async () => {
      renderSearchPage()
      const input = screen.getByRole('textbox', { name: 'Search books' })
      fireEvent.change(input, { target: { value: 'dune' } })
      fireEvent.submit(input.closest('form'))
      await waitFor(() => expect(apiFetch).toHaveBeenCalled())
    })
  })

  // ─── Search results ───────────────────────────────────────────────────────────

  describe('search results', () => {
    it('shows a loading spinner while fetching', () => {
      apiFetch.mockReturnValue(new Promise(() => {})) // never resolves
      renderSearchPage('gatsby')
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('shows books after a successful fetch', async () => {
      apiFetch.mockResolvedValue({ books: [RAW_GATSBY, RAW_DUNE], hasMore: false })
      renderSearchPage('gatsby')
      await waitFor(() => expect(screen.getByRole('heading', { name: 'The Great Gatsby' })).toBeInTheDocument())
      expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument()
    })

    it('shows the book count when results are present', async () => {
      apiFetch.mockResolvedValue({ books: [RAW_GATSBY, RAW_DUNE], hasMore: false })
      renderSearchPage('gatsby')
      await waitFor(() => expect(screen.getByText('2 books')).toBeInTheDocument())
    })

    it('shows singular "book" when only one result', async () => {
      apiFetch.mockResolvedValue({ books: [RAW_GATSBY], hasMore: false })
      renderSearchPage('gatsby')
      await waitFor(() => expect(screen.getByText('1 book')).toBeInTheDocument())
    })

    it('shows no results message when search returns empty', async () => {
      apiFetch.mockResolvedValue({ books: [], hasMore: false })
      renderSearchPage('unknownbook123')
      await waitFor(() =>
        expect(screen.getByText(/No books found for/)).toBeInTheDocument()
      )
    })

    it('shows an error message when the fetch fails', async () => {
      apiFetch.mockRejectedValue(new Error('Network error'))
      renderSearchPage('gatsby')
      await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument())
    })

    it('shows a Try again button on error', async () => {
      apiFetch.mockRejectedValue(new Error('Oops'))
      renderSearchPage('gatsby')
      await waitFor(() => expect(screen.getByText('Try again')).toBeInTheDocument())
    })
  })

  // ─── Load more ────────────────────────────────────────────────────────────────

  describe('load more', () => {
    it('shows the Load more button when hasMore is true', async () => {
      apiFetch.mockResolvedValue({ books: [RAW_GATSBY], hasMore: true })
      renderSearchPage('gatsby')
      await waitFor(() =>
        expect(screen.getByText('Load more from Open Library')).toBeInTheDocument()
      )
    })

    it('does not show the Load more button when hasMore is false', async () => {
      apiFetch.mockResolvedValue({ books: [RAW_GATSBY], hasMore: false })
      renderSearchPage('gatsby')
      await waitFor(() => expect(screen.getByRole('heading', { name: 'The Great Gatsby' })).toBeInTheDocument())
      expect(screen.queryByText('Load more from Open Library')).not.toBeInTheDocument()
    })

    it('fetches more books and appends them when Load more is clicked', async () => {
      apiFetch
        .mockResolvedValueOnce({ books: [RAW_GATSBY], hasMore: true })
        .mockResolvedValueOnce({ books: [RAW_DUNE], hasMore: false })

      renderSearchPage('gatsby')
      await waitFor(() => expect(screen.getByText('Load more from Open Library')).toBeInTheDocument())

      fireEvent.click(screen.getByText('Load more from Open Library'))

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument()
      )
      expect(screen.getByRole('heading', { name: 'The Great Gatsby' })).toBeInTheDocument()
    })
  })

  // ─── Book navigation ──────────────────────────────────────────────────────────

  describe('book navigation', () => {
    it('navigates to the book detail page when a book card is clicked', async () => {
      apiFetch.mockResolvedValue({ books: [RAW_GATSBY], hasMore: false })
      renderSearchPage('gatsby')
      await waitFor(() => expect(screen.getByRole('heading', { name: 'The Great Gatsby' })).toBeInTheDocument())

      fireEvent.click(screen.getByRole('heading', { name: 'The Great Gatsby' }))

      expect(mockNavigate).toHaveBeenCalledWith(
        '/bookdetail/OL1',
        expect.objectContaining({ state: expect.any(Object) })
      )
    })
  })

  // ─── Author tag filter ────────────────────────────────────────────────────────

  describe('author tag filter', () => {
    it('adds a tag when Enter is pressed in the author input', () => {
      renderSearchPage()
      const authorInput = screen.getByRole('textbox', { name: 'Filter by author' })
      fireEvent.change(authorInput, { target: { value: 'Tolkien' } })
      fireEvent.keyDown(authorInput, { key: 'Enter' })
      expect(screen.getByText('Tolkien')).toBeInTheDocument()
    })

    it('clears the author input after the tag is added', () => {
      renderSearchPage()
      const authorInput = screen.getByRole('textbox', { name: 'Filter by author' })
      fireEvent.change(authorInput, { target: { value: 'Tolkien' } })
      fireEvent.keyDown(authorInput, { key: 'Enter' })
      expect(authorInput.value).toBe('')
    })

    it('does not add a tag when Enter is pressed on an empty input', () => {
      renderSearchPage()
      const authorInput = screen.getByRole('textbox', { name: 'Filter by author' })
      fireEvent.keyDown(authorInput, { key: 'Enter' })
      expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
    })

    it('does not add the same author tag twice', () => {
      renderSearchPage()
      const authorInput = screen.getByRole('textbox', { name: 'Filter by author' })
      fireEvent.change(authorInput, { target: { value: 'Tolkien' } })
      fireEvent.keyDown(authorInput, { key: 'Enter' })
      fireEvent.change(authorInput, { target: { value: 'Tolkien' } })
      fireEvent.keyDown(authorInput, { key: 'Enter' })
      expect(screen.getAllByText('Tolkien')).toHaveLength(1)
    })

    it('removes a tag when its remove button is clicked', () => {
      renderSearchPage()
      const authorInput = screen.getByRole('textbox', { name: 'Filter by author' })
      fireEvent.change(authorInput, { target: { value: 'Tolkien' } })
      fireEvent.keyDown(authorInput, { key: 'Enter' })
      fireEvent.click(screen.getByRole('button', { name: 'Remove Tolkien' }))
      expect(screen.queryByText('Tolkien')).not.toBeInTheDocument()
    })
  })

  // ─── Year range filter ────────────────────────────────────────────────────────

  describe('year range filter', () => {
    it('updates the year from input', () => {
      renderSearchPage()
      const input = screen.getByRole('spinbutton', { name: 'Published year from' })
      fireEvent.change(input, { target: { value: '2000' } })
      expect(input.value).toBe('2000')
    })

    it('updates the year to input', () => {
      renderSearchPage()
      const input = screen.getByRole('spinbutton', { name: 'Published year to' })
      fireEvent.change(input, { target: { value: '2020' } })
      expect(input.value).toBe('2020')
    })

    it('hides books published after the "to" year', async () => {
      apiFetch.mockResolvedValue({ books: [RAW_GATSBY, RAW_DUNE], hasMore: false })
      renderSearchPage('book')
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Dune' })).toBeInTheDocument())

      // Gatsby: 1925, Dune: 1965 — set yearTo to 1930 to hide Dune
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Published year to' }), {
        target: { value: '1930' },
      })

      expect(screen.getByRole('heading', { name: 'The Great Gatsby' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Dune' })).not.toBeInTheDocument()
    })

    it('hides books published before the "from" year', async () => {
      apiFetch.mockResolvedValue({ books: [RAW_GATSBY, RAW_DUNE], hasMore: false })
      renderSearchPage('book')
      await waitFor(() => expect(screen.getByRole('heading', { name: 'The Great Gatsby' })).toBeInTheDocument())

      // Both books are before 2000 — all filtered out
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Published year from' }), {
        target: { value: '2000' },
      })

      await waitFor(() => expect(screen.getByText(/No books found/)).toBeInTheDocument())
    })
  })

  // ─── Rating filter ────────────────────────────────────────────────────────────

  describe('rating filter', () => {
    it('changes the selected rating when a radio is clicked', () => {
      renderSearchPage()
      const radio = screen.getAllByRole('radio', { name: '5 stars' })[0]
      fireEvent.click(radio)
      expect(radio.checked).toBe(true)
    })

    it('filters out books below the selected minimum rating', async () => {
      apiFetch.mockResolvedValue({ books: [RAW_GATSBY, RAW_DUNE], hasMore: false })
      renderSearchPage('book')
      await waitFor(() => expect(screen.getByRole('heading', { name: 'The Great Gatsby' })).toBeInTheDocument())

      // Both Gatsby (4.2) and Dune (4.8) are below 5 stars — both filtered
      fireEvent.click(screen.getAllByRole('radio', { name: '5 stars' })[0])

      await waitFor(() => expect(screen.getByText(/No books found/)).toBeInTheDocument())
    })
  })

  // ─── Search source filter ─────────────────────────────────────────────────────

  describe('search source filter', () => {
    it('selects Local Only when that radio is clicked', () => {
      renderSearchPage()
      const radio = screen.getAllByRole('radio', { name: 'Local Only' })[0]
      fireEvent.click(radio)
      expect(radio.checked).toBe(true)
    })

    it('selects Open Library Only when that radio is clicked', () => {
      renderSearchPage()
      const radio = screen.getAllByRole('radio', { name: 'Open Library Only' })[0]
      fireEvent.click(radio)
      expect(radio.checked).toBe(true)
    })
  })

  // ─── Reset filters ────────────────────────────────────────────────────────────

  describe('reset filters', () => {
    it('clears author tags when Reset All is clicked', () => {
      renderSearchPage()
      const authorInput = screen.getByRole('textbox', { name: 'Filter by author' })
      fireEvent.change(authorInput, { target: { value: 'Tolkien' } })
      fireEvent.keyDown(authorInput, { key: 'Enter' })
      fireEvent.click(screen.getAllByText('Reset All')[0])
      expect(screen.queryByText('Tolkien')).not.toBeInTheDocument()
    })

    it('clears year inputs when Reset All is clicked', () => {
      renderSearchPage()
      const yearFrom = screen.getByRole('spinbutton', { name: 'Published year from' })
      fireEvent.change(yearFrom, { target: { value: '2000' } })
      fireEvent.click(screen.getAllByText('Reset All')[0])
      expect(yearFrom.value).toBe('')
    })
  })

  // ─── Active filter count badge ────────────────────────────────────────────────

  describe('active filter count badge', () => {
    it('shows badge count of 1 after one author tag is added', () => {
      renderSearchPage()
      const authorInput = screen.getByRole('textbox', { name: 'Filter by author' })
      fireEvent.change(authorInput, { target: { value: 'Tolkien' } })
      fireEvent.keyDown(authorInput, { key: 'Enter' })
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('badge disappears after Reset All is clicked', () => {
      renderSearchPage()
      const authorInput = screen.getByRole('textbox', { name: 'Filter by author' })
      fireEvent.change(authorInput, { target: { value: 'Tolkien' } })
      fireEvent.keyDown(authorInput, { key: 'Enter' })
      fireEvent.click(screen.getAllByText('Reset All')[0])
      expect(screen.queryByText('1')).not.toBeInTheDocument()
    })
  })

  // ─── Mobile filter panel ──────────────────────────────────────────────────────

  describe('mobile filter panel', () => {
    it('shows the filter panel when the Filters button is clicked', () => {
      renderSearchPage()
      expect(screen.queryByText('Filter Options')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Filters/i }))
      expect(screen.getByText('Filter Options')).toBeInTheDocument()
    })

    it('hides the filter panel when the Filters button is clicked again', () => {
      renderSearchPage()
      const filtersBtn = screen.getByRole('button', { name: /Filters/i })
      fireEvent.click(filtersBtn)
      expect(screen.getByText('Filter Options')).toBeInTheDocument()
      fireEvent.click(filtersBtn)
      expect(screen.queryByText('Filter Options')).not.toBeInTheDocument()
    })
  })
})
