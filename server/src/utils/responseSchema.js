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
  wasAutoCorrected: z.boolean().optional().default(false),
  originalVerdict: z.string().optional(),
});

export const sourceItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});

export const verificationResponseSchema = z.object({
  mode: z.literal('verification').optional().default('verification'),
  claims: z.array(claimSchema).max(3),
  sourcePanel: z.array(sourceItemSchema),
  nonCheckableReason: z.string().optional().default(''),
});

export const questionResponseSchema = z.object({
  mode: z.literal('question').default('question'),
  query: z.string().default(''),
  summary: z.string().min(1),
  keyDates: z.array(z.string()).default([]),
  conflictingAccounts: z.string().optional().default(''),
  limitations: z.string().default(''),
  sources: z.array(evidenceSchema).default([]),
  sourcePanel: z.array(sourceItemSchema).default([]),
});

/**
 * Validates data against the appropriate Zod schema.
 * Throws a ZodError if validation fails.
 */
export function validateGeminiResponse(data, mode = 'verification') {
  const schema = mode === 'question' ? questionResponseSchema : verificationResponseSchema;
  return schema.parse(data);
}
