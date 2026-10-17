/**
 * Service Worker (Background script) for YouTube Misinformation Detector Extension.
 * Handles lifecycle events, background default configuration, and proxying cross-origin API calls.
 */

import { DEFAULT_SETTINGS, STORAGE_KEYS } from './storage.js';
import { fetchClaimsFromBackend, DEFAULT_PROD_ENDPOINT } from './claim-service.js';

/**
 * Synchronizes and migrates extension settings in chrome.storage.local.
 * Guarantees that PROD mode is active and that exampleapi is never used.
 */
function syncSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
      const existing = result && result[STORAGE_KEYS.SETTINGS];
      const updated = { ...DEFAULT_SETTINGS, ...(existing || {}) };

      // Ensure never exampleapi in PROD
      if (!updated.apiEndpoint || updated.apiEndpoint.includes('exampleapi.com')) {
        updated.apiEndpoint = DEFAULT_PROD_ENDPOINT;
      }

      // If user had legacy settings without explicit mode, default to PROD
      if (!existing || typeof existing.mode !== 'string') {
        updated.mode = 'prod';
      }

      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated }, () => {
        console.log('[YouTube Misinfo Background] Initialized settings. Mode:', updated.mode, 'Endpoint:', updated.apiEndpoint);
      });
    });
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled.addListener(() => {
    syncSettings();
  });

  if (chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
      syncSettings();
    });
  }

  // Handle cross-origin fetch requests dispatched from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'FETCH_CLAIMS' && request.videoId) {
      const rawEndpoint = request.endpoint || DEFAULT_PROD_ENDPOINT;
      const endpoint = rawEndpoint.includes('exampleapi.com') ? DEFAULT_PROD_ENDPOINT : rawEndpoint;

      console.log('[YouTube Misinfo Background] Processing FETCH_CLAIMS for:', request.videoId, 'via:', endpoint);

      fetchClaimsFromBackend(request.videoId, endpoint, {
        isBackground: true,
        authToken: request.authToken
      })
        .then((claims) => {
          console.log('[YouTube Misinfo Background] Successfully fetched', claims.length, 'claims for:', request.videoId);
          sendResponse({ success: true, claims });
        })
        .catch((err) => {
          console.warn('[YouTube Misinfo Background] Fetch error for', request.videoId, ':', err.message);
          sendResponse({ success: false, error: err.message, claims: [] });
        });

      return true; // Keep message channel open for async response
    }
  });
}

// Initial sync on service worker load
syncSettings();
