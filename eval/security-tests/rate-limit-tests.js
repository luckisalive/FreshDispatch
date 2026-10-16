// eval/security-tests/rate-limit-tests.js
import { app } from '../../server/src/index.js';

console.log('=== Running Rate Limit Security Tests ===\n');

const TEST_PORT = 3088;
const server = app.listen(TEST_PORT, async () => {
  try {
    const baseUrl = `http://localhost:${TEST_PORT}`;

    // Test 1: Verify server responds
    const health = await fetch(`${baseUrl}/api/health`);
    if (health.status !== 200) {
      throw new Error(`Health check failed with status ${health.status}`);
    }
    console.log('[PASS] Server health check OK');

    // Test 2: Rapid requests to test per-IP rate limiter (limit: 10/hr)
    console.log('Sending 14 rapid requests to trigger per-IP rate limiter (limit = 10)...');
    let got429 = false;
    let rateLimitResponse = null;

    for (let i = 1; i <= 14; i++) {
      const res = await fetch(`${baseUrl}/api/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', payload: '' }), // Invalid payload triggers 400 before Gemini
      });

      if (res.status === 429) {
        got429 = true;
        rateLimitResponse = await res.json();
        console.log(`[PASS] Request #${i} correctly returned HTTP 429 Rate Limit Exceeded`);
        break;
      }
    }

    if (!got429) {
      console.error('[FAIL] Did not receive HTTP 429 after 14 rapid requests!');
      process.exit(1);
    }

    console.log('       Rate limit message received:', rateLimitResponse?.error);
    console.log('\n[PASS] Rate limiting security tests passed successfully!\n');
  } catch (err) {
    console.error('[FAIL] Error during rate limit test:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
