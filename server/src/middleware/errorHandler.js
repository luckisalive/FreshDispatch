// server/src/middleware/errorHandler.js

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

/**
 * Centralized error handler middleware.
 * Returns clean, safe messages without stack traces.
 * Logs safe metadata only (no user content).
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);

  // Metadata logging only — no user text, URLs, or payloads
  const meta = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode,
    errorName: err.name || 'Error',
    errorMessage: err.message,
  };
  console.error('[Error Log]', JSON.stringify(meta));

  let message = 'An unexpected error occurred. Please try again.';

  if (statusCode === 429) {
    message = err.message || 'Rate limit exceeded. Please try again later.';
  } else if (statusCode === 400) {
    message = err.message || 'Invalid request format or parameters.';
  } else if (statusCode === 502) {
    message = err.message || 'Upstream service error while verifying claims. Please try again.';
  } else if (err instanceof AppError && err.message) {
    message = err.message;
  } else if (statusCode < 500) {
    message = err.message;
  }

  res.status(statusCode).json({ error: message });
}
