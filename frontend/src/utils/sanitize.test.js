import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeHtml, sanitizeBookId } from './sanitize'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sanitizeText', () => {
  // ─── Null / undefined ─────────────────────────────────────────────────────

  it('returns null when input is null', () => {
    expect(sanitizeText(null)).toBe('')
  })

  it('returns null when input is undefined', () => {
    expect(sanitizeText(undefined)).toBe('')
  })

  // ─── Strips all HTML tags ───────────────────────────────────────────────────────

  it('stripped all html tags from text', () => {
    expect(sanitizeText('<p>Example text</p>')).toBe('Example text')
  })
})

describe('sanitizeTextHtml', () => {
  // ─── Null / undefined ─────────────────────────────────────────────────────

  it('returns null when input is null', () => {
    expect(sanitizeHtml(null)).toBe('')
  })

  it('returns null when input is undefined', () => {
    expect(sanitizeHtml(undefined)).toBe('')
  })

  // ─── Strips or leaves to correct tags ───────────────────────────────────────────────────────

  it('does not strip correct tags', () => {
    expect(sanitizeHtml('<p>Example text</p>')).toBe('<p>Example text</p>')
  })

  it('strips div but leaves p tag', () => {
    expect(sanitizeHtml('<div><p>Example text</p></div>')).toBe('<p>Example text</p>')
  })

  it('strips div tag', () => {
    expect(sanitizeHtml('<div>Example text</div>')).toBe('Example text')
  })
})

describe('sanitizeText', () => {
  // ─── Null / undefined ─────────────────────────────────────────────────────

  it('returns null when input is null', () => {
    expect(sanitizeBookId(null)).toBeNull()
  })

  it('returns null when input is undefined', () => {
    expect(sanitizeBookId(undefined)).toBeNull()
  })

  // ─── Strips all HTML tags ───────────────────────────────────────────────────────

  it('returns correct id', () => {
    expect(sanitizeBookId('OL123W')).toBe('OL123W')
  })

  it('does not return wrong id', () => {
    expect(sanitizeBookId('OL123W!')).toBeNull()
  })
})
