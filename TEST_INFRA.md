# Test Infrastructure Specification: YouTube Misinformation Detector

## 1. Test Philosophy & Architecture

### 1.1 Opaque-Box & Requirement-Driven Testing
The testing architecture for the YouTube Misinformation Detector extension adheres strictly to an opaque-box, requirement-driven methodology. Tests evaluate observable user-facing outcomes, DOM state changes, browser lifecycle events, and interface contracts rather than internal private variables. 

Every test case is directly derived from requirements defined in `ORIGINAL_REQUEST.md` and feature specifications in `PROJECT.md`. For every test assertion, an authoritative specification defines the expected behavior:
- **URL Parsing**: Specifications define RFC 3986 and YouTube URL patterns (standard, short, timestamped, mobile, embed, shorts).
- **Claim Retrieval**: Seeded dataset specs for known IDs (`dQw4w9WgXcQ`, `M7lc1UVf-VE`, `jNQXAC9IVRw`) and deterministic Mulberry32 PRNG properties for arbitrary video IDs.
- **Playback Synchronization**: Mathematical bounds of $[t - 0.25, t + 4.5]$ seconds for claim display windows.
- **Visual Overlay & Drawer**: YouTube native CSS variables (`--yt-spec-*`), ARIA roles, click-to-seek contract updating `video.currentTime`.
- **Persistent Visual Indicator**: Fixed badge at bottom-left pulsing on YouTube watch pages, opening the timeline drawer upon click.

### 1.2 Real Browser Execution in Google Chrome via Puppeteer
While unit and algorithmic tests execute rapidly in Node.js test runner (`node:test`), End-to-End (E2E) browser tests execute against real **Google Chrome** located at:
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

The extension directory is loaded directly into Chrome using `--load-extension` and `--disable-extensions-except`. Browser testing validates:
1. Strict Manifest V3 compatibility (manifest schema, service worker registration, content script bundling, permissions, CSP).
2. Extension popup page loading (`popup/popup.html`), responsive styling, toggle switches, filter dropdowns, and stats display.
3. Content script bundle (`src/content-bundle.js`) and scoped stylesheet (`src/styles.css`) injection into simulated YouTube watch page DOM.
4. User interactions: clicking the persistent indicator badge, interacting with timeline drawer cards, filter chips, seeking video playback, and alert dismissal.
5. Client-side Single-Page-Application (SPA) navigations without page reload.

---

## 2. Multi-Tier Test Taxonomy

The test suite is structured into four distinct tiers:

```
+-------------------------------------------------------------------------+
| Tier 4: Real-World Scenarios & Lifecycle Transitions                   |
| (SPA transitions, claim progression, auto-dismiss, manual persistence)  |
+-------------------------------------------------------------------------+
| Tier 3: Real Browser E2E in Google Chrome (Puppeteer)                   |
| (Manifest V3, popup UI, DOM injection, indicator badge, seek, filters)  |
+-------------------------------------------------------------------------+
| Tier 2: DOM Component & Interface Contract Tests                        |
| (OverlayManager, DrawerManager, XSS defense, keyboard a11y, storage)   |
+-------------------------------------------------------------------------+
| Tier 1: Unit & Algorithmic Correctness Tests                            |
| (URL parser, deterministic fallback PRNG, claim schema validation)      |
+-------------------------------------------------------------------------+
```

### Tier 1: Unit & Algorithmic Correctness
- **Scope**: Pure logic modules with zero or mocked browser dependencies.
- **Files**:
  - `tests/youtube-url.test.js`: URL parsing, 11-char ID extraction across 15+ URL variants, watch page verification, timestamp formatting (`MM:SS`, `HH:MM:SS`).
  - `tests/claim-service.test.js`: Claim record validation (`validateClaim`), duration defaults, seeded dataset integrity, Mulberry32 deterministic generator reproduciblity across 100+ calls, diversity check.
  - `tests/video-tracker.test.js`: Active claim detection across $[t - \text{lead}, t + \text{duration}]$ tolerance boundaries, seekToTimestamp clamping, ad suppression (`isAdActive`).
- **Execution Engine**: Native Node.js test runner (`node --test`).

