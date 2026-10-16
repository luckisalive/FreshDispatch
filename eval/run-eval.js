// eval/run-eval.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Dev-only rate limit bypass flag check
if (process.env.RATE_LIMIT_BYPASS === 'true' && process.env.NODE_ENV === 'production') {
  console.error('FATAL SECURITY ERROR: RATE_LIMIT_BYPASS cannot be used in production mode.');
  process.exit(1);
}

import { verifyTextContent } from '../server/src/services/gemini.js';

// Benchmark claims used if claims.csv contains FILL placeholders
const SAMPLE_BENCHMARK_CLAIMS = [
  {
    claim: 'Water boils at 100 degrees Celsius at standard sea-level atmospheric pressure.',
    true_label: 'Supported',
    reference_source: 'Standard Physics & NIST Reference',
    category: 'established',
  },
  {
    claim: 'The Moon is composed of green cheese according to recent lunar seismic studies.',
    true_label: 'Contradicted',
    reference_source: 'NASA Apollo Lunar Science',
    category: 'established',
  },
  {
    claim: 'An undiscovered civilization of bioluminescent humanoids lives at the center of Jupiter.',
    true_label: 'Unverified',
    reference_source: 'NASA Juno Mission Data',
    category: 'should-be-unverified',
  },
  {
    claim: 'Caffeine intake is universally harmful to human health regardless of dosage or individual tolerance.',
    true_label: 'Mixed',
    reference_source: 'World Health Organization & Dietary Guidelines',
    category: 'mixed-contested',
  },
];

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser supporting unquoted or basic comma-separated fields
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length >= 2) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] || '';
      });
      rows.push(row);
    }
  }

  return rows;
}

async function main() {
  console.log('====================================================');
  console.log('       FreshDispatch Benchmark Evaluation Suite     ');
  console.log('====================================================\n');

  const csvPath = path.resolve(__dirname, 'claims.csv');
  let claimsToEvaluate = [];

  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const parsedRows = parseCsv(csvContent);
    const validRows = parsedRows.filter(r => r.claim && r.claim !== 'FILL' && r.true_label && r.true_label !== 'FILL');

    if (validRows.length > 0) {
      console.log(`Loaded ${validRows.length} active claim(s) from eval/claims.csv.`);
      claimsToEvaluate = validRows;
    } else {
      console.log('Note: eval/claims.csv contains FILL placeholders.');
      console.log('Running evaluation on standard 4-category benchmark set to measure enforcement & accuracy.\n');
      claimsToEvaluate = SAMPLE_BENCHMARK_CLAIMS;
    }
  } else {
    console.log('eval/claims.csv not found; running sample benchmark set.\n');
    claimsToEvaluate = SAMPLE_BENCHMARK_CLAIMS;
  }

  const results = [];
  let autoCorrectedCount = 0;
  let matchesWithEnforcement = 0;
  let matchesWithoutEnforcement = 0;

  for (let i = 0; i < claimsToEvaluate.length; i++) {
    const item = claimsToEvaluate[i];
    console.log(`[${i + 1}/${claimsToEvaluate.length}] Evaluating claim (${item.category || 'general'}):`);
    console.log(`     Claim: "${item.claim}"`);
    console.log(`     Expected: ${item.true_label}`);

    try {
      // Execute two-call pipeline
      const response = await verifyTextContent(item.claim);
      const evaluatedClaim = response.claims?.[0];

      if (!evaluatedClaim) {
        console.warn('     [WARN] No claims returned by pipeline.');
        continue;
      }

      const finalVerdict = evaluatedClaim.verdict;
      const rawVerdict = evaluatedClaim.originalVerdict || finalVerdict;
      const wasCorrected = Boolean(evaluatedClaim.wasAutoCorrected);
      const survivingSources = evaluatedClaim.evidence?.length || 0;

      if (wasCorrected) {
        autoCorrectedCount++;
      }

      const isCorrectWith = finalVerdict.toLowerCase() === item.true_label.toLowerCase();
      const isCorrectWithout = rawVerdict.toLowerCase() === item.true_label.toLowerCase();

      if (isCorrectWith) matchesWithEnforcement++;
      if (isCorrectWithout) matchesWithoutEnforcement++;

      console.log(`     Model Output: ${rawVerdict} | Code Enforced: ${finalVerdict} (Auto-corrected: ${wasCorrected})`);
      console.log(`     Cited Sources: ${survivingSources} | Result: ${isCorrectWith ? 'MATCH' : 'MISMATCH'}\n`);

      results.push({
        claim: item.claim,
        category: item.category,
        expected: item.true_label,
        rawModelVerdict: rawVerdict,
        finalEnforcedVerdict: finalVerdict,
        wasAutoCorrected: wasCorrected,
        survivingSourcesCount: survivingSources,
        isCorrectWithEnforcement: isCorrectWith,
        isCorrectWithoutEnforcement: isCorrectWithout,
        explanation: evaluatedClaim.explanation,
        limitations: evaluatedClaim.limitations,
      });

      // Polite delay between requests to stay well within AI Studio RPM limits
      if (i < claimsToEvaluate.length - 1) {
        await new Promise(res => setTimeout(res, 2500));
      }
    } catch (err) {
      console.error(`     [ERROR] Evaluation failed for claim: ${err.message}\n`);
      results.push({
        claim: item.claim,
        category: item.category,
        expected: item.true_label,
        error: err.message,
      });
    }
  }

  const evaluatedTotal = results.filter(r => !r.error).length;
  const accuracyWith = evaluatedTotal > 0 ? ((matchesWithEnforcement / evaluatedTotal) * 100).toFixed(1) : 0;
  const accuracyWithout = evaluatedTotal > 0 ? ((matchesWithoutEnforcement / evaluatedTotal) * 100).toFixed(1) : 0;

  console.log('====================================================');
  console.log('               EVALUATION SUMMARY REPORT            ');
  console.log('====================================================');
  console.log(`Total Evaluated Claims:          ${evaluatedTotal}`);
  console.log(`Verdicts Auto-corrected:        ${autoCorrectedCount} / ${evaluatedTotal}`);
  console.log(`Accuracy WITH Code Enforcement:  ${accuracyWith}% (${matchesWithEnforcement}/${evaluatedTotal})`);
  console.log(`Accuracy WITHOUT Enforcement:    ${accuracyWithout}% (${matchesWithoutEnforcement}/${evaluatedTotal})`);
  console.log('====================================================\n');

  // Save report to eval/results/
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsDir = path.resolve(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultFilePath = path.join(resultsDir, `eval-${timestamp}.json`);
  const reportPayload = {
    timestamp: new Date().toISOString(),
    totalEvaluated: evaluatedTotal,
    autoCorrectedCount,
    accuracyWithEnforcementPercent: Number(accuracyWith),
    accuracyWithoutEnforcementPercent: Number(accuracyWithout),
    results,
  };

  fs.writeFileSync(resultFilePath, JSON.stringify(reportPayload, null, 2), 'utf-8');
  console.log(`Detailed evaluation log saved to:\n  ${resultFilePath}\n`);
}

main().catch(err => {
  console.error('Fatal eval error:', err);
  process.exit(1);
});
