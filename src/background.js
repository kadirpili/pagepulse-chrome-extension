/**
 * Service Worker (Background script) for YouTube Misinformation Detector Extension.
 * Handles lifecycle events and background default configuration.
 */

import { DEFAULT_SETTINGS, STORAGE_KEYS } from './storage.js';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
        if (!result || !result[STORAGE_KEYS.SETTINGS]) {
          chrome.storage.local.set({
            [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
          });
        }
      });
    }
  }
});
