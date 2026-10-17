/**
 * Service Worker (Background script) for PagePulse Chrome Extension.
 * Handles lifecycle events and background configuration.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('PagePulse extension installed successfully.');

    // Initialize default storage values if not already present
    chrome.storage.local.get(['pagepulse_settings'], (result) => {
      if (!result.pagepulse_settings) {
        chrome.storage.local.set({
          pagepulse_settings: {
            readingWpm: 200,
            speakingWpm: 130,
            theme: 'system'
          }
        });
      }
    });
  }
});
