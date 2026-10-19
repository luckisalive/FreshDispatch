// eval/test-model-fallback.js
// Purpose: Verify that model fallback works seamlessly with both custom and default fallback lists.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { GoogleGenAI } from '@google/genai';
import { getCandidateModels, generateContentWithFallback } from '../server/src/services/gemini.js';
import { FALLBACK_MODELS } from '../server/src/config/constants.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failed++;
  }
}

async function runFallbackTests() {
  console.log('=== Running Model Fallback Verification Tests ===\n');

  // Test 1: Fallback list resolution
  const candidates = getCandidateModels();
  assert(Array.isArray(candidates) && candidates.length > 1, 'getCandidateModels returns non-empty array of models');
  assert(candidates.includes('gemini-3.5-flash'), 'Fallback list includes gemini-3.5-flash');
  console.log('Resolved candidate models:', candidates);

  // Test 2: Fallback logic with mock client
  console.log('\n--- Test 2: Simulated model fallback on 503 Service Unavailable ---');
  let attemptCount = 0;
  const attemptedModels = [];

  const mockAi = {
    models: {
      generateContent: async ({ model }) => {
        attemptedModels.push(model);
        attemptCount++;
        if (model === candidates[0]) {
          const err = new Error('This model is currently experiencing high demand. Please try again later.');
          err.status = 503;
          throw err;
        }
        return { text: `Success from fallback model ${model}` };
      },
    },
  };

  const result = await generateContentWithFallback(
    mockAi,
    (model) => ({ model, contents: 'Test' }),
    'Test failed'
  );

  assert(attemptCount === 2, 'Fallback executed second model after first model threw 503');
  assert(attemptedModels[0] === candidates[0], `First attempt targeted primary model (${candidates[0]})`);
  assert(attemptedModels[1] === candidates[1], `Second attempt cascaded to first fallback model (${candidates[1]})`);
  assert(result.text.includes(candidates[1]), `Result returned response from fallback model (${candidates[1]})`);

  // Test 3: Simulated model fallback on 429 Quota Exhausted
  console.log('\n--- Test 3: Simulated model fallback on 429 Quota Exhausted ---');
  let quotaAttempts = 0;
  const quotaAttemptedModels = [];

  const mockQuotaAi = {
    models: {
      generateContent: async ({ model }) => {
        quotaAttemptedModels.push(model);
        quotaAttempts++;
        if (model === candidates[0]) {
          const err = new Error('You exceeded your current quota');
          err.status = 429;
          throw err;
        }
        return { text: `Success from quota fallback model ${model}` };
      },
    },
  };

  const quotaResult = await generateContentWithFallback(
    mockQuotaAi,
    (model) => ({ model, contents: 'Test' }),
    'Quota test failed'
  );

  assert(quotaAttempts === 2, 'Fallback cascaded to second model after first model threw 429');
  assert(quotaResult.text.includes(candidates[1]), `Result returned response from fallback model on quota error (${candidates[1]})`);

  // Test 4: Live fallback with real Gemini API
  console.log('\n--- Test 4: Live API Fallback Verification ---');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Skipping Live API test: GEMINI_API_KEY not set.');
  } else {
    const realAi = new GoogleGenAI({ apiKey });
    let liveAttempts = [];

    // Force first model to fail by prefixing an invalid model, then fallback to real model
    const liveResult = await generateContentWithFallback(
      realAi,
      (model) => {
        liveAttempts.push(model);
        // Force the first attempt to fail with 404 to verify live fallback
        const effectiveModel = liveAttempts.length === 1 ? 'models/nonexistent-test-model' : model;
        return {
          model: effectiveModel,
          contents: 'Say: FALLBACK_VERIFIED',
        };
      },
      'Live fallback failed'
    );

    assert(liveAttempts.length >= 2, `Live call triggered fallback (tried ${liveAttempts.length} models)`);
    assert(liveResult.text?.includes('FALLBACK_VERIFIED'), `Live fallback received valid output: "${liveResult.text?.trim()}"`);
  }

  console.log(`\nFallback Verification Summary: ${passed}/${passed + failed} passed.`);
  if (failed > 0) process.exit(1);
}

runFallbackTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
