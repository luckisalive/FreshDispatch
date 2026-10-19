// server/src/index.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { checkRouter } from './routes/check.js';
import { perIpLimiter, concurrencyLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { DEFAULT_PORT } from './config/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env (check cwd, server dir, and project root)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

// 8. Serve built frontend static assets if available (Unified production deployment)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// 9. 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// 10. Centralized safe error handler (must be registered last)
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`FreshDispatch API server running on port ${PORT}`);
});

export { app, server };
