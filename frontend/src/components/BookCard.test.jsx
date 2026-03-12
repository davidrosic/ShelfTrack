import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import BookCard from './BookCard'

// Mock sub-components and utils
vi.mock('./StarRating', () => ({
  default: ({ rating, size }) => (
    <div data-testid="star-rating" data-rating={rating} data-size={size} />
  ),
}))

vi.mock('../utils/sanitize', () => ({
  sanitizeText: text => text, // identity mock – we just want to see the text
}))

const mockBook = {
  title: 'Dune',
  author: 'Frank Herbert',
  coverUrl: 'https://example.com/dune.jpg',
  averageRating: 4.5,
  average_rating: null, // to test fallback logic
  ratingCount: 1234,
  rating_count: null,
  rating: 5,
  status: 'reading',
  review: 'A masterpiece of sci-fi!',
}

const renderBookCard = (props = {}) => {
  const defaultProps = {
    book: mockBook,
    onClick: vi.fn(),
    onRemove: undefined,
    showStatus: false,
    showAverageRating: true,
    ...props,
  }
  return render(<BookCard {...defaultProps} />)
}

describe('BookCard', () => {
  it('renders title and author', () => {
    renderBookCard()
    expect(screen.getByText('Dune')).toBeInTheDocument()
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument()
  })

  it('renders cover image when coverUrl is provided', () => {
    renderBookCard()
    const img = screen.getByRole('img', { name: 'Dune' })
    expect(img).toHaveAttribute('src', 'https://example.com/dune.jpg')
  })

  it('renders fallback placeholder (with title) when coverUrl is missing', () => {
    const bookWithoutCover = { ...mockBook, coverUrl: null }
    renderBookCard({ book: bookWithoutCover })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    const titleElements = screen.getAllByText('Dune')
    expect(titleElements).toHaveLength(2)

    expect(
      titleElements.some(el => el.closest('div[style*="background-color: rgb(232, 213, 183)"]'))
    ).toBe(true)
  })

  it('shows status badge when showStatus=true and status exists', () => {
    renderBookCard({ showStatus: true })
    expect(screen.getByText('Reading')).toBeInTheDocument()
  })

  it('does NOT show status badge when showStatus=false', () => {
    renderBookCard({ showStatus: false })
    expect(screen.queryByText('Reading')).not.toBeInTheDocument()
  })

  it('shows remove button when onRemove is provided and calls it correctly', () => {
    const onRemove = vi.fn()
    renderBookCard({ onRemove })

    const removeButton = screen.getByRole('button', { name: /remove from shelf/i })
    fireEvent.click(removeButton)

    expect(onRemove).toHaveBeenCalledExactlyOnceWith(mockBook)
  })

  it('stops event propagation when remove button is clicked', () => {
    const onClick = vi.fn()
    const onRemove = vi.fn()

    renderBookCard({ onClick, onRemove })

    const removeButton = screen.getByRole('button', { name: /remove from shelf/i })
    fireEvent.click(removeButton)

    expect(onRemove).toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled() // stopPropagation worked
  })

  it('uses averageRating (or average_rating) when showAverageRating=true', () => {
    renderBookCard({ showAverageRating: true })
    const stars = screen.getByTestId('star-rating')
    expect(stars).toHaveAttribute('data-rating', '4.5')
  })

  it('uses personal rating when showAverageRating=false', () => {
    const bookWithPersonalRating = { ...mockBook, rating: 5 }
    renderBookCard({
      book: bookWithPersonalRating,
      showAverageRating: false,
    })

    const stars = screen.getByTestId('star-rating')
    expect(stars).toHaveAttribute('data-rating', '5')
  })

  it('shows rating count only when showAverageRating=true and count > 0', () => {
    renderBookCard({ showAverageRating: true })
    expect(screen.getByText('(1234)')).toBeInTheDocument()
  })

  it('does NOT show rating count when showAverageRating=false', () => {
    renderBookCard({ showAverageRating: false })
    expect(screen.queryByText(/^\(\d+\)$/)).not.toBeInTheDocument()
  })

  it('renders sanitized review when present', () => {
    renderBookCard()
    expect(screen.getByText(/"A masterpiece of sci-fi!"/)).toBeInTheDocument()
  })

  it('calls onClick with the book when the card is clicked', () => {
    const onClick = vi.fn()
    renderBookCard({ onClick })

    // Clicking anywhere inside the card (e.g. title) should trigger onClick
    fireEvent.click(screen.getByText('Dune'))

    expect(onClick).toHaveBeenCalledExactlyOnceWith(mockBook)
  })

  it('handles missing rating gracefully (shows 0)', () => {
    const bookNoRating = { ...mockBook, averageRating: null, rating: null }
    renderBookCard({ book: bookNoRating, showAverageRating: true })

    const stars = screen.getByTestId('star-rating')
    expect(stars).toHaveAttribute('data-rating', '0')
  })
})
