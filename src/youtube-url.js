/**
 * YouTube URL Parser and Time Formatter Module.
 * Provides resilient video ID extraction, watch page verification, and timestamp formatting.
 */

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const KNOWN_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
  'youtu.be',
  'www.youtu.be'
]);

/**
 * Extracts an 11-character YouTube video ID from a URL, path, or string.
 *
 * @param {string} urlOrStr - The input URL, query string, or video ID.
 * @returns {string|null} The 11-character video ID, or null if invalid/not found.
 */
export function parseYouTubeVideoId(urlOrStr) {
  if (!urlOrStr || typeof urlOrStr !== 'string') {
    return null;
  }

  const trimmed = urlOrStr.trim();
  if (!trimmed) {
    return null;
  }

  // Case 1: The input is already a bare 11-character video ID
  if (YOUTUBE_VIDEO_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    // Parse using URL API; if relative, use youtube.com as base
    const parsed = new URL(trimmed, 'https://www.youtube.com');
    const hostname = parsed.hostname.toLowerCase();

    // Verify hostname is YouTube domain
    const isYouTubeDomain =
      KNOWN_YOUTUBE_HOSTS.has(hostname) ||
      hostname.endsWith('.youtube.com') ||
      hostname.endsWith('.youtu.be');

    // Case 2: Shortened youtu.be URL (e.g. https://youtu.be/dQw4w9WgXcQ?t=10)
    if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
      const candidate = parsed.pathname.slice(1).split('/')[0];
      if (YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
        return candidate;
      }
      return null;
    }

    if (!isYouTubeDomain) {
      return null;
    }

    // Case 3: Standard watch URL (e.g. /watch?v=dQw4w9WgXcQ or /watch_popup?v=...)
    if (parsed.pathname === '/watch' || parsed.pathname === '/watch_popup') {
      const v = parsed.searchParams.get('v');
      if (v && YOUTUBE_VIDEO_ID_REGEX.test(v)) {
        return v;
      }
      return null;
    }

    // Case 4: Path-based endpoints: /embed/ID, /shorts/ID, /live/ID, /v/ID
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const prefix = segments[0].toLowerCase();
      if (['embed', 'shorts', 'live', 'v'].includes(prefix)) {
        const candidate = segments[1];
        if (YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  } catch {
    // If URL parsing fails, check if string matches standard pattern
    const match = trimmed.match(
      /(?:v=|\/embed\/|\/shorts\/|\/live\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&#/]|$)/
    );
    if (match && YOUTUBE_VIDEO_ID_REGEX.test(match[1])) {
      return match[1];
    }
  }

  return null;
}

/**
 * Determines whether a URL or string represents a YouTube watch page with a valid video ID.
 *
 * @param {string} urlOrStr - The URL or string to test.
 * @returns {boolean} True if the input is a valid YouTube watch page.
 */
export function isYouTubeWatchUrl(urlOrStr) {
  if (!urlOrStr || typeof urlOrStr !== 'string') {
    return false;
  }

  const trimmed = urlOrStr.trim();
  const videoId = parseYouTubeVideoId(trimmed);
  if (!videoId) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, 'https://www.youtube.com');
    const hostname = parsed.hostname.toLowerCase();
    const isYouTubeDomain =
      KNOWN_YOUTUBE_HOSTS.has(hostname) ||
      hostname.endsWith('.youtube.com') ||
      hostname.endsWith('.youtu.be');

    if (!isYouTubeDomain) {
      return false;
    }

    return (
      parsed.pathname === '/watch' ||
      parsed.pathname === '/watch_popup' ||
      hostname === 'youtu.be' ||
      hostname.endsWith('.youtu.be') ||
      parsed.pathname.startsWith('/shorts/')
    );
  } catch {
    return false;
  }
}

/**
 * Formats a playback time in seconds into MM:SS (or HH:MM:SS if >= 3600 seconds).
 *
 * @param {number} seconds - Number of seconds.
 * @returns {string} Formatted timestamp string.
 */
export function formatTimestamp(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}