### Tier 2: DOM Component & Interface Contract Integration
- **Scope**: DOM component rendering, simulated user events, accessibility attributes, and XSS sanitization.
- **Files**:
  - `tests/dom-components.test.js`: Overlay DOM construction, pointer-events (`none` on root, `auto` on card), drawer panel creation, color-coded verdict badges (`--misinformation`, `--verified`, `--unknown`), click-to-seek callback firing, filter chip toggles, active card highlighting, XSS sanitization against HTML/script injection and `javascript:` URLs.
  - `tests/adversarial-stress.test.js`: Catastrophic backtracking / ReDoS stress, corrupted inputs, prototype pollution defense, 600+ PRNG determinism iterations, rapid seeking stress (1,000 seeks).
  - `tests/adversarial-ui-dom.test.js`: XSS injection attacks, manual dismissal persistence across tolerance window, auto-hide transition timings, keyboard accessibility (`Enter` and `Space` seek triggers), in-memory storage fallback.
- **Execution Engine**: JSDOM / Node.js test runner.

### Tier 3: Real Browser E2E in Google Chrome via Puppeteer
- **Scope**: Automated verification in genuine Google Chrome (macOS binary) with extension loaded.
- **File**: `tests/e2e.test.js`
- **Suites**:
  - **Suite 1: Extension Packaging & Manifest V3 Verification**:
    - Validates `manifest.json` conforms to MV3 specifications.
    - Confirms background service worker `src/background.js` and content script bundle `src/content-bundle.js` exist and have non-empty sizes.
    - Verifies icon assets (16px, 48px, 128px) and web accessible resources.
  - **Suite 2: Extension Popup UI Verification**:
    - Loads `popup/popup.html` in real Chrome tab.
    - Verifies title "YouTube Misinformation Detector" and header branding.
    - Tests interactive toggles: "Enable Detector" and "In-Video Overlays".
    - Tests "Default Timeline Filter" dropdown selection.
    - Verifies 4-cell stats grid (Total Claims, Misinformation, Verified, Unverified) and non-YouTube fallback view.
    - Confirms 0 console errors or uncaught exceptions.
  - **Suite 3: Simulated YouTube Watch Page DOM Verification**:
    - Injects `src/styles.css` and `src/content-bundle.js` into simulated YouTube watch page DOM containing `#movie_player` and `<video class="html5-main-video">`.
    - Confirms persistent visual indicator badge (`#yt-misinfo-status-badge`) renders with text `"🛡️ Misinfo Detector Active (N claims)"` and pulsing red dot at bottom-left (`position: fixed; bottom: 24px; left: 24px;`).
    - Verifies clicking the indicator badge opens the claims drawer (toggles `#yt-misinfo-drawer-panel` from collapsed to open).
    - Verifies in-video warning overlay appears inside `#movie_player` when `currentTime` reaches a misinformation claim.
    - Verifies click-to-seek on drawer card updates `video.currentTime` to the claim timestamp.
    - Verifies chronological claim card rendering with color-coded badges (`yt-misinfo-badge--misinformation`, `yt-misinfo-badge--verified`, `yt-misinfo-badge--unknown`).
    - Verifies filter chips ("All", "Misinformation", "Verified", "Unverified") correctly filter visible cards in the drawer.

### Tier 4: Real-World Scenarios & Lifecycle Transitions
- **Scope**: Complex multi-step user workflows and browser lifecycle dynamics.
- **File**: `tests/e2e-realworld.test.js`
- **Scenarios**:
  - **Scenario 1: Client-Side SPA Navigation Without Page Reload**:
    - Simulates YouTube's client-side SPA navigation from video A (`dQw4w9WgXcQ`, 4 claims) to video B (`M7lc1UVf-VE`, 2 claims) via `history.pushState` and `yt-navigate-finish`.
    - Verifies previous session teardown (old listeners, old cards).
    - Verifies initialization of new video session, updated indicator claim count, and newly populated drawer cards.
    - Simulates 1-second interval SPA navigation fallback detection.
  - **Scenario 2: Playback Progression Across Consecutive Claims**:
    - Simulates continuous video playback stepping through timestamps $[0, 15, 30, 42.5, 60, 90]$.
    - Confirms overlay triggers for misinformation claims and hides during non-misinformation or unflagged intervals.
    - Confirms active card in timeline drawer highlights synchronously with current playback time.
  - **Scenario 3: Auto-Dismissal on Tolerance Window Expiration**:
    - Verifies overlay appears when playback enters claim window.
    - Simulates playback advancing beyond $[t + \text{duration}]$; verifies overlay automatically initiates hiding and cleans up.
  - **Scenario 4: Manual Alert Card Dismissal Persistence**:
    - User clicks the dismiss button ("×") on the active warning card.
    - Card immediately closes.
    - Subsequent `timeupdate` events within the same claim window do NOT reopen the card.
    - Seeking video back to or near the claim timestamp resets dismissed state and displays alert again.

