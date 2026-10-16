// server/src/services/imageProcessor.js
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../middleware/errorHandler.js';

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB hard limit
export const MAX_IMAGE_DIMENSION = 4000; // 4000x4000 maximum dimensions
export const MAX_INPUT_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION; // 16,000,000 pixels

/**
 * Validates, sanitizes, and re-encodes an uploaded image buffer.
 * Defenses implemented:
 * 1. File size check (≤ 5 MB).
 * 2. Magic byte inspection (file-type library, not spoofable file extension).
 * 3. Rejection of SVGs, GIFs, polyglots, and non-whitelisted formats.
 * 4. Decompression bomb protection at decode time via sharp limitInputPixels.
 * 5. Re-encoding to clean JPEG, stripping EXIF/XMP metadata and trailing payloads.
 *
 * @param {Buffer} buffer Raw image buffer from multer memory storage
 * @returns {Promise<{ buffer: Buffer, mimeType: string, base64: string, width: number, height: number }>}
 */
export async function processImage(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError('No image data received.', 400);
  }

  // 1. Size limit enforcement
  if (buffer.length > MAX_IMAGE_FILE_SIZE) {
    throw new AppError('Image file exceeds the maximum allowed size of 5 MB.', 400);
  }

  // 2. Magic byte validation (check true binary signature, not extension or client MIME)
  const detectedType = await fileTypeFromBuffer(buffer);
  if (!detectedType || !ALLOWED_IMAGE_MIME_TYPES.has(detectedType.mime)) {
    const attemptedType = detectedType ? detectedType.mime : 'unknown binary';
    throw new AppError(
      `Disallowed file type (${attemptedType}). Only JPEG, PNG, and WEBP images are accepted. SVGs, GIFs, and other formats are rejected.`,
      400
    );
  }

  try {
    // 3. Decompression bomb protection at decode time
    // limitInputPixels forces libvips to abort if pixel count > 16MP before memory exhaustion
    const sharpInstance = sharp(buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOnError: true,
    });

    const metadata = await sharpInstance.metadata();

    // 4. Dimension checks
    if (!metadata.width || !metadata.height) {
      throw new AppError('Unable to determine image dimensions. File may be corrupted.', 400);
    }

    if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
      throw new AppError(
        `Image dimensions (${metadata.width}x${metadata.height}) exceed the maximum permitted limit of ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels.`,
        400
      );
    }

    // 5. Re-encode to clean JPEG: strips EXIF metadata, XMP, comments, and polyglots
    const cleanBuffer = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // Auto-orient based on EXIF before stripping metadata
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: false })
      .toBuffer();

    return {
      buffer: cleanBuffer,
      mimeType: 'image/jpeg',
      base64: cleanBuffer.toString('base64'),
      width: metadata.width,
      height: metadata.height,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.message && err.message.includes('Input image exceeds pixel limit')) {
      throw new AppError('Image decompression rejected: exceeds pixel safety limit (possible decompression bomb).', 400);
    }
    throw new AppError(`Failed to process and sanitize image: ${err.message}`, 400);
  }
}
