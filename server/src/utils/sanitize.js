// server/src/utils/sanitize.js

/**
 * Strips closing delimiter tags from untrusted content.
 * Prevents prompt injection attempts trying to break out of delimiters.
 * Case-insensitive with variable whitespace.
 */
export function sanitizeDelimiters(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<\s*\/\s*USER_CONTENT\s*>/gi, '[delimiter-removed]')
    .replace(/<\s*\/\s*GROUNDED_ANALYSIS\s*>/gi, '[delimiter-removed]');
}
