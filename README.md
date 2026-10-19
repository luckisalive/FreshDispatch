# FreshDispatch — Evidence-Based News & Claim Checker

FreshDispatch is a production-ready, full-stack web application built to demonstrate an AI-in-web-development project for an academic viva. It allows anyone (no sign-up, no login, zero tracking) to verify news items, claims, article links, screenshots, and open questions.

Instead of outputting an arbitrary "Fake" or "Real" stamp, FreshDispatch extracts independently testable claims, retrieves real-time evidence using Google Search grounding, and returns a nuanced verdict (**Supported**, **Contradicted**, **Unverified**, or **Mixed**) with cited sources, dates, qualitative confidence, plain-language reasoning, and stated limitations.

> **Core Principle:** An AI model's internal opinion is not verification. Every verdict must be anchored in verified web sources retrieved from search grounding. If no usable evidence survives code-level validation, the verdict is forced to **Unverified**. It is never guessed.

---

## Table of Contents

- [Core Principles & Methodology](#core-principles--methodology)
- [System Architecture](#system-architecture)
- [Supported Input Modes](#supported-input-modes)
- [Security & Defense Engineering](#security--defense-engineering)
- [Local Development Setup](#local-development-setup)
- [Automated Testing & Benchmark Evaluation](#automated-testing--benchmark-evaluation)
- [Deployment Guide](#deployment-guide)
  - [Option A: Unified Single-Service Deployment (Recommended)](#option-a-unified-single-service-deployment-recommended)
  - [Option B: Docker Deployment](#option-b-docker-deployment)
  - [Option C: Decoupled Deployment (Vercel + Render)](#option-c-decoupled-deployment-vercel--render)
  - [Production Environment Variables & Security Checklist](#production-environment-variables--security-checklist)
- [Academic Viva Defense Quick Reference](#academic-viva-defense-quick-reference)
- [Project Directory Structure](#project-directory-structure)

---

## Core Principles & Methodology

1. **Evidence Precedes Verdicts:** Verification is only as valid as its underlying sources. Claims are grounded strictly via live Google Search chunk retrieval.
2. **Code-Enforced Evidence Integrity:** Prompts alone cannot guarantee that a language model won't hallucinate a URL. FreshDispatch enforces citation validity in deterministic JavaScript code: any source cited by the model that does not map to a real Google Search grounding chunk is discarded. If no sources survive, the claim is auto-downgraded to `Unverified`.
3. **No Fake Precision:** Confidence is qualitative (`low`, `medium`, `high`), never an invented percentage like "94.7% true".
4. **Transparent Attribution:** Snippets extracted from grounding are explicitly labeled as *"AI summary supported by this source"*, acknowledging that search grounding returns model synthesis rather than full verbatim quotes.
5. **Epistemological Honesty for Open Questions:** When users ask open-ended questions (e.g., *"What happened in New York last year?"*), FreshDispatch switches to Question Mode. It provides a cited, neutral synthesis with timelines and conflicting accounts without manufacturing an artificial "Supported" or "Contradicted" verdict.
6. **Zero Tracking & Total Privacy:** No database, no user accounts, no analytics. History is kept strictly inside the user's browser `localStorage` (last 20 checks) and never transmitted to any third party.

---

## System Architecture

FreshDispatch uses a clean two-call pipeline to decouple search retrieval from rigid JSON schema enforcement:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Interface (React 19 + Vite)                │
│   [📝 Text & Claims]   [🔗 Article Link]   [🖼️ Image]   [❓ Question]    │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ POST /api/check (JSON or multipart)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Backend (Node.js + Express)                     │
│                                                                        │
│  1. Rate Limiting: 10 req/hr per IP ──► Max 2 In-Flight ──► Daily Cap  │
│  2. Input Routing & Sanitation:                                        │
│     • Text: Delimiter injection strip (</USER_CONTENT>)                │
│     • Link: Video blocklist ──► SSRF safeFetch ──► Readability extract │
│     • Image: Video reject ──► Magic bytes ──► Decompression bomb guard │
│     • Question: 500-char cap ──► Neutral prompt                        │
│                                                                        │
│  3. Two-Call Gemini Pipeline:                                          │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │ Call 1: Google Search Grounding Tool                          │  │
│     │ (Model searches live web; returns text + groundingMetadata)   │  │
│     └───────────────────────────────┬───────────────────────────────┘  │
│                                     ▼                                  │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │ Citation Ingestion: Injects [n] markers at segment end points │  │
│     └───────────────────────────────┬───────────────────────────────┘  │
│                                     ▼                                  │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │ Call 2: JSON Schema Enforcement (No Tools)                    │  │
│     │ (Strict Zod schema; model only permitted to cite [n] markers) │  │
│     └───────────────────────────────┬───────────────────────────────┘  │
│                                     ▼                                  │
│  4. Evidence Provenance & Verdict Auto-Correction:                     │
│     • Discards hallucinated indices; matches real grounding chunks     │
│     • Zero surviving evidence? Force verdict = "Unverified"            │
│     • Multi-Model Fallback: Cascades on 503 overload / 429 quota       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ JSON Response
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend Presentation                           │
│   • Verdict Badges & Rationale       • Question Mode Synthesis         │
│   • Source Credibility Panel         • Browser localStorage History    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Supported Input Modes

| Input Mode | Processing Pipeline | Safety & Guardrails |
| :--- | :--- | :--- |
| **📝 Text & Claims** | Direct claim extraction and Google Search grounding. | Delimiter sanitization (`</USER_CONTENT>`), max 8,000 characters. |
| **🔗 Article Link** | Server fetches page via `safeFetch`, extracts text with `@mozilla/readability`. | SSRF DNS pinning, unicast allowlist, redirect hop cap (3), 2 MB body cap, video domain block. |
| **🖼️ Image / Screenshot** | Gemini multimodal vision directly analyzes screenshot. No external OCR library. | Magic bytes check (`file-type`), 5 MB cap, `sharp` pixel limit (16 MP), EXIF stripping, JPEG normalization. |
| **❓ Open Question** | Question Mode: neutral cited synthesis, timeline extraction, conflicting accounts note. | Non-verdict schema, 500-character cap, citation validation. |

### Video Policy (Hard Rule)
Video analysis is declined outright across client and server:
- Rejects uploaded files with video MIME types (`video/*`) or extensions (`.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`).
- Rejects links to video hosts (`youtube.com`, `youtu.be`, `vimeo.com`, `tiktok.com`, `dailymotion.com`, `facebook.com/watch`, `instagram.com/reel`, `x.com/*/status/*`, `rumble.com`, `twitch.tv`).
- Kept in a single shared configuration file: [`videoBlocklist.js`](file:///c:/Users/lnegi/OneDrive/Desktop/project/personalProjects/FreshDispatch/server/src/config/videoBlocklist.js).

---

## Security & Defense Engineering

FreshDispatch implements security in depth across all application layers:

1. **Prompt Injection Boundary Containment:** User text and image captions are treated strictly as untrusted data. Closing delimiters (`</USER_CONTENT>`, `</GROUNDED_ANALYSIS>`) are sanitized via regex with whitespace and case-insensitivity before prompt insertion.
2. **SSRF Mitigation with DNS Socket Pinning ([`safeFetch.js`](file:///c:/Users/lnegi/OneDrive/Desktop/project/personalProjects/FreshDispatch/server/src/services/safeFetch.js)):**
   - Direct connection to an IP literal with a `Host` header breaks TLS SNI validation.
   - FreshDispatch uses `undici.Agent` with a custom `connect.lookup` function: DNS resolution is verified against an allowlist of globally routable public unicast IPs (`ipaddr.js`). The socket connects directly to the pinned IP while preserving the original hostname for HTTPS TLS validation.
   - Loopbacks (`127.0.0.1`, `::1`), metadata services (`169.254.169.254`), private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), CGNAT (`100.64.0.0/10`), IPv4-mapped IPv6, and non-standard ports (allowed: 80, 443) are rejected before socket allocation on every redirect hop.
3. **Decompression Bomb (Pixel Bomb) Defense ([`imageProcessor.js`](file:///c:/Users/lnegi/OneDrive/Desktop/project/personalProjects/FreshDispatch/server/src/services/imageProcessor.js)):**
   - Inspects real binary magic bytes via `file-type` (rejects SVG scripts, GIFs, fake binaries).
   - Sharp decode-time limit: `sharp({ limitInputPixels: 16000000 })` aborts decompression before memory allocation if image dimensions exceed 16 megapixels, stopping tiny compressed files from causing Out-Of-Memory crashes.
   - Auto-orients, strips EXIF/GPS metadata, and re-encodes to a clean JPEG ($2000 \times 2000$ inside fit).
4. **Tiered Rate Limiting & Quota Protection ([`rateLimiter.js`](file:///c:/Users/lnegi/OneDrive/Desktop/project/personalProjects/FreshDispatch/server/src/middleware/rateLimiter.js)):**
   - **Per-IP Limiter:** 10 requests per hour window via `express-rate-limit`.
   - **Concurrency Limiter:** Max 2 simultaneous in-flight requests per IP. Cleared on connection `close`.
   - **Global Daily Cap:** Hard daily cap (default 600 calls) resetting at UTC midnight. Only requests reaching Gemini are counted.
   - **Dev Bypass Security:** `RATE_LIMIT_BYPASS=true` is strictly prohibited in production and throws a fatal error if `NODE_ENV === 'production'`.
5. **Multi-Model Fallback Cascading ([`gemini.js`](file:///c:/Users/lnegi/OneDrive/Desktop/project/personalProjects/FreshDispatch/server/src/services/gemini.js)):**
   - Automatically cascades through prioritized models (`gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemma-4-26b-a4b-it`) when upstream encounters 503 high-demand or transient quota pressure.

---

## Local Development Setup

### 1. Prerequisites
- **Node.js**: v20.x or newer (tested on Node v24)
- **Google Gemini API Key**: Free tier key from [Google AI Studio](https://aistudio.google.com/)

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` with your API key:
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

### 3. Install Dependencies
```bash
npm run install:all
```
*(Installs root concurrently runner, server dependencies, and client dependencies).*

### 4. Start Development Servers
```bash
npm run dev
```
- **Backend API**: `http://localhost:3001`
- **Frontend UI**: `http://localhost:5173`

---

## Automated Testing & Benchmark Evaluation

### 1. Run Security Guardrail Tests
FreshDispatch includes 65 automated unit and security tests verifying SSRF protection, injection defenses, video blocking, upload bombs, and question mode:
```bash
npm run test:security
```
Expected output:
```text
Result: 4/4 prompt injection delimiter tests passed.
Results: 18/18 IP tests passed, 9/9 URL tests passed.
Results: 15/15 client checks passed, 5/5 server checks passed.
Upload Security Test Summary: 8/8 passed.
Question Mode Test Summary: 6/6 passed.
```

### 2. Run Model Fallback Cascading Test
```bash
npm run test:fallback
```
Verifies automatic fallback execution on 503 high demand, 429 quota exhaustion, and live model cascades.

### 3. Run Benchmark Evaluation Suite
```bash
npm run eval
```
The evaluation runner ([`eval/run-eval.js`](file:///c:/Users/lnegi/OneDrive/Desktop/project/personalProjects/FreshDispatch/eval/run-eval.js)) evaluates claims across categories (`established`, `recent`, `should-be-unverified`, `mixed-contested`), compares raw model judgments against code-enforced evidence constraints, and exports timestamped metrics to `eval/results/eval-<timestamp>.json`.

---

## Deployment Guide

FreshDispatch supports both a **Unified Single-Service Deployment** (one web service serving both API and frontend) and a **Decoupled Deployment** (Vercel frontend + Render/Railway backend).

---

### Option A: Unified Single-Service Deployment (Recommended)

In this setup, a single Node.js process serves the Express API on `/api/*` and statically serves the compiled Vite React frontend (`client/dist`) for all other routes.

**Platforms:** Render (Web Service), Railway, Fly.io, DigitalOcean App Platform, or any Linux VPS.

#### Build & Start Commands:
```bash
# Build Command (installs server & client dependencies and compiles Vite)
npm run build

# Start Command (launches Express production server)
npm start
```

> [!NOTE]
> **Why `npm run build` resolves "vite: not found" on Render:**
> Standard Node build hosts only run `npm install` at the repository root and skip `devDependencies` when `NODE_ENV=production`. In FreshDispatch, root `package.json` configures npm workspaces and defines `build` as:
> `npm install --prefix server --omit=dev && npm install --prefix client --include=dev && npm run build --prefix client`
> Additionally, `vite` is included directly in `client/package.json` dependencies. This guarantees that `vite` is always installed and available in `$PATH` during deployment.

#### Step-by-Step for Render / Railway:
1. Push your repository to GitHub.
2. In your Render dashboard, click **New Web Service** and select your repository.
3. Configure the build and start settings:
   - **Environment:** `Node`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
4. Add the required Environment Variables:
   - `GEMINI_API_KEY`: *(Your Google AI Studio API Key)*
   - `GEMINI_MODEL`: `gemini-3.5-flash`
   - `NODE_ENV`: `production`
   - `PORT`: `3001` (or leave default; Render automatically binds `$PORT`)
   - `TRUST_PROXY`: `1` *(Render runs behind a single reverse proxy; prevents all users from sharing one rate limit)*
   - `FRONTEND_ORIGIN`: `https://your-app-name.onrender.com`
   - `DAILY_GLOBAL_CAP`: `600`
   - `RATE_LIMIT_PER_IP`: `10`
   - `RATE_LIMIT_BYPASS`: `false`
5. Click **Deploy Web Service**. FreshDispatch will install all dependencies, compile the React bundle with Vite, and serve both the API and client on your Render domain.

---

### Option B: Docker Deployment

FreshDispatch includes a production-ready, multi-stage [`Dockerfile`](file:///c:/Users/lnegi/OneDrive/Desktop/project/personalProjects/FreshDispatch/Dockerfile) that builds the client in Stage 1 and copies only production artifacts to a lightweight Alpine runner in Stage 2.

#### 1. Build the Docker Image:
```bash
docker build -t freshdispatch:latest .
```

#### 2. Run the Container:
```bash
docker run -d \
  --name freshdispatch \
  -p 3001:3001 \
  -e GEMINI_API_KEY="your_gemini_api_key_here" \
  -e GEMINI_MODEL="gemini-3.5-flash" \
  -e NODE_ENV="production" \
  -e TRUST_PROXY="false" \
  -e DAILY_GLOBAL_CAP="600" \
  -e RATE_LIMIT_PER_IP="10" \
  freshdispatch:latest
```

#### 3. Verify Health:
```bash
curl http://localhost:3001/api/health
```

---

### Option C: Decoupled Deployment (Vercel + Render)

If you prefer hosting the React client on a CDN (Vercel/Netlify) and the backend API on a serverless container (Render/Fly.io):

#### 1. Backend (Render / Fly.io / Railway):
- Root directory: repository root.
- Build command: `npm install --prefix server`
- Start command: `node server/src/index.js`
- Set `FRONTEND_ORIGIN` to your Vercel domain (e.g. `https://freshdispatch.vercel.app`).
- Set `TRUST_PROXY=1`.

#### 2. Frontend (Vercel / Netlify):
- Root directory: `client`
- Framework Preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment Variable:
  - `VITE_API_ORIGIN`: `https://your-backend-api.onrender.com`
  *(The client's [`api.js`](file:///c:/Users/lnegi/OneDrive/Desktop/project/personalProjects/FreshDispatch/client/src/utils/api.js) will automatically point fetch calls to this URL).*

---

### Production Environment Variables & Security Checklist

| Variable | Recommended Production Value | Security / Architectural Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables Express optimizations, activates strict CSP headers in Vite, and triggers safety guards. |
| `GEMINI_API_KEY` | *(Secret Key)* | API authorization for Google AI Studio search grounding. Never commit this to source control. |
| `GEMINI_MODEL` | `gemini-3.5-flash` | Primary grounded inference model. |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.6-flash,gemini-3.5-flash-lite` | Automatic fallback chain if the primary model encounters 503 demand spikes. |
| `PORT` | `3001` or `$PORT` | Port on which Express listens. |
| `FRONTEND_ORIGIN` | `https://yourdomain.com` | Restricts CORS headers strictly to your client origin; prevents cross-origin API abuse. |
| `TRUST_PROXY` | `1` (or `true` behind Cloudflare) | **Critical:** Ensures `req.ip` reflects the true client IP instead of the reverse proxy IP. If left as `false` behind a proxy, all users share one IP and exhaust rate limits instantly. |
| `DAILY_GLOBAL_CAP` | `600` | Prevents quota exhaustion or runaway API charges by capping daily Gemini calls. Resets at UTC midnight. |
| `RATE_LIMIT_PER_IP` | `10` | Caps requests per IP per hour to prevent scraping and abuse. |
| `RATE_LIMIT_BYPASS` | `false` | **Hard Security Rule:** Must be `false`. The backend throws a fatal exception if set to `true` when `NODE_ENV=production`. |

---

## Academic Viva Defense Quick Reference

Use these talking points when defending the project in your semester viva:

### 1. Why two Gemini calls instead of a single grounded call with JSON schema?
> *"In our empirical feasibility testing, enabling Google Search grounding simultaneously with structured JSON schema (`responseSchema`) on Flash models resulted in frequent 400 parameter conflict errors or silent drops of search grounding metadata. The two-call pipeline cleanly decouples search retrieval (Call 1) from structured formatting (Call 2), guaranteeing both verifiable search grounding and 100% adherence to our Zod schema."*

### 2. How do you prevent the LLM from hallucinating fake source URLs?
> *"Prompts alone cannot guarantee truthful attribution. FreshDispatch enforces source integrity deterministically in JavaScript code. After Call 1, our server extracts the `groundingChunks` and `groundingSupports` returned directly by Google Search. We inject numerical markers `[n]` at the exact character offsets supported by those chunks. Call 2 is only permitted to reference markers present in the text. In `evidenceBuilder.js`, we discard any source URL not present in the real grounding chunks. If a claim has no surviving verified sources, our code forces its verdict to `Unverified`."*

### 3. Why is DNS pinning required for SSRF prevention? Why not a simple URL regex?
> *"Simple regex checks or fetching an IP-literal with a `Host` header are vulnerable to DNS Rebinding attacks and break HTTPS TLS/SNI validation. FreshDispatch uses an `undici.Agent` with a custom `connect.lookup` function. We resolve the domain's IP at the socket connection level, verify that it falls strictly within public unicast ranges (rejecting private, loopback, CGNAT, and AWS/GCP metadata IPs like `169.254.169.254`), and pin that socket to the validated IP while preserving the original hostname for TLS certificate verification. We re-validate this on every redirect hop."*

### 4. What is a decompression bomb (pixel bomb) and how is it mitigated?
> *"A pixel bomb is an image that is small on disk (e.g. 200 KB) but declares massive dimensions (e.g. $50,000 \times 50,000$ pixels). Decompressing it requires gigabytes of RAM, crashing the Node process with an Out-Of-Memory error. FreshDispatch mitigates this at decode time using `sharp({ limitInputPixels: 16000000 })`. Libvips inspects the file header and aborts decompression before memory allocation if pixels exceed 16 megapixels."*

### 5. Why Question Mode instead of forcing a Supported/Contradicted verdict?
> *"An open question (e.g., 'What happened in Paris yesterday?') is not a factual proposition; it has no boolean truth value. Forcing a binary verdict would force the model to invent an artificial judgment. Question Mode provides an evidence-based neutral summary, extracts key dates, notes conflicting accounts if sources disagree, and reports coverage limitations without forcing an ungrounded verdict."*

---

## Project Directory Structure

```
FreshDispatch/
├── .env.example              # Template environment variables
├── .gitignore                # Excludes secrets, node_modules, decisions.md, and stitch/
├── Dockerfile                # Multi-stage production container build
├── README.md                 # Complete documentation and viva guide
├── package.json              # Monorepo runner scripts (dev, build, start, test, eval)
├── server/
│   ├── package.json          # Express, @google/genai, sharp, undici, zod, helmet
│   └── src/
│       ├── index.js          # Express entrypoint & static client serving
│       ├── config/           # Constants, model fallbacks, video blocklist
│       ├── middleware/       # Rate limiting, concurrency limiter, safe error handler
│       ├── routes/           # POST /api/check route handler
│       ├── services/         # Gemini pipeline, safeFetch, articleExtractor, imageProcessor
│       ├── utils/            # Zod response schemas and delimiter sanitizer
│       └── validators/       # Request payload validation
├── client/
│   ├── package.json          # React 19, Vite, Lucide icons
│   ├── vite.config.js        # Vite build config with CSP meta tag injection
│   └── src/
│       ├── App.jsx           # Main layout container & view coordinator
│       ├── components/
│       │   ├── InputForm/    # 4-tab segmented form (Text, Link, Image, Question)
│       │   ├── Results/      # ClaimCard, QuestionCard, SourcePanel, Disclaimer
│       │   ├── History/      # Local localStorage investigation history panel
│       │   └── common/       # LoadingSpinner, ErrorMessage
│       ├── hooks/            # useCheck (API lifecycle), useHistory (localStorage)
│       └── utils/            # API client fetcher
└── eval/
    ├── claims.csv            # Evaluation benchmark dataset
    ├── run-eval.js           # Automated benchmark evaluation runner
    ├── test-grounding-shape.js   # Verifies Gemini grounding metadata structure
    ├── test-two-call-pipeline.js # Verifies Call 1 + Call 2 end-to-end
    ├── test-model-fallback.js    # Verifies 503/429 model fallback cascading
    ├── results/              # Timestamped evaluation benchmark JSON logs (.gitkeep)
    └── security-tests/       # 65 automated security & guardrail unit tests
        ├── injection-tests.js
        ├── ssrf-tests.js
        ├── video-block-tests.js
        ├── upload-tests.js
        └── question-mode-tests.js
```

---

## License

MIT License — Academic semester project developed for AI-in-Web-Development viva defense.
