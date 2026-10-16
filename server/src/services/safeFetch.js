// server/src/services/safeFetch.js
import { Agent, fetch as undiciFetch } from 'undici';
import { lookup as dnsLookup } from 'node:dns';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { VIDEO_CONTENT_TYPES, isBlockedVideoUrl } from '../config/videoBlocklist.js';
import { AppError } from '../middleware/errorHandler.js';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB size cap
const ALLOWED_PORTS = new Set(['', '80', '443']);

/**
 * Validates an IP address using an ALLOWLIST approach.
 * Only 'unicast' IP addresses (globally routable public addresses) are permitted.
 * All non-unicast ranges (loopback, private, link-local, carrier-grade NAT, multicast, reserved) are blocked.
 * 
 * @param {string} ipStr 
 * @returns {boolean} true if safe unicast IP, false otherwise
 */
export function isSafeIP(ipStr) {
  if (typeof ipStr !== 'string') return false;

  try {
    let addr;
    // Check if bracketed IPv6
    const cleanIp = ipStr.startsWith('[') && ipStr.endsWith(']') ? ipStr.slice(1, -1) : ipStr;

    // Handle decimal or hex representations by parsing if needed
    if (/^\d+$/.test(cleanIp)) {
      const num = parseInt(cleanIp, 10);
      if (num < 0 || num > 4294967295) return false;
      const b1 = (num >>> 24) & 255;
      const b2 = (num >>> 16) & 255;
      const b3 = (num >>> 8) & 255;
      const b4 = num & 255;
      addr = ipaddr.parse(`${b1}.${b2}.${b3}.${b4}`);
    } else {
      addr = ipaddr.parse(cleanIp);
    }

    // Unwrap IPv4-mapped IPv6 (::ffff:127.0.0.1 -> 127.0.0.1)
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }

    // ALLOWLIST: Only 'unicast' is accepted
    // Rejects: loopback, private, linkLocal, uniqueLocal, reserved, multicast, broadcast, carrierGradeNat, unspecified
    return addr.range() === 'unicast';
  } catch {
    return false; // Any unparseable IP is blocked by default
  }
}

/**
 * Checks if a hostname matches any blocked video host (including subdomains).
 */
export function isVideoHost(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const lower = hostname.toLowerCase();
  return VIDEO_HOSTS.some(host => lower === host || lower.endsWith('.' + host));
}

/**
 * Validates whether the hostname is an IP-literal and rejects it if not safe.
 */
export function validateHostname(hostname) {
  const cleanHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  // Check if hostname is an IPv4 or IPv6 literal or raw integer
  if (net.isIP(cleanHost) || /^\d+$/.test(cleanHost) || /^0x[0-9a-fA-F]+$/i.test(cleanHost)) {
    if (!isSafeIP(cleanHost)) {
      throw new AppError(`Access denied: IP-literal host ${hostname} is in a restricted range.`, 403);
    }
  }
}

/**
 * Creates an undici Agent whose DNS lookup hook validates every resolved IP address
 * against the unicast allowlist before socket connection, pinning DNS and preventing DNS rebinding.
 */
function createSafeAgent() {
  return new Agent({
    connect: {
      lookup: (hostname, options, callback) => {
        // Resolve all addresses for this hostname
        dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
          if (err) return callback(err);

          if (!addresses || addresses.length === 0) {
            return callback(new Error(`DNS resolution failed for host ${hostname}: No addresses found.`));
          }

          // Validate EVERY resolved address against the allowlist
          for (const entry of addresses) {
            const ip = typeof entry === 'string' ? entry : entry.address;
            if (!isSafeIP(ip)) {
              return callback(new Error(`SSRF Blocked: Host ${hostname} resolves to restricted IP ${ip}.`));
            }
          }

          // Honor options.all
          if (options.all) {
            return callback(null, addresses);
          }

          const first = addresses[0];
          return callback(null, first.address, first.family);
        });
      },
      rejectUnauthorized: true, // Enforce strict TLS certificate verification
    },
  });
}

const safeAgent = createSafeAgent();

/**
 * Safely fetches a web page with multi-layered SSRF protection, DNS pinning,
 * manual redirect validation, video content blocking, and size limits.
 *
 * @param {string} rawUrl 
 * @returns {Promise<{ html: string, finalUrl: string, contentType: string }>}
 */
export async function safeFetch(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError('Invalid URL provided.', 400);
  }

  // Protocol check: http/https only
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError(`Unsupported protocol "${url.protocol}". Only http and https are allowed.`, 400);
  }

  // Port check: standard ports 80/443 only
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new AppError(`Access denied: Non-standard port "${url.port}" is not allowed.`, 403);
  }

  // Video host & path check before network activity
  if (isBlockedVideoUrl(url)) {
    throw new AppError("Video analysis isn't supported. Please paste the text, a screenshot, or an article link instead.", 400);
  }

  // Validate IP-literal hostnames
  validateHostname(url.hostname);

  let currentUrl = url.toString();
  let redirectCount = 0;

  // Single AbortController covering fetch + streaming of body
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    while (true) {
      const response = await undiciFetch(currentUrl, {
        dispatcher: safeAgent,
        redirect: 'manual', // Manual redirect control to validate each hop
        signal: controller.signal,
        headers: {
          'User-Agent': 'FreshDispatch/1.0 (+https://github.com/verifylens/freshdispatch)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      // Handle Redirects manually (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          throw new AppError('Exceeded maximum allowed redirects (3).', 400);
        }

        const location = response.headers.get('location');
        if (!location) {
          throw new AppError('Redirect response missing Location header.', 400);
        }

        const nextUrl = new URL(location, currentUrl);

        // Re-validate protocol, port, video host, and IP literal on redirect destination
        if (!['http:', 'https:'].includes(nextUrl.protocol)) {
          throw new AppError('Redirect to non-HTTP protocol blocked.', 403);
        }
        if (!ALLOWED_PORTS.has(nextUrl.port)) {
          throw new AppError('Redirect to non-standard port blocked.', 403);
        }
        if (isBlockedVideoUrl(nextUrl)) {
          throw new AppError("Video analysis isn't supported. Please paste the text, a screenshot, or an article link instead.", 400);
        }
        validateHostname(nextUrl.hostname);

        currentUrl = nextUrl.toString();
        continue;
      }

      if (!response.ok) {
        throw new AppError(`Failed to fetch webpage: Remote server responded with status ${response.status}.`, 400);
      }

      // Content-type check: block video streams
      const contentType = response.headers.get('content-type') || '';
      const isVideoContent = contentType.startsWith('video/') ||
        VIDEO_CONTENT_TYPES.some(t => contentType.toLowerCase().includes(t));

      if (isVideoContent) {
        throw new AppError("Video analysis isn't supported. Please paste the text, a screenshot, or an article link instead.", 400);
      }

      // Stream body with hard size limit (2 MB)
      const reader = response.body.getReader();
      const chunks = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;
        if (totalBytes > MAX_BODY_BYTES) {
          reader.cancel();
          throw new AppError('Webpage content exceeds maximum allowed size of 2 MB.', 400);
        }
        chunks.push(value);
      }

      const bodyBuffer = Buffer.concat(chunks);
      const html = bodyBuffer.toString('utf-8');

      return {
        html,
        finalUrl: currentUrl,
        contentType,
      };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError('Webpage request timed out after 10 seconds.', 408);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
