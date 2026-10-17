# Project: YouTube Real-Time Misinformation Detector Extension

## Architecture
A dedicated Manifest V3 Chrome Extension exclusively targeting YouTube watch pages (`*://*.youtube.com/watch*` and YouTube client-side SPA transitions). The extension injects seamlessly into the YouTube DOM to detect video IDs, retrieve seeded or deterministic claim records, monitor live playback time against claim tolerance windows, present an in-video warning card inside `#movie_player` for misinformation, and provide an interactive collapsible timeline drawer with click-to-seek functionality and color-coded badges.

### Core Architecture Layers:
1. **Manifest & Extension Core (`manifest.json`, `src/background.js`)**:
   - Manifest V3 compliant service worker and content script configuration.
   - Matches YouTube domain with strict in-script watch-page routing and clean teardown.
2. **Navigation & SPA Coordinator (`src/youtube-url.js`, `src/content.js`)**:
   - Extracts 11-char video ID from standard, short, and parameterized URLs.
   - Listens to `yt-navigate-finish`, `popstate`, and DOM mutations to orchestrate lifecycle transitions across client-side video navigations without reloads.
3. **Claim Data Service (`src/claim-service.js`)**:
   - Seeded repository of realistic claims for key test video IDs.
   - Deterministic procedural fallback generator for arbitrary video IDs based on hash seeding.
   - Enforces schema: `timestamp` (number), `sentence` (string), `verdict` ('misinformation'|'verified'|'unknown'), `explanation` (string), `sources` (string[]).
4. **Playback Synchronization Engine (`src/video-tracker.js`)**:
   - Binds to `<video class="html5-main-video">` inside `#movie_player`.
   - Listens to `timeupdate`, `seeking`, and `seeked` events.
   - Evaluates active claims within configurable tolerance windows ($[t - 0.25, t + 4.5]$).
   - Suppresses alerts during pre-roll/mid-roll ad playback via `isAdActive()`.
5. **In-Video Warning Overlay (`src/overlay-manager.js`)**:
   - Injected directly into `#movie_player` to guarantee persistence across native fullscreen modes.
   - Positioned cleanly at top-right (`top: 24px; right: 24px;`) with `pointer-events: none` container and `pointer-events: auto` card.
   - Displays alert icon, quoted sentence, explanation, and manual dismiss button.
6. **Interactive Timeline Drawer (`src/drawer-manager.js`, `src/styles.css`)**:
   - Collapsible panel styled with YouTube native theme tokens (`--yt-spec-*`, `html[dark]`).
   - Chronologically renders all video claims with color-coded verdict badges (red = misinformation, green = verified, gray = unknown).
   - Highlights the active card during playback.
   - Click-to-seek sets `video.currentTime = claim.timestamp` and resumes playback.
7. **Extension Popup & Storage Sync (`popup/`, `src/storage.js`)**:
   - Displays real-time claim statistics (total, flagged, verified, unknown).
   - Global toggle to enable/disable UI without reloading.
   - Stores preferences in `chrome.storage.local` with in-memory test fallback.

---

## Feature Inventory

