// eval/security-tests/ssrf-tests.js
import { isSafeIP, validateHostname, safeFetch } from '../../server/src/services/safeFetch.js';

console.log('=== Running SSRF & IP Allowlist Security Tests ===\n');

// 1. Test isSafeIP directly across diverse IP encodings and ranges
const IP_TEST_CASES = [
  { ip: '127.0.0.1', expectedSafe: false, reason: 'IPv4 loopback' },
  { ip: '::1', expectedSafe: false, reason: 'IPv6 loopback' },
  { ip: '2130706433', expectedSafe: false, reason: 'Decimal IP (127.0.0.1)' },
  { ip: '169.254.169.254', expectedSafe: false, reason: 'Cloud metadata / link-local' },
  { ip: '::ffff:127.0.0.1', expectedSafe: false, reason: 'IPv4-mapped IPv6 loopback' },
  { ip: '::ffff:169.254.169.254', expectedSafe: false, reason: 'IPv4-mapped metadata' },
  { ip: '10.0.0.1', expectedSafe: false, reason: 'Private Class A (10.0.0.0/8)' },
  { ip: '172.16.0.1', expectedSafe: false, reason: 'Private Class B (172.16.0.0/12)' },
  { ip: '192.168.1.1', expectedSafe: false, reason: 'Private Class C (192.168.0.0/16)' },
  { ip: '100.64.0.1', expectedSafe: false, reason: 'Carrier-Grade NAT / CGNAT (100.64.0.0/10)' },
  { ip: '0.0.0.0', expectedSafe: false, reason: 'Unspecified address (0.0.0.0/8)' },
  { ip: '224.0.0.1', expectedSafe: false, reason: 'Multicast address' },
  { ip: '255.255.255.255', expectedSafe: false, reason: 'Broadcast address' },
  { ip: 'fc00::1', expectedSafe: false, reason: 'IPv6 Unique Local Address' },
  // Valid public unicast IPs
  { ip: '8.8.8.8', expectedSafe: true, reason: 'Google Public DNS (Unicast)' },
  { ip: '1.1.1.1', expectedSafe: true, reason: 'Cloudflare DNS (Unicast)' },
  { ip: '93.184.216.34', expectedSafe: true, reason: 'example.com (Unicast)' },
  { ip: '2606:4700:4700::1111', expectedSafe: true, reason: 'Cloudflare IPv6 (Unicast)' },
];

let ipPassed = 0;
for (const tc of IP_TEST_CASES) {
  const safe = isSafeIP(tc.ip);
  if (safe === tc.expectedSafe) {
    console.log(`[PASS] IP Check: ${tc.ip.padEnd(26)} -> ${safe ? 'ALLOWED' : 'BLOCKED'} (${tc.reason})`);
    ipPassed++;
  } else {
    console.error(`[FAIL] IP Check: ${tc.ip} -> got ${safe}, expected ${tc.expectedSafe} (${tc.reason})`);
  }
}

// 2. Test safeFetch URL validations and hostname checks
const URL_TEST_CASES = [
  { url: 'http://127.0.0.1/admin', expectBlocked: true, reason: 'Direct loopback IP' },
  { url: 'http://[::1]/secret', expectBlocked: true, reason: 'Direct IPv6 loopback' },
  { url: 'http://169.254.169.254/latest/meta-data/', expectBlocked: true, reason: 'AWS/GCP metadata IP' },
  { url: 'http://2130706433/', expectBlocked: true, reason: 'Decimal encoded IP' },
  { url: 'http://localhost:3001/', expectBlocked: true, reason: 'Localhost domain' },
  { url: 'ftp://example.com/file.txt', expectBlocked: true, reason: 'FTP protocol rejected' },
  { url: 'file:///etc/passwd', expectBlocked: true, reason: 'File protocol rejected' },
  { url: 'http://example.com:8080/page', expectBlocked: true, reason: 'Non-standard port 8080 blocked' },
  { url: 'http://example.com:22/ssh', expectBlocked: true, reason: 'Port 22 blocked' },
];

let urlPassed = 0;
for (const tc of URL_TEST_CASES) {
  try {
    validateHostname(new URL(tc.url).hostname);
    // If not thrown by validateHostname, try safeFetch
    await safeFetch(tc.url);
    if (tc.expectBlocked) {
      console.error(`[FAIL] Expected ${tc.url} to be blocked! (${tc.reason})`);
    } else {
      urlPassed++;
    }
  } catch (err) {
    if (tc.expectBlocked) {
      console.log(`[PASS] URL Blocked: ${tc.url.padEnd(38)} (${tc.reason}) -> ${err.message}`);
      urlPassed++;
    } else {
      console.error(`[FAIL] Expected ${tc.url} to succeed but got: ${err.message}`);
    }
  }
}

console.log(`\nResults: ${ipPassed}/${IP_TEST_CASES.length} IP tests passed, ${urlPassed}/${URL_TEST_CASES.length} URL tests passed.\n`);

if (ipPassed !== IP_TEST_CASES.length || urlPassed !== URL_TEST_CASES.length) {
  process.exit(1);
}
