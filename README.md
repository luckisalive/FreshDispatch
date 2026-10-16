# FreshDispatch — Evidence-Based News & Claim Checker

FreshDispatch is a full-stack web application built to demonstrate an AI-in-web-development project for an academic viva. It allows anyone (no login, no user accounts) to verify factual claims with cited sources, stated limitations, and plain-language explanations.

> **Core Principle:** An AI model's internal opinion is not verification. Every verdict (**Supported**, **Contradicted**, **Unverified**, or **Mixed**) must be anchored in retrieved web sources. If no usable evidence is found, the verdict is forced to **Unverified**. It is never guessed.

---

## Architecture Overview

```
Frontend (React 19 + Vite)
  │
  │  POST /api/check { type: "text" | "link" | "question", payload }
  ▼
Backend (Node.js + Express)
  ├── Rate Limiting (10/hr per IP -> max 2 in-flight concurrency -> daily global cap)
  ├── Request Validator (Zod schema and payload length caps)
  ├── Video Policy Guard (rejects video URLs, extensions, and MIME types)
  ├── SSRF-Safe Fetcher (undici Agent with DNS pinning and IP unicast allowlist)
  ├── Main Article Extractor (@mozilla/readability + jsdom)
  ├── Two-Call Gemini Pipeline:
  │     1. Grounding Call: Google Search tool -> raw synthesis + groundingMetadata
  │     2. Citation Ingestion: Injects [n] markers at segment end indices
  │     3. Structuring Call: JSON Schema enforcement referencing present markers
  └── Evidence & Verdict Enforcement (auto-downgrades unsupported claims to Unverified)
```

---

## Prerequisites

- **Node.js**: v20 or newer (tested on Node v24)
- **Google Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/)

---

## Local Development Setup & Usage

### 1. Configure Environment Variables
Copy the template file to `.env`:
```bash
cp .env.example .env
```
Open `.env` and set your Google Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
PORT=3001
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
DAILY_GLOBAL_CAP=600
RATE_LIMIT_PER_IP=10
TRUST_PROXY=false
RATE_LIMIT_BYPASS=false
```

### 2. Install Dependencies
Install dependencies for the root orchestrator, backend server, and frontend client:
```bash
# Option A: Install all with one command
npm run install:all

# Option B: Install individually
npm install
npm install --prefix server
npm install --prefix client
```

### 3. Run the Development Servers
You can run both backend and frontend concurrently, or start each service in separate terminal windows:

#### Concurrently (Recommended):
```bash
npm run dev
```
This starts:
- **Backend API**: `http://localhost:3001`
- **Frontend App**: `http://localhost:5173`

#### Individually:
```bash
# Terminal 1 - Backend API:
npm run dev:server
# or: cd server && npm run dev

# Terminal 2 - Frontend Client:
npm run dev:client
# or: cd client && npm run dev
```

### 4. Verify Local Operation

#### A. Health Check:
```bash
# In terminal:
curl http://localhost:3001/api/health
# Or in PowerShell:
Invoke-RestMethod -Uri http://localhost:3001/api/health
```
Expected response:
```json
{"status":"ok","timestamp":"2026-10-16T..."}
```

#### B. Test Text Verification via API:
```bash
# In terminal:
curl -X POST http://localhost:3001/api/check \
  -H "Content-Type: application/json" \
  -d '{"type":"text","payload":"The James Webb Space Telescope detected atmospheric water vapor on an exoplanet."}'
```

#### C. Use the Web UI:
1. Open `http://localhost:5173` in your browser.
2. Select the **Text & Claims** tab.
3. Paste an excerpt, headline, or claim.
4. Click **Check with Evidence ↗** to view findings, confidence levels, AI summaries, and cited sources.

---

## Running Automated Security Tests

The test suite in `eval/security-tests/` verifies that security guardrails are functioning as designed:

```bash
# 1. Test prompt injection delimiter sanitization:
node eval/security-tests/injection-tests.js

# 2. Test rate limiting and concurrency limits:
node eval/security-tests/rate-limit-tests.js

# 3. Test SSRF prevention, IP allowlist, and loopback blocking:
node eval/security-tests/ssrf-tests.js

# 4. Test video URL and host blocking:
node eval/security-tests/video-block-tests.js
```

---

## Production Build & Preview

To verify the production build and test Content-Security-Policy (CSP) injection:
```bash
# Build the client:
npm run build --prefix client

# Preview production client assets:
npm run preview --prefix client
```

---

## Project Structure

```
FreshDispatch/
├── package.json              # Workspace runner and scripts
├── .env.example              # Environment variable template
├── .gitignore                # Security exclusions (.env, docs/decisions.md)
├── server/
│   ├── src/
│   │   ├── index.js          # Express app entrypoint & middleware setup
│   │   ├── config/           # Constants and centralized video blocklist
│   │   ├── middleware/       # Rate limiting, concurrency, safe error handler
│   │   ├── routes/           # POST /api/check route handler
│   │   ├── services/         # Gemini pipeline, safe fetcher, article extractor
│   │   ├── utils/            # Zod response schemas and delimiter sanitizer
│   │   └── validators/       # Request payload validation
├── client/
│   ├── src/
│   │   ├── App.jsx           # Main UI container
│   │   ├── components/       # InputForm, ClaimCard, SourcePanel, Disclaimer
│   │   ├── hooks/            # useCheck API integration hook
│   │   └── utils/            # API fetcher
└── eval/                     # Evaluation scripts, CSV template, and security tests
```
