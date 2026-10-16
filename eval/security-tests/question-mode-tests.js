// eval/security-tests/question-mode-tests.js
import { validateCheckRequest } from '../../server/src/validators/requestValidator.js';
import { validateGeminiResponse } from '../../server/src/utils/responseSchema.js';

console.log('=== Running Question Mode Validation & Schema Tests ===\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

// 1. Valid Question Request
try {
  const result = validateCheckRequest({
    type: 'question',
    payload: 'What were the major global climate agreements announced in 2025?',
  });
  assert(
    result.type === 'question' && result.payload.length > 5,
    'Valid question request passes validation cleanly'
  );
} catch (err) {
  assert(false, `Valid question threw unexpected error: ${err.message}`);
}

// 2. Too Short Question (< 5 characters)
try {
  validateCheckRequest({
    type: 'question',
    payload: 'Why?',
  });
  assert(false, 'Too short question should have thrown error');
} catch (err) {
  assert(
    err.statusCode === 400 && err.message.includes('at least 5 characters'),
    `Question < 5 characters rejected: "${err.message}"`
  );
}

// 3. Oversized Question (> 500 characters)
try {
  const longQuestion = 'A'.repeat(501);
  validateCheckRequest({
    type: 'question',
    payload: longQuestion,
  });
  assert(false, 'Oversized question should have thrown error');
} catch (err) {
  assert(
    err.statusCode === 400 && err.message.includes('500 characters'),
    `Question > 500 characters rejected: "${err.message}"`
  );
}

// 4. Valid Structured Question Response through Zod
try {
  const validQuestionData = {
    mode: 'question',
    query: 'What was the outcome of the Artemis II mission?',
    summary: 'The Artemis II lunar flyby mission successfully carried four astronauts around the Moon, testing life support systems for future crewed landings.',
    keyDates: ['November 2025', 'December 2025'],
    conflictingAccounts: '',
    limitations: 'Mission reports are based on public press briefings by NASA and Canadian Space Agency.',
    sources: [
      {
        sourceName: 'NASA Official Press Release',
        url: 'https://www.nasa.gov/news/artemis-ii-update',
        aiSummary: 'Source cited in response synthesis ([0])',
      },
    ],
    sourcePanel: [
      {
        title: 'NASA Official Press Release',
        url: 'https://www.nasa.gov/news/artemis-ii-update',
      },
    ],
  };

  const validated = validateGeminiResponse(validQuestionData, 'question');
  assert(
    validated.mode === 'question' && validated.sources.length === 1 && validated.keyDates.length === 2,
    'Valid question response data passes Zod questionResponseSchema'
  );
} catch (err) {
  assert(false, `Valid question response threw unexpected Zod error: ${err.message}`);
}

// 5. Question Mode Rejection of Missing Summary
try {
  const missingSummary = {
    mode: 'question',
    query: 'Why is the sky blue?',
    keyDates: [],
    sources: [],
    sourcePanel: [],
  };

  validateGeminiResponse(missingSummary, 'question');
  assert(false, 'Question data missing summary should fail Zod validation');
} catch (err) {
  assert(
    err.name === 'ZodError',
    'Question data missing summary correctly throws ZodError'
  );
}

// 6. Question Mode with Conflicting Accounts
try {
  const conflictingData = {
    mode: 'question',
    query: 'Who was the first person to summit the peak in the 2026 expedition?',
    summary: 'Two expedition groups claim the earliest summit time on the north ridge.',
    keyDates: ['May 12, 2026'],
    conflictingAccounts: 'Team Alpha claims summit at 04:30 UTC, while Team Beta asserts Team Alpha turned back 50m below the crest.',
    limitations: 'GPS telemetry data has not yet been independently verified by the Himalayan mountaineering registry.',
    sources: [
      {
        sourceName: 'Mountaineering Journal',
        url: 'https://example.com/expedition-report',
        aiSummary: 'Source cited in response synthesis ([1])',
      },
    ],
    sourcePanel: [
      {
        title: 'Mountaineering Journal',
        url: 'https://example.com/expedition-report',
      },
    ],
  };

  const validated = validateGeminiResponse(conflictingData, 'question');
  assert(
    validated.conflictingAccounts.length > 0 && validated.sources.length === 1,
    'Question response with conflicting accounts parses and validates cleanly'
  );
} catch (err) {
  assert(false, `Conflicting accounts data threw unexpected error: ${err.message}`);
}

console.log(`\nQuestion Mode Test Summary: ${passed}/${total} passed.`);
if (passed !== total) {
  process.exit(1);
}
