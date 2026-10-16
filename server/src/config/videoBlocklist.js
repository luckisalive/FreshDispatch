// server/src/config/videoBlocklist.js
// Centralized video blocklist policy: hosts, path patterns, extensions, and MIME types

export const VIDEO_HOSTS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'tiktok.com',
  'dailymotion.com',
  'rumble.com',
  'bitchute.com',
  'twitch.tv',
];

export const VIDEO_PATH_PATTERNS = [
  { host: 'facebook.com', pathSegment: '/watch' },
  { host: 'instagram.com', pathSegment: '/reel' },
  { host: 'x.com', pathSegment: '/status' },
  { host: 'twitter.com', pathSegment: '/status' },
];

export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.flv',
  '.wmv',
  '.m4v',
  '.3gp',
  '.ogv',
];

export const VIDEO_CONTENT_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/x-flv',
  'video/x-ms-wmv',
  'video/ogg',
];

/**
 * Checks if a URL points to a known video host or video path pattern.
 * @param {string|URL} urlTarget 
 * @returns {boolean}
 */
export function isBlockedVideoUrl(urlTarget) {
  try {
    const url = typeof urlTarget === 'string' ? new URL(urlTarget) : urlTarget;
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // Check host list
    if (VIDEO_HOSTS.some(h => host === h || host.endsWith('.' + h))) {
      return true;
    }

    // Check path patterns for multi-content platforms
    if (VIDEO_PATH_PATTERNS.some(p => (host === p.host || host.endsWith('.' + p.host)) && pathname.includes(p.pathSegment))) {
      return true;
    }

    // Check direct video file extensions
    if (VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
