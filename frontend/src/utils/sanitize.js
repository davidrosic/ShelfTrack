/**
 * XSS Sanitization Utilities
 * 
 * Uses DOMPurify to sanitize user-generated content before rendering.
 * Defense-in-depth against stored XSS attacks.
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize text content - removes all HTML tags
 * @param {string} text - Raw text to sanitize
 * @returns {string} Sanitized text with HTML removed
 */
export function sanitizeText(text) {
  if (!text) return '';
  // Strip all HTML tags, keep only plain text
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

/**
 * Sanitize HTML content - allows safe HTML tags only
 * @param {string} html - HTML content to sanitize
 * @returns {string} Sanitized HTML with safe tags only
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  // Allow basic formatting tags only
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
}

/**
 * Validate and sanitize a book ID
 * @param {string} id - Book ID to validate
 * @returns {string|null} Sanitized ID or null if invalid
 */
export function sanitizeBookId(id) {
  if (!id) return null;
  const sanitized = String(id).trim();
  // Allow alphanumeric, hyphens, and underscores (for OL IDs like "OL123W")
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    return null;
  }
  return sanitized;
}
