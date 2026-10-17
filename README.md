# YouTube Misinformation Detector 🛡️ — Chrome Extension

A dedicated Manifest V3 Chrome Extension exclusively for YouTube that detects, tracks, and warns viewers about misinformation claims in real time during video playback, highlighting flagged sentences and providing an interactive timeline drawer with click-to-seek navigation.

---

## Features

- **In-Video Misinformation Warnings**: When video playback enters a sentence flagged as misinformation, a sleek warning card appears on the player displaying the claim, fact-check explanation, and verified source citations.
- **Interactive Claims Timeline Drawer**: A collapsible slide-out drawer on the right edge of YouTube listing all analyzed sentences chronologically. Each card shows the timestamp, sentence, verdict badge, explanation, and sources.
- **Click-to-Seek**: Clicking any timestamp pill or claim card immediately jumps the YouTube video player to that exact moment.
- **Verdict Classification**:
  - 🚨 `misinformation`: Flagged assertions with debunking context and reputable fact-checking sources.
  - ✅ `verified`: Factual, substantiated assertions.
  - ❓ `unknown`: Unverified claims requiring further corroboration.
- **Persistent In-Page Indicator**: A floating, pulsing status badge at the bottom-left (`🛡️ Misinfo Detector Active`) providing immediate confirmation that the detector is running and processing claims on the current video.
- **Full YouTube SPA Navigation Support**: Seamlessly detects video changes across client-side YouTube navigations (`yt-navigate-finish`, `popstate`, URL observer) without requiring page refreshes.
- **Ad & Fullscreen Awareness**: Automatically suppresses warning overlays while YouTube video ads play and scales overlays cleanly when entering fullscreen mode.
- **Extension Popup Controls**: Easily toggle the detector master switch, enable/disable in-video overlays, and view aggregate claim statistics for the active video.

---

## Project Structure

```
├── manifest.json            # Manifest V3 extension configuration (YouTube host permissions)
├── src/
│   ├── youtube-url.js       # URL parsing, video ID extraction, and timestamp formatting
│   ├── claim-service.js     # Claim schema validation, seeded datasets, and deterministic fallback
│   ├── video-tracker.js     # Timeupdate synchronization, ad suppression, and seek controller
│   ├── overlay-manager.js   # In-video warning cards & dismiss lifecycle
│   ├── drawer-manager.js    # Collapsible timeline drawer with verdict filter chips
│   ├── content.js           # Content script coordinator & SPA navigation hooks
│   ├── content-bundle.js    # Bundled IIFE distribution script for Chrome execution
│   ├── storage.js           # chrome.storage.local wrapper for user preferences
│   ├── background.js        # Service worker for extension lifecycle
│   └── styles.css           # YouTube-native CSS variables and animation styles
├── popup/
│   ├── popup.html           # Accessible popup interface with master toggles and metrics
│   ├── popup.css            # Dark/light theme styling matching YouTube aesthetics
│   └── popup.js             # Popup controller & active tab statistics loader
├── icons/                   # Vector source and 16px, 48px, 128px PNG icons
├── tests/
│   ├── youtube-url.test.js  # Unit tests for URL and ID extraction
│   ├── claim-service.test.js# Schema, seeded data, and 100-run determinism tests
│   ├── video-tracker.test.js# Playback window matching, boundary tolerances, and ad checks
│   ├── dom-components.test.js # DOM component rendering, XSS sanitization, and seek tests
│   ├── adversarial-stress.test.js # Stress testing under extreme inputs and edge cases
│   ├── adversarial-ui-dom.test.js # DOM injection resilience under rapid mutations
│   └── e2e.test.js          # Automated end-to-end suite running in real Google Chrome
└── package.json
```

---

## Installation in Chrome

1. Open **Google Chrome** and go to `chrome://extensions`.
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. Click the **Load unpacked** button in the top-left toolbar.
4. Select this directory:
   ```
   /Users/kadirpili/Documents/chrome-extension
   ```
5. Open any YouTube video (e.g. `https://www.youtube.com/watch?v=dQw4w9WgXcQ`).
6. You will see:
   - The glowing **`🛡️ Misinfo Detector Active`** status badge at the bottom-left.
   - The **`Claims`** tab on the right side of the screen.
   - In-video warning cards whenever playback reaches a flagged claim.

---

## Testing

Run all unit tests:
```bash
npm test
```

Run real Google Chrome E2E browser tests:
```bash
npm run test:e2e
```

Run full test suite:
```bash
npm run test:all
```