Every feature discovered in Phase 0 Survey is cataloged below with its assigned milestone.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Watch Page Route Filter | Restricts content script execution exclusively to YouTube watch pages (`/watch`) | M1 | ORIGINAL_REQUEST R1 |
| F02 | URL Video ID Parser | Robust parser extracting 11-char ID from all YouTube URL formats (standard, short, query params) | M1 | ORIGINAL_REQUEST R1 & Acceptance Criteria |
| F03 | SPA Navigation Monitor | Detects video changes across client-side navigations (`yt-navigate-finish`, `popstate`, DOM mutations) | M1 | ORIGINAL_REQUEST R1 |
| F04 | Content Script Lifecycle Controller | Coordinates mounting, teardown, and session reset on video transitions without reloads | M1 | ORIGINAL_REQUEST R1 |
| F05 | Video Element Attachment Resolver | Discovers and binds to YouTube's `<video>` element, handling dynamic DOM creation | M1 | ORIGINAL_REQUEST R1, R3 |
| F06 | Claim Data Schema & Validation | Validates claim records against strict schema (timestamp, sentence, verdict, explanation, sources) | M1 | ORIGINAL_REQUEST R2 |
| F07 | Verdict Enum System | Enforces canonical verdicts: `misinformation`, `verified`, `unknown` | M1 | ORIGINAL_REQUEST R2 |
| F08 | Seeded Mock Dataset Repository | High-quality realistic claims for known test video IDs | M1 | ORIGINAL_REQUEST R2 |
| F09 | Deterministic Fallback Generator | Algorithmic generator producing reproducible claims for arbitrary video IDs | M1 | ORIGINAL_REQUEST R2 |
| F10 | Claim Retrieval Service | Public async service to fetch claims for a video ID with simulated latency & caching | M1 | ORIGINAL_REQUEST R2 |
| F11 | Playback Time Synchronizer | Subscribes to playback time and matches active claim against `currentTime` | M1 | ORIGINAL_REQUEST R3 & Acceptance Criteria |
| F12 | Configurable Tolerance Window | Evaluates active claim within $[t - \text{tolerance}, t + \text{duration}]$ | M1 | Acceptance Criteria |
| F13 | Scrubbing & Seek Handler | Handles scrubbing, rapid seeks, and ad playback suppression | M1 | ORIGINAL_REQUEST R3 |
| F14 | In-Video Warning Overlay Banner | Renders clean warning banner in `#movie_player` when misinformation is active | M1 | ORIGINAL_REQUEST R3 |
| F15 | Overlay Auto-Hide Engine | Automatically removes/hides overlay when playback advances past claim window | M1 | ORIGINAL_REQUEST R3 |
| F16 | Manual Overlay Dismissal | Dismiss button ("X") hides banner for active claim instance until re-seek | M1 | ORIGINAL_REQUEST R3 |
| F17 | Player Fullscreen Support | Mounts overlay inside `#movie_player` to survive native fullscreen mode | M1 | ORIGINAL_REQUEST R3 |
| F18 | Interactive Timeline Drawer Container | Collapsible sidebar panel styled with native YouTube tokens and dark/light support | M1 | ORIGINAL_REQUEST R3 |
| F19 | Chronological Claim List | Displays chronologically sorted claims with `MM:SS` timestamps and explanations | M1 | ORIGINAL_REQUEST R3 |
| F20 | Color-Coded Verdict Badges | Applies red (misinfo), green (verified), and gray (unknown) badges | M1 | ORIGINAL_REQUEST R3 |
| F21 | Click-to-Seek Navigation | Clicking any claim card jumps `video.currentTime = claim.timestamp` and plays | M1 | ORIGINAL_REQUEST R3 & Acceptance Criteria |
| F22 | Active Sentence Highlight | Visually highlights the drawer card currently playing and scrolls into view | M1 | ORIGINAL_REQUEST R3 |
| F23 | Drawer Verdict Filter Bar | Filter chips to view All, Misinformation Only, or Verified Only in drawer | M1 | ORIGINAL_REQUEST R3 |
| F24 | Extension Popup View | Extension toolbar popup UI with stats, status, and settings | M1 | ORIGINAL_REQUEST R3 |
| F25 | Per-Video Claim Statistics | Displays counts: total, misinformation, verified, unknown for current video | M1 | ORIGINAL_REQUEST R3 |
| F26 | Global Extension Toggle Switch | Master switch to enable/disable overlay and drawer in real time | M1 | ORIGINAL_REQUEST R3 |
| F27 | Warning Overlay Toggle Preference | Preference toggle to suppress in-video warnings independently of drawer | M1 | ORIGINAL_REQUEST R3 |
| F28 | Cross-Context Storage Sync | Synchronizes settings between popup, service worker, and content script via storage | M1 | ORIGINAL_REQUEST R3 & Acceptance Criteria |
| F29 | Security & XSS Sanitization | Sanitizes text and source links to prevent script injection | M1 | Security Requirement |
| F30 | Automated Multi-Tier Test Suite | Comprehensive unit, DOM, and Puppeteer test suite covering Tiers 1-4 | M2 | Acceptance Criteria |
| F31 | Persistent Active Status Indicator | Bottom-left pulsating badge ("🛡️ Misinfo Detector Active (N claims)") with click-to-open drawer | M2 | User Follow-up |
| F32 | Content Script IIFE Bundle & Rapid SPA Fallback | Bundled IIFE content script (src/content-bundle.js) and 1s navigation polling fallback | M2 | User Follow-up |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Complete Extension Implementation & Unit Test Suite | Manifest V3, background service worker, YouTube URL parser, claim data service (seeded + fallback), playback time synchronizer, in-video overlay in #movie_player, timeline drawer with click-to-seek, color-coded badges, extension popup & settings sync, and comprehensive unit tests (F01-F29) | none | DONE |
| M2 | Comprehensive E2E Test Suite, Visual Indicator & Bundle Verification & Hardening | Phase 1: Opaque-box E2E test suite (Tiers 1-4, TEST_INFRA.md, TEST_READY.md, Puppeteer DOM & real Chrome browser tests verifying popup, in-page overlay, timeline drawer, IIFE bundle, and persistent visual indicator badge); Phase 2: Adversarial coverage hardening (Tier 5) & final forensic audit (F30-F32) | M1 | IN_PROGRESS |

