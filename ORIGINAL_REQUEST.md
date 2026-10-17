# Original User Request

## Initial Request — 2026-10-17T05:54:41Z

A dedicated Manifest V3 Chrome Extension exclusively for YouTube that detects, tracks, and warns viewers about misinformation in real-time as video plays, highlighting flagged sentences and providing an interactive timeline drawer.

Working directory: /Users/kadirpili/Documents/chrome-extension
Integrity mode: development

## Requirements

### R1. YouTube In-Page Integration & SPA Navigation Handling
- The extension runs exclusively on YouTube watch pages (`*://*.youtube.com/watch*`).
- Detects video ID updates across both initial page loads and client-side YouTube Single-Page-App (SPA) navigations (`yt-navigate-finish`, URL popstate, or DOM mutation observers) without requiring manual page reloads.

### R2. Video Claim & Sentence Data Retrieval
- Given an active YouTube video ID, retrieve analysis records structured as:
  ```json
  [
    {
      "timestamp": 42.5,
      "sentence": "Sample excerpt from video speech or transcript",
      "verdict": "misinformation" | "verified" | "unknown",
      "explanation": "Context explaining why this statement is flagged or confirmed",
      "sources": ["https://factcheck.org/..."]
    }
  ]
  ```
- For the initial release, implement a mock data service that provides rich, realistic timestamped claims for YouTube video IDs with fallback default demo datasets for any arbitrary video ID.

### R3. In-Video Warnings & Interactive Timeline Drawer UI
- **In-Video Warning Overlay**: When the current playback time (`currentTime`) aligns with a sentence flagged as `misinformation`, display a clean, non-intrusive warning card/banner on or directly adjacent to the YouTube video player.
- **Side Panel / Interactive Drawer**: Embed a collapsible, YouTube-native styled panel beside the player or comments section listing all analyzed sentences chronologically.
  - Color-coded badges for verdicts (`misinformation` = warning red/amber, `verified` = green, `unknown` = neutral gray).
  - Clicking any sentence jumps the YouTube player to that specific timestamp.
- **Popup & Settings**: Extension popup provides global toggle, summary stats of claims for the current video, and filter toggles.

## Acceptance Criteria

### Automated Verification
- [ ] Comprehensive unit test suite covering:
  - Video ID extraction from standard and short YouTube URLs.
  - Sentence retrieval, parsing, and fallback matching for arbitrary video IDs.
  - Playback time synchronization logic (detecting active claim at given `currentTime` with tolerance windows).
- [ ] Automated browser / DOM test verifying:
  - Injection and rendering of overlay warnings on simulated video player elements.
  - Click-to-seek functionality triggering video seek updates.
  - Accurate verdict style application and drawer visibility toggling.
- [ ] Linting, type/syntax checks, and code readability passing without warnings.


## Follow-up — 2026-10-17T06:32:53Z

User reported: "it is not showing on youtube, why? please show some indidcation that it is working and processing osmewhere in youtube page".

Fixes applied:
1. Content script bundled with esbuild into src/content-bundle.js (IIFE format) and updated manifest.json to point to it, resolving the browser "Cannot use import statement outside a module" syntax error.
2. Added mock fallback claims for all video IDs via deterministic generator.
3. Added a persistent visual indicator badge at bottom-left ("🛡️ Misinfo Detector Active (N claims)") that pulses on YouTube watch pages so the user immediately sees it running and processing, plus clicking it opens the claims drawer.
4. Added 1-second interval SPA navigation fallback in content.js to catch fast YouTube client-side transitions.

Please incorporate these changes into your review and ensure Milestone 2 E2E tests verify the bundle and the visual indicator.