---

## 3. Feature Coverage Mapping (F01–F32)

Every feature cataloged in `PROJECT.md` is mapped to its test tier and authoritative verification tests:

| Feature ID | Feature Name | Test Tier | Primary Test File & Test Cases |
|------------|--------------|-----------|--------------------------------|
| **F01** | Watch Page Route Filter | Tier 1, 3 | `tests/youtube-url.test.js` (`isYouTubeWatchUrl`), `tests/e2e.test.js` (Popup non-YouTube view, watch page execution) |
| **F02** | URL Video ID Parser | Tier 1, 2 | `tests/youtube-url.test.js` (Standard, short, query params, shorts, live URLs) & `tests/adversarial-stress.test.js` |
| **F03** | SPA Navigation Monitor | Tier 3, 4 | `tests/e2e-realworld.test.js` (`yt-navigate-finish`, `popstate`, URL changes) |
| **F04** | Content Script Lifecycle Controller | Tier 3, 4 | `tests/e2e-realworld.test.js` (Teardown and reinitialization on video change) |
| **F05** | Video Element Attachment Resolver | Tier 1, 3 | `tests/video-tracker.test.js` (`waitForVideoElement`) & `tests/e2e.test.js` (Attachment to `video.html5-main-video`) |
| **F06** | Claim Data Schema & Validation | Tier 1, 2 | `tests/claim-service.test.js` (`validateClaim`) & `tests/adversarial-stress.test.js` |
| **F07** | Verdict Enum System | Tier 1, 2 | `tests/claim-service.test.js` (`misinformation`, `verified`, `unknown` rejection of unauthorized values) |
| **F08** | Seeded Mock Dataset Repository | Tier 1, 3 | `tests/claim-service.test.js` (Seeded dataset for `dQw4w9WgXcQ`) & `tests/e2e.test.js` |
| **F09** | Deterministic Fallback Generator | Tier 1, 2 | `tests/claim-service.test.js` (Mulberry32 reproducibility & diversity) & `tests/adversarial-stress.test.js` |
| **F10** | Claim Retrieval Service | Tier 1, 3 | `tests/claim-service.test.js` (`getClaimsForVideo`) & `tests/e2e.test.js` |
| **F11** | Playback Time Synchronizer | Tier 1, 4 | `tests/video-tracker.test.js` (`findActiveClaim`) & `tests/e2e-realworld.test.js` (Playback step progression) |
| **F12** | Configurable Tolerance Window | Tier 1, 2 | `tests/video-tracker.test.js` ($[t - 0.25, t + \text{duration}]$ mathematical boundaries) & `tests/adversarial-stress.test.js` |
| **F13** | Scrubbing & Seek Handler | Tier 1, 2 | `tests/video-tracker.test.js` (`seekToTimestamp`, `isAdActive` suppression) & `tests/adversarial-stress.test.js` |
| **F14** | In-Video Warning Overlay Banner | Tier 2, 3 | `tests/dom-components.test.js` (`createWarningOverlay`) & `tests/e2e.test.js` (Overlay appearance in `#movie_player`) |
| **F15** | Overlay Auto-Hide Engine | Tier 2, 4 | `tests/adversarial-ui-dom.test.js` & `tests/e2e-realworld.test.js` (Auto-hide past duration window) |
| **F16** | Manual Overlay Dismissal | Tier 2, 4 | `tests/dom-components.test.js` & `tests/e2e-realworld.test.js` (Dismiss button click, persistence across window) |
| **F17** | Player Fullscreen Support | Tier 2, 3 | `tests/dom-components.test.js` & `tests/e2e.test.js` (Mounting inside `#movie_player`, CSS `#movie_player:fullscreen`) |
| **F18** | Interactive Timeline Drawer Container | Tier 2, 3 | `tests/dom-components.test.js` (`DrawerManager`, collapsed state toggling) & `tests/e2e.test.js` |
| **F19** | Chronological Claim List | Tier 2, 3 | `tests/dom-components.test.js` (`createDrawer` chronological sort) & `tests/e2e.test.js` |
| **F20** | Color-Coded Verdict Badges | Tier 2, 3 | `tests/dom-components.test.js` (Red, green, gray badges) & `tests/e2e.test.js` |
| **F21** | Click-to-Seek Navigation | Tier 2, 3 | `tests/dom-components.test.js` & `tests/e2e.test.js` (Drawer card click updates `video.currentTime`) |
| **F22** | Active Sentence Highlight | Tier 2, 4 | `tests/dom-components.test.js` (`updateActiveClaim`, `.yt-misinfo-card--active`) & `tests/e2e-realworld.test.js` |
| **F23** | Drawer Verdict Filter Bar | Tier 2, 3 | `tests/dom-components.test.js` (`setFilter`) & `tests/e2e.test.js` (Filter chips for All, Misinformation, Verified, Unverified) |
| **F24** | Extension Popup View | Tier 3 | `tests/e2e.test.js` (Popup layout, header branding, switches, dropdown, stats grid) |
| **F25** | Per-Video Claim Statistics | Tier 3 | `tests/e2e.test.js` (`#stat-total`, `#stat-misinfo`, `#stat-verified`, `#stat-unknown`) |
| **F26** | Global Extension Toggle Switch | Tier 2, 3 | `tests/adversarial-ui-dom.test.js` & `tests/e2e.test.js` (`#toggle-enabled` storage update) |
| **F27** | Warning Overlay Toggle Preference | Tier 2, 3 | `tests/adversarial-ui-dom.test.js` & `tests/e2e.test.js` (`#toggle-overlays` storage update) |
| **F28** | Cross-Context Storage Sync | Tier 2, 3 | `tests/adversarial-ui-dom.test.js` (`getSettings`, `saveSettings`, listener callbacks) |
| **F29** | Security & XSS Sanitization | Tier 2 | `tests/dom-components.test.js` & `tests/adversarial-ui-dom.test.js` (HTML entities, `<script>`, `javascript:` URL blocking) |
| **F30** | Automated Multi-Tier Test Suite | All Tiers | Full suite across `tests/*.test.js` executing via `npm run test:all` |
| **F31** | Persistent Active Status Indicator | Tier 3, 4 | `tests/e2e.test.js` & `tests/e2e-realworld.test.js` (`#yt-misinfo-status-badge`, pulsing dot, click to open drawer) |
| **F32** | Content Script IIFE Bundle & Rapid SPA Fallback | Tier 3, 4 | `tests/e2e.test.js` (IIFE bundle loading without module errors) & `tests/e2e-realworld.test.js` (1s fallback navigation polling) |

