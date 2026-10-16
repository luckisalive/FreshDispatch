// server/src/middleware/rateLimiter.js
import { rateLimit } from 'express-rate-limit';
import { MAX_GEMINI_CALLS_PER_CHECK, DEFAULT_DAILY_GLOBAL_CAP, DEFAULT_RATE_LIMIT_PER_IP } from '../config/constants.js';

// 1. Per-IP rate limiter (10 checks per hour by default)
export const perIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: parseInt(process.env.RATE_LIMIT_PER_IP, 10) || DEFAULT_RATE_LIMIT_PER_IP,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => {
    if (process.env.RATE_LIMIT_BYPASS === 'true') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL SECURITY ERROR: RATE_LIMIT_BYPASS is forbidden in production');
      }
      return true;
    }
    return false;
  },
  message: { error: 'Rate limit exceeded. You may perform approximately 10 checks per hour.' },
});

// 2. Concurrency limiter (max 2 simultaneous in-flight checks per IP)
const inFlightByIp = new Map();

export function concurrencyLimiter(req, res, next) {
  if (process.env.RATE_LIMIT_BYPASS === 'true') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: RATE_LIMIT_BYPASS is forbidden in production');
    }
    return next();
  }

  const ip = req.ip;
  const current = inFlightByIp.get(ip) || 0;

  if (current >= 2) {
    return res.status(429).json({
      error: 'Too many concurrent checks in progress. Please wait for your previous check to finish.',
    });
  }

  inFlightByIp.set(ip, current + 1);

  // Decrement on connection close (handles finished responses as well as client aborts)
  res.on('close', () => {
    const count = inFlightByIp.get(ip) || 1;
    if (count <= 1) inFlightByIp.delete(ip);
    else inFlightByIp.set(ip, count - 1);
  });

  next();
}

// 3. Global daily call cap (resets at UTC midnight)
let globalApiCallCount = 0;
let lastResetUtcDay = getUtcDay();

function getUtcDay() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function resetIfNewUtcDay() {
  const today = getUtcDay();
  if (today > lastResetUtcDay) {
    globalApiCallCount = 0;
    lastResetUtcDay = today;
  }
}

/**
 * Checks and increments the global daily API call cap.
 * Only called for requests that will actually invoke Gemini.
 * 
 * @param {number} callCount Expected calls for this verification attempt (default: 3)
 * @returns {boolean} true if within cap, false if cap exceeded
 */
export function checkGlobalCap(callCount = MAX_GEMINI_CALLS_PER_CHECK) {
  resetIfNewUtcDay();

  // Dev bypass check
  if (process.env.RATE_LIMIT_BYPASS === 'true') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: RATE_LIMIT_BYPASS is forbidden in production');
    }
    return true;
  }

  const cap = parseInt(process.env.DAILY_GLOBAL_CAP, 10) || DEFAULT_DAILY_GLOBAL_CAP;
  if (globalApiCallCount + callCount > cap) {
    return false;
  }

  globalApiCallCount += callCount;
  return true;
}
