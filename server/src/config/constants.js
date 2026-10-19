// server/src/config/constants.js

export const MAX_TEXT_LENGTH = 8000;
export const MAX_QUESTION_LENGTH = 500;
export const MAX_GEMINI_CALLS_PER_CHECK = 3;
export const DEFAULT_DAILY_GLOBAL_CAP = 600;
export const DEFAULT_RATE_LIMIT_PER_IP = 10;
export const DEFAULT_PORT = 3001;
export const DEFAULT_MODEL = 'gemma-4-26b-a4b-it';
export const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemma-4-31b-it',
];