---

## 4. Edge Cases & Boundary Conditions Matrix

| Scenario / Edge Case | Expected System Behavior | Test Verification |
|----------------------|--------------------------|-------------------|
| Playback at exact entry boundary $t - 0.25$ | Claim becomes active | `tests/video-tracker.test.js` |
| Playback just before entry boundary $t - 0.2501$ | Returns null (inactive) | `tests/video-tracker.test.js` |
| Playback at exact expiry boundary $t + \text{duration}$ | Returns null (inactive) | `tests/video-tracker.test.js` |
| Playback during mid-roll ad (`.ad-showing`) | Overlay suppressed | `tests/video-tracker.test.js` |
| Manual dismissal then time advances inside same claim | Card stays dismissed | `tests/e2e-realworld.test.js` |
| Seeking video back to dismissed claim | Dismissed key resets, card shows | `tests/e2e-realworld.test.js` |
| Rapid scrubbing through 1,000 seek events | System remains stable, no memory leak | `tests/adversarial-stress.test.js` |
| Arbitrary video ID not in seeded repo | Fallback generator deterministic claims | `tests/claim-service.test.js` |
| Malformed YouTube URL or non-YouTube domain | Parser returns `null`, content script halts | `tests/youtube-url.test.js` |
| SPA navigation without full page reload | Cleans old session, loads new video data | `tests/e2e-realworld.test.js` |
| Indicator badge click | Slid-out claims drawer opens | `tests/e2e.test.js` |
| Filter drawer to verdict with 0 matches | Shows empty state "No claims match..." | `tests/dom-components.test.js` |

---

## 5. Test Runner & Verification Commands

```bash
# 1. Run Unit & Algorithmic tests (Tier 1 & Tier 2)
npm test

# 2. Run Core E2E Tests in Google Chrome via Puppeteer (Tier 3)
npm run test:e2e

# 3. Run All Tests including Real-World Scenarios (Tiers 1-4)
npm run test:all

# 4. Run Adversarial Stress & Hardening Suites
node --test tests/adversarial-stress.test.js tests/adversarial-ui-dom.test.js
```
