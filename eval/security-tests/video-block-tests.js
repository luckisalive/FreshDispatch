// eval/security-tests/video-block-tests.js
import { isVideoUrl } from '../../client/src/config/videoBlocklist.js';
import { safeFetch } from '../../server/src/services/safeFetch.js';

console.log('=== Running Video Policy & Host Blocking Tests ===\n');

const VIDEO_URLS = [
  { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', reason: 'YouTube watch URL' },
  { url: 'https://youtu.be/dQw4w9WgXcQ', reason: 'YouTube short URL' },
  { url: 'https://vimeo.com/76979871', reason: 'Vimeo video' },
  { url: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', reason: 'TikTok video' },
  { url: 'https://www.dailymotion.com/video/x7tgad0', reason: 'Dailymotion video' },
  { url: 'https://www.facebook.com/watch/?v=10153231379946729', reason: 'Facebook Watch video' },
  { url: 'https://www.instagram.com/reel/C3b45a_uXyz/', reason: 'Instagram Reel' },
  { url: 'https://x.com/i/status/1234567890', reason: 'X / Twitter status video' },
  { url: 'https://rumble.com/v2abcde-breaking-news.html', reason: 'Rumble video' },
  { url: 'https://www.twitch.tv/videos/123456789', reason: 'Twitch video' },
  { url: 'https://example.com/media/reportage.mp4', reason: 'Direct .mp4 file' },
  { url: 'https://example.com/footage/clip.webm', reason: 'Direct .webm file' },
];

const NON_VIDEO_URLS = [
  { url: 'https://www.bbc.com/news/world-68000000', reason: 'Standard news article' },
  { url: 'https://en.wikipedia.org/wiki/Moon', reason: 'Wikipedia article' },
  { url: 'https://news.ycombinator.com/', reason: 'Hacker News forum' },
];

let clientPassed = 0;
for (const tc of VIDEO_URLS) {
  const isBlocked = isVideoUrl(tc.url);
  if (isBlocked) {
    console.log(`[PASS] Client Video Check: ${tc.url.padEnd(55)} -> BLOCKED (${tc.reason})`);
    clientPassed++;
  } else {
    console.error(`[FAIL] Client Video Check failed to block: ${tc.url} (${tc.reason})`);
  }
}

for (const tc of NON_VIDEO_URLS) {
  const isBlocked = isVideoUrl(tc.url);
  if (!isBlocked) {
    console.log(`[PASS] Client Non-Video:   ${tc.url.padEnd(55)} -> ALLOWED (${tc.reason})`);
    clientPassed++;
  } else {
    console.error(`[FAIL] Client Non-Video falsely blocked: ${tc.url}`);
  }
}

console.log('\n--- Testing Server-Side Video Rejection ---');
let serverPassed = 0;
for (const tc of VIDEO_URLS.slice(0, 5)) {
  try {
    await safeFetch(tc.url);
    console.error(`[FAIL] Server safeFetch failed to block: ${tc.url}`);
  } catch (err) {
    const isVideoMsg = err.message.includes("Video analysis isn't supported") ||
                       err.message.includes("Video content is not supported");
    if (isVideoMsg) {
      console.log(`[PASS] Server safeFetch:   ${tc.url.padEnd(55)} -> BLOCKED with message: "${err.message}"`);
      serverPassed++;
    } else {
      console.error(`[FAIL] Server safeFetch gave unexpected message for ${tc.url}: "${err.message}"`);
    }
  }
}

const totalClient = VIDEO_URLS.length + NON_VIDEO_URLS.length;
console.log(`\nResults: ${clientPassed}/${totalClient} client checks passed, ${serverPassed}/5 server checks passed.\n`);

if (clientPassed !== totalClient || serverPassed !== 5) {
  process.exit(1);
}
