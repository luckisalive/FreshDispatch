// server/src/routes/check.js
import { Router } from 'express';
import multer from 'multer';
import { validateCheckRequest } from '../validators/requestValidator.js';
import { checkGlobalCap } from '../middleware/rateLimiter.js';
import { verifyTextContent, verifyImageContent, answerQuestion } from '../services/gemini.js';
import { safeFetch } from '../services/safeFetch.js';
import { extractArticle } from '../services/articleExtractor.js';
import { processImage, MAX_IMAGE_FILE_SIZE } from '../services/imageProcessor.js';
import { MAX_GEMINI_CALLS_PER_CHECK } from '../config/constants.js';
import { AppError } from '../middleware/errorHandler.js';

export const checkRouter = Router();

// Multer memory storage configuration (never writes files to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_FILE_SIZE, // 5 MB hard limit
  },
  fileFilter: (req, file, cb) => {
    // Quick reject for video MIME types at upload stream start
    if (file.mimetype.startsWith('video/')) {
      return cb(new AppError("Video analysis isn't supported. Please paste the text, a screenshot, or an article link instead.", 400));
    }
    cb(null, true);
  },
});

// Middleware wrapper to catch Multer-specific errors cleanly
function handleUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Image file exceeds the maximum allowed size of 5 MB.', 400));
      }
      return next(new AppError(`Upload error: ${err.message}`, 400));
    }
    next();
  });
}

checkRouter.post('/check', handleUpload, async (req, res, next) => {
  try {
    const type = req.body?.type;

    // 1. Image verification mode (Phase 3)
    if (type === 'image') {
      if (!req.file || !req.file.buffer) {
        throw new AppError('No image file uploaded. Please upload a JPG, PNG, or WEBP image.', 400);
      }

      // Check global daily API quota before calling Gemini
      const withinCap = checkGlobalCap(MAX_GEMINI_CALLS_PER_CHECK);
      if (!withinCap) {
        return res.status(429).json({
          error: 'FreshDispatch has reached its daily limit. Please try again tomorrow (resets at 00:00 UTC).',
        });
      }

      // Process, inspect magic bytes, check pixel dimensions, and re-encode with Sharp
      const processed = await processImage(req.file.buffer);

      // Send sanitized base64 image to Gemini multimodal search grounding pipeline
      const result = await verifyImageContent(processed.base64, processed.mimeType);
      return res.status(200).json(result);
    }

    // 2. Text / Link / Question validation
    const { payload } = validateCheckRequest(req.body);

    // Check global daily API quota before proceeding to Gemini
    const withinCap = checkGlobalCap(MAX_GEMINI_CALLS_PER_CHECK);
    if (!withinCap) {
      return res.status(429).json({
        error: 'FreshDispatch has reached its daily limit. Please try again tomorrow (resets at 00:00 UTC).',
      });
    }

    // 3. Route text and link
    if (type === 'text') {
      const result = await verifyTextContent(payload);
      return res.status(200).json(result);
    }

    if (type === 'link') {
      const { html, finalUrl } = await safeFetch(payload);
      const article = extractArticle(html, finalUrl);
      const result = await verifyTextContent(article.text);
      return res.status(200).json(result);
    }

    if (type === 'question') {
      const result = await answerQuestion(payload);
      return res.status(200).json(result);
    }

    throw new AppError('Unsupported input type.', 400);
  } catch (error) {
    next(error);
  }
});
