// server/src/services/articleExtractor.js
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { MAX_TEXT_LENGTH } from '../config/constants.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Extracts main readable news text from raw HTML using Mozilla Readability.
 * Runs in JSDOM with script execution disabled.
 * 
 * @param {string} html Raw HTML string of the fetched page
 * @param {string} url The page URL for relative link resolution
 * @returns {{ title: string, text: string, excerpt: string }}
 */
export function extractArticle(html, url) {
  if (!html || typeof html !== 'string') {
    throw new AppError("Couldn't extract readable content from this page: Empty HTML.", 400);
  }

  try {
    // 1. Initialize JSDOM with scripts disabled (runScripts: undefined / not 'dangerously')
    const dom = new JSDOM(html, { url });

    // 2. Parse using Readability
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      throw new AppError("Couldn't extract readable article content from this page.", 400);
    }

    const trimmedText = article.textContent.trim().replace(/\s+/g, ' ');

    if (trimmedText.length < 50) {
      throw new AppError("Couldn't extract readable content from this page: Insufficient article text found.", 400);
    }

    // Cap extracted text to MAX_TEXT_LENGTH (8,000 chars)
    const text = trimmedText.substring(0, MAX_TEXT_LENGTH);

    return {
      title: article.title || 'Untitled Article',
      text,
      excerpt: article.excerpt || '',
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Couldn't extract readable content from this page.", 400);
  }
}
