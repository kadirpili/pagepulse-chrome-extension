# Codebase & Build Explorer Survey Report

**Agent**: Survey Agent 1 (`explorer_survey_1`)  
**Target Path**: `/Users/kadirpili/Documents/chrome-extension/.agents/teamwork/explorer_survey_1/handoff.md`  
**Date**: 2026-10-17T06:01:00Z  

---

## 1. Observation

### 1.1 Repository Structure and File Catalog
A complete directory inspection of `/Users/kadirpili/Documents/chrome-extension` revealed 19 tracked files across 5 directories:

```
/Users/kadirpili/Documents/chrome-extension/
├── .gitignore
├── ORIGINAL_REQUEST.md
├── README.md
├── package.json
├── package-lock.json
├── manifest.json
├── icons/
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background.js
│   ├── content.js
│   ├── stats.js
│   └── storage.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── tests/
    ├── stats.test.js
    ├── storage.test.js
    └── e2e.test.js
```

### 1.2 `package.json` and Dependencies
Inspected `/Users/kadirpili/Documents/chrome-extension/package.json`:
- **Name**: `"pagepulse-chrome-extension"` (v1.0.0, `"type": "module"`)
- **Description**: `"PagePulse - Chrome Extension for reading stats, word metrics, and quick notes"`
- **Dependencies**: No production runtime dependencies (`"dependencies"` is empty).
- **DevDependencies**: `"puppeteer": "^25.14.0"`.
- **Scripts**:
  - `"test": "node --test tests/stats.test.js tests/storage.test.js"`
  - `"test:e2e": "node tests/e2e.test.js"`
  - `"test:all": "node --test tests/stats.test.js tests/storage.test.js && node tests/e2e.test.js"`
- **Environment**:
  - Node.js version: `v25.6.1`
  - npm version: `11.12.1`
  - Chrome binary present at: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

### 1.3 `manifest.json` (Manifest V3)
Inspected `/Users/kadirpili/Documents/chrome-extension/manifest.json`:
- **Manifest Version**: `3`
- **Name**: `"PagePulse - Reading Stats & Notes"`
- **Permissions**: `["activeTab", "storage", "scripting"]`
- **Host Permissions**: None specified.
- **Background**: `service_worker: "src/background.js"`, `"type": "module"`.
- **Content Scripts**: Single match for `["<all_urls>"]` running `src/content.js` at `document_idle`.
- **Action**: `default_popup: "popup/popup.html"`, default icons in `icons/`.

### 1.4 Current Implementation Scope (`src/` and `popup/`)
- `src/stats.js` (161 lines): Pure algorithms for word counting (with CJK segmentation via `Intl.Segmenter`), character counts, paragraph counts, and reading/speaking times.
- `src/storage.js` (169 lines): Wrapper for `chrome.storage.local` with in-memory fallback for unit testing notes and settings (`readingWpm`, `speakingWpm`, `theme`).
- `src/content.js` (52 lines): Extracts text content and user selections from web pages.
- `src/background.js` (24 lines): Service worker initializing default settings on install.
- `popup/` (`popup.html` 160 lines, `popup.js` 463 lines, `popup.css` 456 lines): UI presenting reading metrics, note creation/listing/deletion, and reading speed settings.
- `icons/`: Blue stopwatch icon assets (`icon.svg`, `icon16.png`, `icon48.png`, `icon128.png`).

### 1.5 Current Testing Framework and Test Execution
- **Test Framework**: Native Node.js test runner (`node:test`, `node:assert/strict`) and Puppeteer for end-to-end testing against real Chrome.
- **Unit Test Execution (`npm test`)**:
  - Command: `node --test tests/stats.test.js tests/storage.test.js`
  - Result: 36/36 tests passing in ~94ms.
- **E2E Test Execution (`npm run test:e2e`)**:
  - Command: `node tests/e2e.test.js`
  - Launches real Google Chrome with `--load-extension=.`, navigates to popup, tests DOM interactions, notes, toast, and theme.
  - Result: 3/3 tests passing in ~2.8s.
- **Syntax Validation**: `node --check src/*.js popup/*.js tests/*.js` passes with zero errors.

### 1.6 User Requirements from `ORIGINAL_REQUEST.md`
`ORIGINAL_REQUEST.md` specifies a dedicated Manifest V3 Chrome Extension exclusively for YouTube:
1. **R1. YouTube In-Page Integration & SPA Navigation Handling**:
   - Runs exclusively on YouTube watch pages (`*://*.youtube.com/watch*`).
   - Detects video ID updates across initial page loads and client-side SPA navigations (`yt-navigate-finish`, URL popstate, or DOM mutation observers) without requiring manual page reloads.
