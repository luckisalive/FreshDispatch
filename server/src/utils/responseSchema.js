// server/src/utils/responseSchema.js
import { z } from 'zod';

export const evidenceSchema = z.object({
  sourceName: z.string().min(1),
  url: z.string().url(),
  aiSummary: z.string().min(1),
});

export const claimSchema = z.object({
  claimText: z.string().min(1),
  verdict: z.enum(['Supported', 'Contradicted', 'Unverified', 'Mixed']),
  confidence: z.enum(['low', 'medium', 'high']),
  explanation: z.string().min(1),
  evidence: z.array(evidenceSchema),
  limitations: z.string().default(''),
});

export const sourceItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});

export const verificationResponseSchema = z.object({
  claims: z.array(claimSchema).max(3),
  sourcePanel: z.array(sourceItemSchema),
  nonCheckableReason: z.string().optional().default(''),
});

export const questionResponseSchema = z.object({
  summary: z.string().min(1),
  sources: z.array(evidenceSchema),
  conflictingAccounts: z.string().optional().default(''),
  limitations: z.string().default(''),
});

/**
 * Validates data against the appropriate Zod schema.
 * Throws a ZodError if validation fails.
 */
export function validateGeminiResponse(data, mode = 'verification') {
  const schema = mode === 'question' ? questionResponseSchema : verificationResponseSchema;
  return schema.parse(data);
}
