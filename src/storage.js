/**
 * Settings and preferences storage manager with dual-mode support:
 * 1. chrome.storage.local for production Chrome Extension environment.
 * 2. In-memory store for Node.js unit tests and mock environments.
 */

export const STORAGE_KEYS = Object.freeze({
  SETTINGS: 'yt_misinfo_settings'
});

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  showOverlays: true,
  filterVerdict: 'all', // 'all' | 'misinformation' | 'verified' | 'unknown'
  mode: 'prod',         // Default to PROD mode (real fact-check API backend)
  apiEndpoint: 'https://d3tuhog92nak7r.cloudfront.net/factcheck',
  apiKey: '91b24cc09314aca901d8153cdacd741a730345f394ed61aa20b02ae92ea9b9fb'
});

/**
 * Checks whether chrome.storage.local API is present and functional.
 * @returns {boolean}
 */
export function hasChromeStorage() {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.storage) &&
    Boolean(chrome.storage.local) &&
    typeof chrome.storage.local.get === 'function'
  );
}

// In-memory storage for test runners
let memoryStore = {};
const memoryListeners = new Set();

/**
 * Resets the in-memory cache and clears listeners.
 */
export function resetMemoryStore() {
  memoryStore = {};
  memoryListeners.clear();
}

/**
 * Directly seeds in-memory store for testing.
 * @param {Object} data
 */
export function setMemoryStore(data) {
  memoryStore = { ...data };
}

/**
 * Retrieves the current extension settings, merging with defaults.
 * @returns {Promise<{ enabled: boolean, showOverlays: boolean, filterVerdict: string, mode: string, apiEndpoint: string, apiKey: string }>}
 */
export async function getSettings() {
  let settings;
  if (hasChromeStorage()) {
    settings = await new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
        const saved = result && result[STORAGE_KEYS.SETTINGS];
        resolve({ ...DEFAULT_SETTINGS, ...(saved || {}) });
      });
    });
  } else {
    const saved = memoryStore[STORAGE_KEYS.SETTINGS];
    settings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  }

  // Safety: NEVER allow exampleapi in PROD; sanitize legacy stored values
  if (!settings.apiEndpoint || settings.apiEndpoint.includes('exampleapi.com')) {
    settings.apiEndpoint = DEFAULT_SETTINGS.apiEndpoint;
    if (hasChromeStorage()) {
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    }
  }

  return settings;
}

/**
 * Updates extension settings with partial values and broadcasts changes.
 * @param {Partial<{ enabled: boolean, showOverlays: boolean, filterVerdict: string }>} partial
 * @returns {Promise<{ enabled: boolean, showOverlays: boolean, filterVerdict: string }>}
 */
export async function saveSettings(partial) {
  if (!partial || typeof partial !== 'object') {
    throw new TypeError('saveSettings requires a settings object.');
  }

  const current = await getSettings();
  const updated = { ...current };

  if (typeof partial.enabled === 'boolean') {
    updated.enabled = partial.enabled;
  }
  if (typeof partial.showOverlays === 'boolean') {
    updated.showOverlays = partial.showOverlays;
  }
  if (typeof partial.filterVerdict === 'string') {
    const valid = ['all', 'misinformation', 'verified', 'unknown'];
    if (valid.includes(partial.filterVerdict)) {
      updated.filterVerdict = partial.filterVerdict;
    }
  }
  if (typeof partial.mode === 'string') {
    const validModes = ['test', 'prod'];
    if (validModes.includes(partial.mode)) {
      updated.mode = partial.mode;
    }
  }
  if (typeof partial.apiEndpoint === 'string' && partial.apiEndpoint.trim().length > 0) {
    const trimmed = partial.apiEndpoint.trim();
    updated.apiEndpoint = trimmed.includes('exampleapi.com') ? DEFAULT_SETTINGS.apiEndpoint : trimmed;
  }
  if (typeof partial.apiKey === 'string') {
    updated.apiKey = partial.apiKey.trim();
  }

  if (hasChromeStorage()) {
    await new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated }, () => {
        resolve();
      });
    });
  } else {
    memoryStore[STORAGE_KEYS.SETTINGS] = updated;
    memoryListeners.forEach((callback) => {
      try {
        callback(updated);
      } catch (err) {
        console.error('Error in memory settings listener:', err);
      }
    });
  }

  return updated;
}

/**
 * Registers a change listener that triggers whenever settings are modified.
 * Returns an unsubscribe cleanup function.
 * @param {(newSettings: Object) => void} callback
 * @returns {() => void}
 */
export function onSettingsChanged(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('onSettingsChanged callback must be a function.');
  }

  if (hasChromeStorage() && chrome.storage.onChanged) {
    const chromeListener = (changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEYS.SETTINGS]) {
        const newValue = changes[STORAGE_KEYS.SETTINGS].newValue || DEFAULT_SETTINGS;
        callback({ ...DEFAULT_SETTINGS, ...newValue });
      }
    };
    chrome.storage.onChanged.addListener(chromeListener);
    return () => chrome.storage.onChanged.removeListener(chromeListener);
  }

  memoryListeners.add(callback);
  return () => {
    memoryListeners.delete(callback);
  };
}