2. **R2. Video Claim & Sentence Data Retrieval**:
   - Analysis records schema: `[ { "timestamp": 42.5, "sentence": "...", "verdict": "misinformation" | "verified" | "unknown", "explanation": "...", "sources": ["..."] } ]`.
   - Rich mock data service for specific YouTube video IDs plus deterministic fallback default demo datasets for arbitrary video IDs.
3. **R3. In-Video Warnings & Interactive Timeline Drawer UI**:
   - In-video warning overlay on or adjacent to player when video `currentTime` matches a `misinformation` sentence.
   - Collapsible side panel / interactive timeline drawer styled to match YouTube native theme, listing sentences chronologically with color-coded verdict badges.
   - Clicking any sentence jumps video player to that timestamp (`video.currentTime = ts`).
   - Popup with global toggle, video claim summary stats, and filter toggles.
4. **Automated Verification**:
   - Unit tests covering video ID extraction (standard and short YouTube URLs), sentence retrieval/fallback, and playback time synchronization logic.
   - Automated browser/DOM tests verifying overlay injection/rendering, click-to-seek, verdict styles, and drawer toggling.
   - Linting, syntax checks, and code readability passing without warnings.

---

## 2. Logic Chain

1. **Comparison with Existing Repository**:
   - *Observation*: The repository currently contains "PagePulse", a reading-stats and quick-notes extension.
   - *Deduction*: None of the YouTube misinformation detection functionality is currently implemented. The codebase represents a starter project/template that must be adapted, replaced, or rewritten to meet `ORIGINAL_REQUEST.md`.

2. **Manifest V3 and Permission Requirements**:
   - *Observation*: Existing `manifest.json` uses `<all_urls>` and generic reading permissions (`activeTab`, `storage`, `scripting`).
   - *Deduction*:
     - `content_scripts.matches` must be configured for YouTube. Because YouTube is a Single-Page Application (SPA) where users often navigate from `https://www.youtube.com/` (home/feed) to `https://www.youtube.com/watch?v=...` without a full page reload, injecting the content script on `*://*.youtube.com/*` (or `*://www.youtube.com/*`) is crucial. The script itself should verify whether the current URL is a watch page (`/watch?v=...`) and listen to YouTube lifecycle events (`yt-navigate-finish`, `yt-page-data-updated`, and History popstate).
     - Permissions needed: `"storage"` (for user settings: enable/disable toggle, severity filters, notification preference).

3. **YouTube In-Page Architecture (Player & Drawer Injection)**:
   - *Observation*: YouTube uses custom web components (`ytd-app`, `ytd-watch-flexy`, `#movie_player`, `#columns`, `#secondary`).
   - *Deduction*:
     - The HTML5 video element can be queried via `video.html5-main-video` or `document.querySelector('#movie_player video')`.
     - In-video warning banner should be injected into `#movie_player` or `.html5-video-player` as an overlay so it stays positioned relative to the video, or within the player container.
     - The timeline drawer can be anchored to the YouTube secondary column (`#secondary` / `#columns`) or injected as a collapsible sliding floating drawer docked to the right edge of the viewport with a toggle button, ensuring it works across standard, theater, and fullscreen modes.
     - Click-to-seek operates by setting `video.currentTime = targetTimestamp` and, if paused, optionally playing or updating the player.
     - Playback time synchronization requires a `timeupdate` listener on the video element (or `requestAnimationFrame` / `setInterval` 250ms polling) with a tolerance window (e.g. within [timestamp, timestamp + duration] or ±2.0s) so warnings fire accurately as playback progresses.

4. **Data Service Architecture**:
   - *Observation*: Requirement R2 requires rich mock claims for known video IDs and a fallback generator for any arbitrary video ID.
   - *Deduction*:
     - Module `src/claimService.js` (or `src/claims.js`) can provide:
       1. Hardcoded rich datasets for standard demo video IDs (e.g., popular science/news video IDs).
       2. Deterministic procedural generator that generates 3–6 claims (misinformation, verified, unknown) distributed across the video duration for any arbitrary video ID.
       3. Schema validator confirming each item has `timestamp` (number), `sentence` (string), `verdict` ('misinformation'|'verified'|'unknown'), `explanation` (string), and `sources` (array of URLs).
     - Module `src/urlParser.js` to extract video IDs from URLs:
       - `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
       - `https://youtu.be/dQw4w9WgXcQ`
       - `https://www.youtube.com/embed/dQw4w9WgXcQ`
       - Query parameters with timestamps (`&t=120s`).