---

## Interface Contracts

### `src/youtube-url.js`
- `parseYouTubeVideoId(urlOrStr: string): string | null`
  - Validates and returns 11-char string matching `^[a-zA-Z0-9_-]{11}$` or `null`.
- `isYouTubeWatchUrl(urlOrStr: string): boolean`
  - Returns `true` if URL represents a watch page with a valid video ID.
- `formatTimestamp(seconds: number): string`
  - Formats seconds as `MM:SS` (or `HH:MM:SS` if $\ge 3600$).

### `src/claim-service.js`
- `type Verdict = "misinformation" | "verified" | "unknown"`
- `interface Claim { timestamp: number; sentence: string; verdict: Verdict; explanation: string; sources: string[]; duration?: number; }`
- `validateClaim(raw: unknown): Claim`
  - Validates or throws descriptive Error if record does not conform to schema.
- `generateDeterministicClaims(videoId: string): Claim[]`
  - Generates 3-6 reproducible claims tailored to hash of `videoId`.
- `getClaimsForVideo(videoId: string): Promise<Claim[]>`
  - Returns seeded dataset for known IDs, or fallback generated claims for arbitrary IDs.

### `src/video-tracker.js`
- `findActiveClaim(claims: Claim[], currentTime: number, leadTolerance?: number, defaultDuration?: number): Claim | null`
  - Returns active claim if $t - \text{leadTolerance} \le \text{currentTime} < t + \text{duration}$.
- `seekToTimestamp(videoElement: HTMLVideoElement, targetSeconds: number, autoPlay?: boolean): boolean`
  - Sets `videoElement.currentTime = targetSeconds`, resumes playback if paused.
- `isAdActive(): boolean`
  - Checks `#movie_player.ad-showing` and ad overlay presence; returns boolean.

### `src/storage.js`
- `interface Settings { enabled: boolean; showOverlays: boolean; filterVerdict: string; }`
- `getSettings(): Promise<Settings>`
- `saveSettings(partial: Partial<Settings>): Promise<Settings>`
- `onSettingsChanged(callback: (newSettings: Settings) => void): () => void`

---

## Code Layout

```
/Users/kadirpili/Documents/chrome-extension/
├── manifest.json              # Manifest V3 configuration (YouTube matches, service worker, icons, storage)
├── package.json               # Scripts (test, test:e2e, test:all, lint), devDependencies
├── icons/                     # Extension icons (icon16.png, icon48.png, icon128.png)
├── src/
│   ├── background.js          # Service worker for default settings and badge updates
│   ├── content.js             # Content script coordinator (SPA navigation, lifecycle)
│   ├── youtube-url.js         # URL parsing and video ID extraction
│   ├── claim-service.js       # Seeded claim repo & deterministic fallback generator
│   ├── video-tracker.js       # Video element binding, time sync, ad detection, seeking
│   ├── overlay-manager.js     # In-video warning overlay inside #movie_player
│   ├── drawer-manager.js      # Collapsible timeline drawer with click-to-seek & badges
│   ├── storage.js             # Storage management with in-memory test fallback
│   └── styles.css             # Scoped CSS for overlay and drawer with YouTube theme tokens
├── popup/
│   ├── popup.html             # Popup layout: global toggle, video stats, filter options
│   ├── popup.css              # Styled popup UI matching YouTube/dark theme
│   └── popup.js               # Popup logic querying storage and active tab stats
└── tests/
    ├── youtube-url.test.js    # Unit tests for URL parsing and video ID extraction
    ├── claim-service.test.js  # Unit tests for claim validation, seeded data, fallback determinism
    ├── video-tracker.test.js  # Unit tests for playback synchronization and tolerance windows
    ├── dom-components.test.js # DOM component unit tests (overlay, drawer, click-to-seek)
    ├── e2e.test.js            # Automated Puppeteer browser tests against Chrome
    └── e2e-realworld.test.js  # Complex Tier 3/4 real-world user workflows
```
