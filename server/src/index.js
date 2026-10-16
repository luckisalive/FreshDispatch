// server/src/index.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { checkRouter } from './routes/check.js';
import { perIpLimiter, concurrencyLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { DEFAULT_PORT } from './config/constants.js';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || DEFAULT_PORT;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

// 1. Trust proxy configuration (never blindly true; default false)
const trustProxyEnv = process.env.TRUST_PROXY || 'false';
const trustProxyVal = trustProxyEnv === 'false' ? false : (isNaN(Number(trustProxyEnv)) ? trustProxyEnv : Number(trustProxyEnv));
app.set('trust proxy', trustProxyVal);

// 2. Security headers (HSTS, X-Frame-Options, noSniff, etc.)
app.use(helmet());

// 3. CORS restricted strictly to the frontend origin
app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// 4. Request body parsing (50kb limit to prevent payload flooding)
app.use(express.json({ limit: '50kb' }));

// 5. Rate limiting: per-IP first, then in-flight concurrency limiter
app.use('/api/', perIpLimiter);
app.use('/api/', concurrencyLimiter);

// 6. Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 7. API Routes
app.use('/api', checkRouter);

// 8. 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// 9. Centralized safe error handler (must be registered last)
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`FreshDispatch API server running on port ${PORT}`);
});

export { app, server };
