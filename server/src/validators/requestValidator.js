// server/src/validators/requestValidator.js
import { z } from 'zod';
import { MAX_TEXT_LENGTH } from '../config/constants.js';
import { AppError } from '../middleware/errorHandler.js';

export const checkRequestSchema = z.object({
  type: z.enum(['text', 'link', 'question'], {
    errorMap: () => ({ message: 'Invalid check type. Supported types: text, link, question.' }),
  }),
  payload: z.string({
    required_error: 'Payload string is required.',
  }).min(1, 'Payload cannot be empty.'),
});

/**
 * Validates the incoming check request payload.
 * Enforces length constraints based on type.
 */
export function validateCheckRequest(body) {
  const result = checkRequestSchema.safeParse(body);
  if (!result.success) {
    const errorMsg = result.error.errors.map(e => e.message).join(' ');
    throw new AppError(errorMsg, 400);
  }

  const { type, payload } = result.data;
  if (type === 'text' && payload.length > MAX_TEXT_LENGTH) {
    throw new AppError(`Text payload exceeds maximum limit of ${MAX_TEXT_LENGTH} characters.`, 400);
  }

  return { type, payload };
}
