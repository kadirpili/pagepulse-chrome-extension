/**
 * Google Analytics 4 (GA4) Client for Manifest V3 Chrome Extension.
 *
 * Implements the official Google Analytics Measurement Protocol for Chrome Extensions:
 * https://developer.chrome.com/docs/extensions/how-to/integrate/google-analytics-4
 *
 * - 100% Manifest V3 compliant (Zero remote <script> tags).
 * - Dispatches anonymous, non-PII telemetry events directly to GA4.
 * - Fails silently so network or ad-blocker blocks never interrupt core functionality.
 */

export const GA_MEASUREMENT_ID = 'G-2W1DT6P31T';
const GA_ENDPOINT = 'https://www.google-analytics.com/g/collect';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

let cachedClientId = null;
let currentSessionId = null;
let lastActivityTime = 0;

/**
 * Retrieves or initializes a persistent anonymous client UUID in chrome.storage.local.
 * @returns {Promise<string>}
 */
export async function getOrCreateClientId() {
  if (cachedClientId) return cachedClientId;

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    cachedClientId = 'anon_' + Math.random().toString(36).substring(2, 12);
    return cachedClientId;
  }

  return new Promise((resolve) => {
    chrome.storage.local.get(['ga_client_id'], (result) => {
      if (result && result.ga_client_id) {
        cachedClientId = result.ga_client_id;
        return resolve(cachedClientId);
      }

      const newId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'ga_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

      cachedClientId = newId;
      chrome.storage.local.set({ ga_client_id: newId }, () => {
        resolve(newId);
      });
    });
  });
}

/**
 * Returns a session ID, rotating after 30 minutes of inactivity.
 * @returns {string}
 */
export function getSessionId() {
  const now = Date.now();
  if (!currentSessionId || now - lastActivityTime > SESSION_TIMEOUT_MS) {
    currentSessionId = Math.floor(now / 1000).toString();
  }
  lastActivityTime = now;
  return currentSessionId;
}

/**
 * Tracks an event in Google Analytics 4 via the HTTP collection endpoint.
 *
 * @param {string} eventName - Standardized event name (e.g. 'popup_opened', 'factcheck_completed')
 * @param {Object} [eventParams={}] - Custom parameters for the event
 * @returns {Promise<void>}
 */
export async function trackEvent(eventName, eventParams = {}) {
  try {
    const clientId = await getOrCreateClientId();
    const sessionId = getSessionId();

    const params = new URLSearchParams({
      v: '2',
      tid: GA_MEASUREMENT_ID,
      cid: clientId,
      sid: sessionId,
      en: eventName,
      _p: Date.now().toString(),
      ul: typeof navigator !== 'undefined' ? (navigator.language || 'en-us').toLowerCase() : 'en-us',
    });

    // Append custom params with 'ep.' prefix for GA4 custom dimensions
    for (const [key, value] of Object.entries(eventParams)) {
      if (value !== undefined && value !== null) {
        params.set(`ep.${key}`, String(value));
      }
    }

    const targetUrl = `${GA_ENDPOINT}?${params.toString()}`;

    // Prefer fetch with keepalive; fallback to sendBeacon or standard fetch
    if (typeof fetch === 'function') {
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
      });
    } else if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(targetUrl);
    }
  } catch (err) {
    // Fail silently; analytics must never interrupt extension operation
    console.debug('[YouTube Misinfo Analytics] Dispatch note:', err.message);
  }
}
