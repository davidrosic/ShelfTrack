import { describe, it, expect } from 'vitest'
import { mapBookFromAPI, mapBooksFromAPI, mapBookForNavigation, getBookUrlId } from './bookMapper'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('mapBookFromAPI', () => {

  // ─── Null / undefined ─────────────────────────────────────────────────────

  it('returns null when input is null', () => {
    expect(mapBookFromAPI(null)).toBeNull()
  })

  it('returns null when input is undefined', () => {
    expect(mapBookFromAPI(undefined)).toBeNull()
  })

  // ─── ID fields ────────────────────────────────────────────────────────────

  it('uses open_library_id as id when present', () => {
    expect(mapBookFromAPI({ open_library_id: 'OL1', book_id: 99 }).id).toBe('OL1')
  })

  it('falls back to string(book_id) when open_library_id is absent', () => {
    expect(mapBookFromAPI({ book_id: 42 }).id).toBe('42')
  })

  it('maps openLibraryId and bookId as separate fields', () => {
    const book = mapBookFromAPI({ open_library_id: 'OL5', book_id: 10 })
    expect(book.openLibraryId).toBe('OL5')
    expect(book.bookId).toBe(10)
  })

  // ─── Basic info ───────────────────────────────────────────────────────────

  it('maps title from the raw field', () => {
    expect(mapBookFromAPI({ title: 'Dune' }).title).toBe('Dune')
  })

  it('defaults title to "Unknown Title" when absent', () => {
    expect(mapBookFromAPI({}).title).toBe('Unknown Title')
  })

  it('maps author from the raw field', () => {
    expect(mapBookFromAPI({ author: 'Frank Herbert' }).author).toBe('Frank Herbert')
  })

  it('defaults author to "Unknown Author" when absent', () => {
    expect(mapBookFromAPI({}).author).toBe('Unknown Author')
  })

  it('maps coverUrl from cover_url', () => {
    expect(mapBookFromAPI({ cover_url: 'https://example.com/cover.jpg' }).coverUrl)
      .toBe('https://example.com/cover.jpg')
  })

  it('maps firstPublishYear from first_publish_year', () => {
    expect(mapBookFromAPI({ first_publish_year: 1965 }).firstPublishYear).toBe(1965)
  })

  it('sets firstPublishYear to null when absent', () => {
    expect(mapBookFromAPI({}).firstPublishYear).toBeNull()
  })

  // ─── Ratings ──────────────────────────────────────────────────────────────

  it('parses averageRating as a float from a string', () => {
    expect(mapBookFromAPI({ average_rating: '4.25' }).averageRating).toBe(4.25)
  })

  it('sets averageRating to null when absent', () => {
    expect(mapBookFromAPI({}).averageRating).toBeNull()
  })

  it('parses ratingCount as an integer from a string', () => {
    expect(mapBookFromAPI({ rating_count: '150' }).ratingCount).toBe(150)
  })

  it('defaults ratingCount to 0 when absent', () => {
    expect(mapBookFromAPI({}).ratingCount).toBe(0)
  })

  it('maps personal rating from the rating field', () => {
    expect(mapBookFromAPI({ rating: 4 }).rating).toBe(4)
  })

  it('sets rating to null when absent', () => {
    expect(mapBookFromAPI({}).rating).toBeNull()
  })

  // ─── Source ───────────────────────────────────────────────────────────────

  it('maps the source field', () => {
    expect(mapBookFromAPI({ source: 'local' }).source).toBe('local')
    expect(mapBookFromAPI({ source: 'external' }).source).toBe('external')
  })

  // ─── User-book fields ─────────────────────────────────────────────────────

  it('maps all user-book specific fields', () => {
    const book = mapBookFromAPI({
      user_book_id: 7,
      status: 'reading',
      review: 'Great read',
      notes: 'Some notes',
    })
    expect(book.userBookId).toBe(7)
    expect(book.status).toBe('reading')
    expect(book.review).toBe('Great read')
    expect(book.notes).toBe('Some notes')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('mapBooksFromAPI', () => {
  it('returns an empty array when input is null', () => {
    expect(mapBooksFromAPI(null)).toEqual([])
  })

  it('returns an empty array when input is not an array', () => {
    expect(mapBooksFromAPI('string')).toEqual([])
    expect(mapBooksFromAPI(42)).toEqual([])
  })

  it('returns an empty array for an empty input array', () => {
    expect(mapBooksFromAPI([])).toEqual([])
  })

  it('maps each book in the array', () => {
    const raw = [
      { open_library_id: 'OL1', title: 'Book A' },
      { open_library_id: 'OL2', title: 'Book B' },
    ]
    const result = mapBooksFromAPI(raw)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('OL1')
    expect(result[1].id).toBe('OL2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('mapBookForNavigation', () => {
  it('returns null when input is null', () => {
    expect(mapBookForNavigation(null)).toBeNull()
  })

  it('returns null when input is undefined', () => {
    expect(mapBookForNavigation(undefined)).toBeNull()
  })

  it('uses openLibraryId as the id field', () => {
    expect(mapBookForNavigation({ openLibraryId: 'OL9', bookId: 3 }).id).toBe('OL9')
  })

  it('falls back to string(bookId) when openLibraryId is absent', () => {
    expect(mapBookForNavigation({ bookId: 5 }).id).toBe('5')
  })

  it('includes only the fields needed for the detail page', () => {
    const input = {
      openLibraryId: 'OL1',
      bookId: 1,
      title: 'Test Book',
      author: 'Some Author',
      coverUrl: 'https://img.example.com',
      firstPublishYear: 2000,
      averageRating: 4.1,
      ratingCount: 50,
    }
    const result = mapBookForNavigation(input)
    expect(result).toEqual({
      id: 'OL1',
      openLibraryId: 'OL1',
      title: 'Test Book',
      author: 'Some Author',
      coverUrl: 'https://img.example.com',
      firstPublishYear: 2000,
    })
    expect(result.averageRating).toBeUndefined()
    expect(result.ratingCount).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('getBookUrlId', () => {
  it('returns an empty string when input is null', () => {
    expect(getBookUrlId(null)).toBe('')
  })

  it('returns an empty string when input is undefined', () => {
    expect(getBookUrlId(undefined)).toBe('')
  })

  it('prefers openLibraryId over bookId', () => {
    expect(getBookUrlId({ openLibraryId: 'OL3', bookId: 7 })).toBe('OL3')
  })

  it('falls back to string(bookId) when openLibraryId is absent', () => {
    expect(getBookUrlId({ bookId: 12 })).toBe('12')
  })
})