5. **Test Harness Viability**:
   - *Observation*: Node.js `node:test` and Puppeteer `^25.14.0` are already functional and pass in ~3 seconds.
   - *Deduction*:
     - Unit tests for `urlParser`, `claimService`, and `playbackSync` can be cleanly written using `node:test` and `node:assert/strict` with zero external dependencies.
     - Browser/DOM tests for overlay injection, seek jumping, verdict styles, and drawer collapse/expand can be written as Puppeteer tests or simulated DOM tests running via `node tests/youtube_dom.test.js` or `npm run test:e2e`.
     - An `npm run lint` or `node --check` script can be added to satisfy acceptance criteria.

---

## 3. Caveats

1. **Pre-existing Code Preservation vs Replacement**:
   - The current repository code belongs to PagePulse. The prompt instructions state: *"Do NOT write or modify source code files. You are an exploration agent."* Downstream implementation agents will need to either replace PagePulse files with YouTube Misinformation Detector files or refactor `manifest.json`, `src/`, `popup/`, and `tests/`.
2. **YouTube DOM Dynamic Changes**:
   - YouTube frequently updates element classes and IDs. Relying on `#movie_player`, `video.html5-main-video`, `ytd-watch-flexy`, and event `yt-navigate-finish` is standard for YouTube extensions, with fallbacks to `document.querySelector('video')` and `popstate`/`MutationObserver`.
3. **Shadow DOM / Style Isolation**:
   - YouTube's stylesheets are global and contain high-specificity resets. Injected UI elements (warning overlay, drawer) must have scoped classes (e.g. `yt-misinfo-*`) and CSS reset rules to prevent YouTube styles from bleeding into the extension UI or vice-versa.

---

## 4. Conclusion

1. **Current State**: The repository is an operational skeleton of a different extension ("PagePulse"). 0% of the YouTube Misinformation Detector is implemented.
2. **Readiness**: The environment (Node.js v25.6.1, Puppeteer v25.14.0, Google Chrome) is fully operational with working unit and browser-based E2E test pipelines.
3. **Actionable Implementation Plan for Downstream Agents**:
   - **Phase 1: Architecture & Manifest V3**: Update `manifest.json` for YouTube (`*://*.youtube.com/*`), update `package.json` metadata, scripts, and add lint script.
   - **Phase 2: Core Modules (`src/`)**:
     - `src/urlParser.js`: YouTube URL and video ID parser (`watch?v=`, `youtu.be/`, timestamps).
     - `src/claims.js`: Mock claim retrieval service with rich mock datasets and deterministic fallback generator for arbitrary video IDs.
     - `src/playbackSync.js`: Playback time sync engine matching `currentTime` to claims within a tolerance window and managing active warning state.
     - `src/storage.js`: Extension settings manager (enabled toggle, filters, notifications).
   - **Phase 3: Content Script & In-Page UI (`src/content.js`, `src/content.css`)**:
     - SPA navigation detection (`yt-navigate-finish`, `popstate`, URL observer).
     - Video player listener (`timeupdate`, seek jump handler).
     - Warning banner overlay rendered on the video player for flagged `misinformation`.
     - Interactive collapsible timeline drawer listing all claims chronologically with color-coded badges (`misinformation` = red, `verified` = green, `unknown` = gray) and click-to-seek functionality.
   - **Phase 4: Popup Interface (`popup/`)**:
     - Popup showing extension status, current video ID, summary badges (count of misinformation, verified, unknown claims), and filter/setting toggles.
   - **Phase 5: Automated Test Suite (`tests/`)**:
     - `tests/urlParser.test.js`: Unit tests for URL parsing.
     - `tests/claims.test.js`: Unit tests for claims retrieval, structure, and fallback.
     - `tests/playbackSync.test.js`: Unit tests for timestamp matching and tolerance windows.
     - `tests/e2e.test.js`: Puppeteer DOM test verifying overlay injection, click-to-seek event dispatch, drawer expansion/collapse, and popup UI.

---

## 5. Verification Method

To independently verify these findings:

1. **Inspect Git status and commit history**:
   ```bash
   git status
   git log -n 3 --oneline
   ```
2. **Inspect Manifest configuration and current files**:
   ```bash
   cat manifest.json
   cat package.json
   ```
3. **Execute existing test runner**:
   ```bash
   npm test
   npm run test:e2e
   ```
4. **Invalidation Conditions**:
   - If `src/` already contains YouTube-specific modules (`claims.js`, `urlParser.js`, YouTube content script), this survey is outdated.
   - If `manifest.json` already contains YouTube host permissions and watch matches, this survey is outdated.
