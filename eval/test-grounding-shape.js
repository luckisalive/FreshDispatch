// eval/test-grounding-shape.js
// Purpose: Inspect the raw structure of groundingMetadata returned by the Gemini API

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('ERROR: GEMINI_API_KEY is not set in environment or .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function testGroundingShape() {
  console.log(`Testing Gemini model: ${MODEL}\n`);

  // --- Test A: Grounding only (no responseSchema) ---
  console.log('=== Test A: Grounding only (no responseSchema) ===');
  const responseA = await ai.models.generateContent({
    model: MODEL,
    contents: 'What were the results of the 2024 US presidential election?',
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  console.log('Response text (sample):\n', responseA.text?.substring(0, 250), '...\n');
  const metaA = responseA.candidates?.[0]?.groundingMetadata;
  console.log('groundingMetadata top-level keys:', metaA ? Object.keys(metaA) : 'NONE');
  console.log('\nSample groundingChunks (first 2):');
  console.log(JSON.stringify(metaA?.groundingChunks?.slice(0, 2), null, 2));
  console.log('\nSample groundingSupports (first 2):');
  console.log(JSON.stringify(metaA?.groundingSupports?.slice(0, 2), null, 2));
  console.log('\nwebSearchQueries:', metaA?.webSearchQueries);

  // --- Test B: Grounding + responseSchema in single call ---
  console.log('\n\n=== Test B: Grounding + responseSchema (single call test) ===');
  try {
    const responseB = await ai.models.generateContent({
      model: MODEL,
      contents: 'What were the results of the 2024 US presidential election?',
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            summary: { type: 'STRING' },
            winner: { type: 'STRING' },
          },
          required: ['summary', 'winner'],
        },
      },
    });

    console.log('Response text:', responseB.text?.substring(0, 300));
    const metaB = responseB.candidates?.[0]?.groundingMetadata;
    console.log('groundingMetadata keys:', metaB ? Object.keys(metaB) : 'NONE');
    console.log('groundingChunks count:', metaB?.groundingChunks?.length ?? 0);
    console.log('groundingSupports count:', metaB?.groundingSupports?.length ?? 0);

    if (!metaB?.groundingChunks?.length) {
      console.log('\nResult: Single call DROPPED grounding chunks. Two-call pipeline confirmed necessary.');
    } else {
      console.log('\nResult: Single call retained grounding chunks.');
    }
  } catch (err) {
    console.log('Single call error:', err.message);
    console.log('\nResult: Single call failed. Two-call pipeline confirmed necessary.');
  }
}

testGroundingShape().catch(err => {
  console.error('Fatal error running test:', err);
  process.exit(1);
});
