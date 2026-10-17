# Architectural Design Blueprint: In-Page UI, Timeline Drawer, Styles, Storage & Popup

**Agent**: Milestone 1 Explorer 2 (`explorer_m1_2`)  
**Role**: In-Page UI & Popup Design Explorer  
**Working Directory**: `/Users/kadirpili/Documents/chrome-extension/.agents/teamwork/explorer_m1_2/`  
**Target File**: `/Users/kadirpili/Documents/chrome-extension/.agents/teamwork/explorer_m1_2/handoff.md`  
**Date**: 2026-10-17T06:12:00Z  

---

## 1. Observation

### 1.1 Verbatim Requirements from `ORIGINAL_REQUEST.md`
- **R1: YouTube In-Page Integration & SPA Navigation Handling** (Lines 12–14):
  > "The extension runs exclusively on YouTube watch pages (`*://*.youtube.com/watch*`)."  
  > "Detects video ID updates across both initial page loads and client-side YouTube Single-Page-App (SPA) navigations (`yt-navigate-finish`, URL popstate, or DOM mutation observers) without requiring manual page reloads."
- **R2: Video Claim & Sentence Data Retrieval** (Lines 16–29):
  > Claim record schema: `[ { "timestamp": 42.5, "sentence": "...", "verdict": "misinformation" | "verified" | "unknown", "explanation": "...", "sources": ["..."] } ]`
- **R3: In-Video Warnings & Interactive Timeline Drawer UI** (Lines 31–36):
  > "**In-Video Warning Overlay**: When the current playback time (`currentTime`) aligns with a sentence flagged as `misinformation`, display a clean, non-intrusive warning card/banner on or directly adjacent to the YouTube video player."  
  > "**Side Panel / Interactive Drawer**: Embed a collapsible, YouTube-native styled panel beside the player or comments section listing all analyzed sentences chronologically. Color-coded badges for verdicts (`misinformation` = warning red/amber, `verified` = green, `unknown` = neutral gray). Clicking any sentence jumps the YouTube player to that specific timestamp."  
  > "**Popup & Settings**: Extension popup provides global toggle, summary stats of claims for the current video, and filter toggles."
- **Acceptance Criteria** (Lines 40–50):
  > Unit tests for URL video ID extraction, sentence retrieval/fallback, and playback time synchronization.  
  > Automated browser / DOM test verifying overlay injection/rendering, click-to-seek seeking updates, verdict styles, and drawer visibility toggling.  
  > Linting, type/syntax checks, and readability passing without warnings.

### 1.2 Architectural Contracts in `PROJECT.md`
Inspection of `/Users/kadirpili/Documents/chrome-extension/PROJECT.md`:
- **Section 5: In-Video Warning Overlay (`src/overlay-manager.js`)** (Lines 22–25):
  > "Injected directly into `#movie_player` to guarantee persistence across native fullscreen modes."  
  > "Positioned cleanly at top-right (`top: 24px; right: 24px;`) with `pointer-events: none` container and `pointer-events: auto` card."  
  > "Displays alert icon, quoted sentence, explanation, and manual dismiss button."
- **Section 6: Interactive Timeline Drawer (`src/drawer-manager.js`, `src/styles.css`)** (Lines 26–30):
  > "Collapsible panel styled with YouTube native theme tokens (`--yt-spec-*`, `html[dark]`)."  
  > "Chronologically renders all video claims with color-coded verdict badges (red = misinformation, green = verified, gray = unknown)."  
  > "Highlights the active card during playback."  
  > "Click-to-seek sets `video.currentTime = claim.timestamp` and resumes playback."
- **Section 7: Extension Popup & Storage Sync (`popup/`, `src/storage.js`)** (Lines 31–35, 114–119):
  > `interface Settings { enabled: boolean; showOverlays: boolean; filterVerdict: string; }`  
  > `getSettings(): Promise<Settings>`  
  > `saveSettings(partial: Partial<Settings>): Promise<Settings>`  
  > `onSettingsChanged(callback: (newSettings: Settings) => void): () => void`

### 1.3 Legacy Workspace Inventory
Inspection of existing files:
- `manifest.json`: Configured for legacy extension `"PagePulse - Reading Stats & Notes"` matching `<all_urls>` with permissions `["activeTab", "storage", "scripting"]`.
- `src/storage.js` (169 lines): Implements note saving and reading speed settings for PagePulse with `hasChromeStorage()` and `memoryStore`.
- `src/content.js` (52 lines): Extracts text content for word counting via `extractPageData()`.
- `popup/` (`popup.html` 160 lines, `popup.js` 463 lines, `popup.css` 456 lines): PagePulse reading stats calculator, note editor, and reading speed slider.
- `package.json`: Node.js `node:test` runner, `"type": "module"`, `puppeteer: ^25.14.0`.

### 1.4 Peer Explorer Boundaries
- `explorer_m1_1`: Covers `manifest.json`, `src/youtube-url.js`, `src/claim-service.js`, and `src/video-tracker.js`.
- `explorer_m1_2` (This Agent): Covers `src/overlay-manager.js`, `src/drawer-manager.js`, `src/styles.css`, `src/storage.js`, `src/content.js`, and `popup/popup.html`, `popup/popup.css`, `popup/popup.js`.
- `explorer_m1_3`: Covers the automated test suite in `tests/` (`youtube-url.test.js`, `claim-service.test.js`, `video-tracker.test.js`, `dom-components.test.js`).

---

## 2. Logic Chain

### 2.1 In-Video Warning Overlay Architecture (`src/overlay-manager.js`)
1. **Fullscreen Retention Mechanics**:
   - *Observation*: In YouTube desktop web player, when the user presses `F` or clicks the fullscreen button, YouTube calls `moviePlayer.requestFullscreen()`. `document.fullscreenElement` is `div#movie_player`.
   - *Deduction*: Any DOM node appended to `document.body`, `ytd-app`, or `#primary` is occluded and completely hidden by the browser compositor in fullscreen mode.
   - *Conclusion*: The overlay container (`#yt-misinfo-overlay-root`) MUST be injected as a direct child of `div#movie_player`.
2. **Hit-Testing & Pointer Events Pass-Through**:
   - *Observation*: YouTube's video canvas captures clicks for pause/play and double-clicks for fullscreen or fast-forward.
   - *Deduction*: If an overlay container covers a large area with default `pointer-events: auto`, clicking anywhere around the alert will unintentionally block player interactions or pause the video.
   - *Conclusion*: The outer container (`.yt-misinfo-overlay-container`) must have `pointer-events: none !important;`. The warning alert card (`.yt-misinfo-card`) must have `pointer-events: auto !important;` so the viewer can interact with the dismiss button, source links, and timeline jump button.
3. **Screen Real Estate & Positioning**:
   - *Observation*:
     - Bottom controls (`.ytp-chrome-bottom`): seek bar, buttons, height ~48px, `z-index: 60`.
     - Subtitles / Captions (`.ytp-caption-window-container`): rendered bottom-center, `z-index: 50`.
     - Top-left chrome (`.ytp-chrome-top`): video title and channel icon, `z-index: 60`.
   - *Conclusion*: Top-right positioning (`top: 24px; right: 24px; max-width: 380px; z-index: 65;`) avoids all native player controls, subtitle containers, and top chrome.
4. **Lifecycle & Dismissal State Machine**:
   - *Deduction*: A spoken sentence occupies a finite playback window $[t_{\text{claim}} - \text{tolerance}, t_{\text{claim}} + \text{duration}]$.
   - *Window Expiry*: When `currentTime` exceeds the window, `OverlayManager.update(null)` automatically transitions the card to hidden with a smooth fade-out.
   - *Manual Dismissal*: When the user clicks the "X" button, the claim's instance key (`${claim.timestamp}_${claim.sentence}`) is added to a dismissed set. The card hides immediately and stays suppressed for that sentence instance.
   - *Re-arming on Seek*: If the viewer scrubs backwards or seeks into the claim again, the dismissed state is cleared or re-evaluated, allowing the warning to re-appear if the user explicitly seeks to review that segment.

### 2.2 Collapsible Timeline Drawer Architecture (`src/drawer-manager.js`)
1. **Host Page Layout Resilience (Standard vs Theater Mode)**:
   - *Observation*: In YouTube's default layout, `#secondary` is on the right. In Theater mode (`<ytd-watch-flexy theater>`) or on viewports $< 1000\text{px}$, `#secondary` is repositioned below `#primary` (beneath comments). Furthermore, YouTube's Polymer framework frequently clears `#secondary-inner` when playlists or live chats toggle.
   - *Deduction*: Injecting the timeline drawer directly into `#secondary-inner` makes it invisible in Theater mode and susceptible to framework wipes.
   - *Conclusion*: The timeline drawer is best implemented as a **fixed right-edge sliding drawer panel** (`#yt-misinfo-drawer-panel`) accompanied by a persistent **floating toggle tab** (`#yt-misinfo-drawer-tab`).
   - *Coordinates*: `top: 56px; right: 0; height: calc(100vh - 56px); width: 360px; z-index: 2000;`. This docks neatly under YouTube's 56px top masthead, remaining accessible across default, theater, and compact views.
2. **Chronological Sorting & Color-Coded Badges**:
   - Claims are strictly sorted ascending by `timestamp`.
   - Badges enforce standard verdicts:
     - `misinformation`: Red badge (`yt-misinfo-badge--misinformation`, border: `#ff4d4f`, bg: `rgba(255, 77, 79, 0.12)`, text: `#ff4d4f`).
     - `verified`: Green badge (`yt-misinfo-badge--verified`, border: `#52c41a`, bg: `rgba(82, 196, 26, 0.12)`, text: `#52c41a`).
     - `unknown`: Neutral gray badge (`yt-misinfo-badge--unknown`, border: `#8c8c8c`, bg: `rgba(140, 140, 140, 0.12)`, text: `#8c8c8c`).
3. **Active Card Highlighting & Auto-Scroll**:
   - When playback aligns with a claim, `DrawerManager.setActiveClaim(claim)` adds `.yt-misinfo-card--active` (distinct left border highlight and elevated background).
   - If the drawer is currently expanded, it calls `card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
4. **Click-to-Seek Event Delegation**:
   - The card list attaches a single click listener at the container level:
     ```javascript
     const card = event.target.closest('.yt-misinfo-timeline-card');
     if (card && !event.target.closest('a')) {
       const ts = parseFloat(card.dataset.timestamp);
       this.onSeekCallback(ts);
     }
     ```
   - This prevents memory leaks and ensures dynamic filtering maintains seek capability.

### 2.3 Scoped CSS & Theme Variable Alignment (`src/styles.css`)
1. **Style Encapsulation**:
   - Every class is prefixed with `yt-misinfo-*`.
   - Host nodes declare CSS resets (`box-sizing: border-box; font-family: Roboto, Arial, sans-serif;`).
2. **Native YouTube Design Token Integration**:
   - Uses YouTube's official design tokens:
     - `--yt-spec-base-background` (Dark: `#0f0f0f`, Light: `#ffffff`)
     - `--yt-spec-raised-background` (Dark: `#212121`, Light: `#f2f2f2`)
     - `--yt-spec-text-primary` (Dark: `#f1f1f1`, Light: `#0f0f0f`)
     - `--yt-spec-text-secondary` (Dark: `#aaaaaa`, Light: `#606060`)
     - `--yt-spec-10-percent-layer` (Dark: `rgba(255, 255, 255, 0.1)`, Light: `rgba(0, 0, 0, 0.1)`)
   - Selectors: Targets `html[dark]`, `html[dark="true"]`, and `@media (prefers-color-scheme: dark)` with fallback values so UI never breaks if YouTube renames a variable.
3. **Fullscreen Player Adaptation**:
   - Scoped selector `#movie_player:fullscreen .yt-misinfo-overlay-container, #movie_player.ytp-fullscreen .yt-misinfo-overlay-container` adjusts padding and scales text for large display viewing.

### 2.4 Settings Storage & Cross-Context Sync (`src/storage.js`)
1. **Schema & Defaults**:
   ```javascript
   export const DEFAULT_SETTINGS = Object.freeze({
     enabled: true,
     showOverlays: true,
     filterVerdict: 'all' // 'all' | 'misinformation' | 'verified' | 'unknown'
   });
   ```
2. **Dual-Environment Resilience**:
   - When running in Chrome Extension (`hasChromeStorage()` is true): delegates to `chrome.storage.local`.
   - When running in Node.js unit tests (`typeof chrome === 'undefined'`): delegates to an in-memory map `memoryStore` with `resetMemoryStore()` and listener dispatching.
3. **Change Notification Pipeline**:
   - `onSettingsChanged(callback)` attaches `chrome.storage.onChanged.addListener` (or memory subscriber) returning an `unsubscribe()` function.

### 2.5 SPA Navigation Coordinator & Lifecycle (`src/content.js`)
1. **YouTube SPA Event Lifecycle**:
   - YouTube fires `yt-navigate-finish` on `document` and `window` upon client-side pushState completion.
   - Fallbacks: `popstate` on `window` and URL mutation checking.
2. **Session Coordinator**:
   - State: `activeVideoId`, `activeSession`, `currentSettings`.
   - Route filter: If `!isYouTubeWatchUrl(location.href)`, execute `teardown()`: unmount overlay, close/hide drawer, remove video event listeners.
   - Video transition: If `videoId` changed on watch page:
     1. Teardown previous session.
     2. Set `activeVideoId = videoId`.
     3. Fetch claims via `getClaimsForVideo(videoId)`.
     4. Resolve `<video class="html5-main-video">` and `div#movie_player`.
     5. Mount `OverlayManager` and `DrawerManager`.
     6. Bind playback listener (`timeupdate`, `seeking`, `seeked`).
     7. Attach message listener (`GET_VIDEO_STATS`) to provide claim counts to popup.

### 2.6 Popup Management UI (`popup/`)
1. **Structure**:
   - Header: Extension logo, title, and current watch page status badge.
   - Master Switches:
     - Global toggle (`#toggle-extension-enabled`)
     - Overlay toggle (`#toggle-show-overlays`)
   - Video Claim Summary Statistics:
     - Grid displaying Total Claims, Misinformation (red), Verified (green), and Unverified (gray).
   - Filter Selector: Default filter preference ('all', 'misinformation', 'verified').
   - Empty State: "Open a YouTube watch page to view claims."
2. **Data Flow**:
   - `popup.js` queries active tab.
   - If watch page, sends `{ action: 'GET_VIDEO_STATS' }` to content script.
   - Populates stats grid.
   - Toggling switches calls `saveSettings(...)` which broadcasts changes via `chrome.storage.onChanged`.

---

## 3. Caveats

1. **YouTube Custom Element Lifecycle Latency**:
   - On cold loads or low-spec devices, `<video class="html5-main-video">` and `#movie_player` may take 100–300ms to mount after `yt-navigate-finish`. The element resolver in `content.js` must poll or use a `MutationObserver` with a 5000ms timeout rather than failing on an immediate `querySelector`.
2. **Ad Playback Tolerance**:
   - When YouTube plays pre-roll or mid-roll advertisements, `currentTime` reflects the ad duration. `isAdActive()` (checking `#movie_player.ad-showing` and ad overlay selectors) must suppress misinformation warnings to avoid false alerts during commercial breaks.
3. **XSS Protection Discipline**:
   - Claim sentences and explanations from mock datasets or future remote APIs must be inserted into DOM exclusively via `.textContent`. External source URLs must be verified to start with `https://` or `http://` before assigning to `.href`.

---

## 4. Conclusion: Production Code Implementation Blueprints

Below are the complete, exact implementation blueprints for all assigned components.

### 4.1 DOM Hierarchy Blueprints

#### In-Video Warning Overlay DOM Hierarchy
```html
<div id="movie_player" class="html5-video-player ...">
  <!-- Native YouTube video element -->
  <video class="html5-main-video" ...></video>

  <!-- Injected Overlay Container (pointer-events: none) -->
  <div id="yt-misinfo-overlay-root" class="yt-misinfo-overlay-container">
    <div class="yt-misinfo-card yt-misinfo-card--misinformation" role="alert" aria-live="polite" data-timestamp="42.5">
      <div class="yt-misinfo-card-header">
        <div class="yt-misinfo-card-badge">
          <svg class="yt-misinfo-icon" viewBox="0 0 24 24" width="16" height="16">
            <path d="M12 2L1 21h22L12 2zm0 3.5L20 19H4L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="currentColor"/>
          </svg>
          <span class="yt-misinfo-card-badge-text">Misinformation Alert</span>
        </div>
        <button type="button" class="yt-misinfo-card-dismiss" aria-label="Dismiss alert">&times;</button>
      </div>

      <div class="yt-misinfo-card-body">
        <div class="yt-misinfo-card-meta">
          <span class="yt-misinfo-card-time">00:42</span>
        </div>
        <blockquote class="yt-misinfo-card-sentence">"The moon landing was filmed on a Hollywood sound stage."</blockquote>
        <p class="yt-misinfo-card-explanation">Extensive physical evidence, lunar samples, and independent tracking confirm humans landed on the Moon during Apollo missions.</p>
      </div>

      <div class="yt-misinfo-card-footer">
        <a class="yt-misinfo-card-source" href="https://factcheck.org/apollo" target="_blank" rel="noopener noreferrer">factcheck.org</a>
        <button type="button" class="yt-misinfo-card-btn-timeline">View in Timeline &rarr;</button>
      </div>
    </div>
  </div>

  <!-- Native YouTube Chrome Controls (z-index: 60) -->
  <div class="ytp-chrome-bottom">...</div>
</div>
```

#### Collapsible Timeline Drawer DOM Hierarchy
```html
<div id="yt-misinfo-drawer-root">
  <!-- Floating Toggle Tab (Docked on right viewport edge) -->
  <button id="yt-misinfo-drawer-tab" class="yt-misinfo-drawer-tab" aria-label="Toggle Fact Check Timeline" title="Toggle Claims Timeline">
    <svg class="yt-misinfo-tab-icon" viewBox="0 0 24 24" width="18" height="18">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="currentColor"/>
    </svg>
    <span class="yt-misinfo-tab-label">Claims</span>
    <span class="yt-misinfo-tab-count">4</span>
    <span class="yt-misinfo-tab-alert-dot"></span>
  </button>

  <!-- Sliding Drawer Panel (transform: translateX(0) when open) -->
  <aside id="yt-misinfo-drawer-panel" class="yt-misinfo-drawer-panel yt-misinfo-drawer-panel--collapsed" role="complementary" aria-label="Fact check claims timeline">
    <header class="yt-misinfo-drawer-header">
      <div class="yt-misinfo-drawer-title-group">
        <svg class="yt-misinfo-header-icon" viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
        </svg>
        <h2 class="yt-misinfo-drawer-title">Claims Timeline</h2>
        <span class="yt-misinfo-drawer-total-badge" id="yt-misinfo-drawer-total">4</span>
      </div>
      <button type="button" class="yt-misinfo-drawer-close" aria-label="Close timeline drawer">&times;</button>
    </header>

    <!-- Filter Bar -->
    <nav class="yt-misinfo-drawer-filters" role="tablist">
      <button type="button" class="yt-misinfo-filter-chip yt-misinfo-filter-chip--active" data-filter="all">All (4)</button>
      <button type="button" class="yt-misinfo-filter-chip" data-filter="misinformation">Misinformation (2)</button>
      <button type="button" class="yt-misinfo-filter-chip" data-filter="verified">Verified (1)</button>
      <button type="button" class="yt-misinfo-filter-chip" data-filter="unknown">Unverified (1)</button>
    </nav>

    <!-- Scrollable Cards List -->
    <div class="yt-misinfo-drawer-body">
      <div class="yt-misinfo-cards-list" role="list">
        <!-- Chronological Card Item -->
        <article class="yt-misinfo-timeline-card yt-misinfo-timeline-card--misinformation" role="listitem" tabindex="0" data-timestamp="42.5" data-verdict="misinformation">
          <div class="yt-misinfo-card-row-top">
            <button type="button" class="yt-misinfo-ts-pill" title="Jump to 00:42">
              <svg width="10" height="10" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
              <span>00:42</span>
            </button>
            <span class="yt-misinfo-badge yt-misinfo-badge--misinformation">Misinformation</span>
          </div>
          <p class="yt-misinfo-card-quote">"The moon landing was filmed on a Hollywood sound stage."</p>
          <p class="yt-misinfo-card-desc">Extensive physical evidence and lunar samples confirm Apollo missions.</p>
          <div class="yt-misinfo-card-sources">
            <span class="yt-misinfo-sources-label">Sources:</span>
            <a href="https://factcheck.org/apollo" target="_blank" rel="noopener noreferrer" class="yt-misinfo-source-link">factcheck.org</a>
          </div>
        </article>

        <!-- Verified Card Item -->
        <article class="yt-misinfo-timeline-card yt-misinfo-timeline-card--verified" role="listitem" tabindex="0" data-timestamp="95.0" data-verdict="verified">
          <div class="yt-misinfo-card-row-top">
            <button type="button" class="yt-misinfo-ts-pill" title="Jump to 01:35">
              <svg width="10" height="10" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
              <span>01:35</span>
            </button>
            <span class="yt-misinfo-badge yt-misinfo-badge--verified">Verified</span>
          </div>
          <p class="yt-misinfo-card-quote">"Apollo 11 launched atop a Saturn V rocket from Kennedy Space Center."</p>
          <p class="yt-misinfo-card-desc">Confirmed by official NASA mission archives and historical launch footage.</p>
          <div class="yt-misinfo-card-sources">
            <span class="yt-misinfo-sources-label">Sources:</span>
            <a href="https://nasa.gov/mission_pages/apollo" target="_blank" rel="noopener noreferrer" class="yt-misinfo-source-link">nasa.gov</a>
          </div>
        </article>
      </div>

      <div class="yt-misinfo-empty-state yt-misinfo-hidden">
        <p>No claims match the selected filter.</p>
      </div>
    </div>

    <footer class="yt-misinfo-drawer-footer">
      <span>YouTube Misinformation Detector &bull; Real-time</span>
    </footer>
  </aside>
</div>
```

---

### 4.2 Blueprint: `src/storage.js`

```javascript
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
  filterVerdict: 'all' // 'all' | 'misinformation' | 'verified' | 'unknown'
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
 * @returns {Promise<{ enabled: boolean, showOverlays: boolean, filterVerdict: string }>}
 */
export async function getSettings() {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
        const saved = result && result[STORAGE_KEYS.SETTINGS];
        resolve({ ...DEFAULT_SETTINGS, ...(saved || {}) });
      });
    });
  }

  const saved = memoryStore[STORAGE_KEYS.SETTINGS];
  return { ...DEFAULT_SETTINGS, ...(saved || {}) };
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
```

---

### 4.3 Blueprint: `src/overlay-manager.js`

```javascript
import { formatTimestamp } from './youtube-url.js';

/**
 * Manages the in-video misinformation warning alert card inside YouTube's #movie_player.
 */
export class OverlayManager {
  /**
   * @param {Object} [options]
   * @param {HTMLElement} [options.playerElement]
   * @param {() => void} [options.onViewTimeline]
   */
  constructor(options = {}) {
    this.playerElement = options.playerElement || null;
    this.container = null;
    this.activeClaim = null;
    this.dismissedClaimKey = null;
    this.onViewTimelineCallback = options.onViewTimeline || null;
    this.hideTimeout = null;
  }

  /**
   * Mounts the overlay container into #movie_player.
   * @param {HTMLElement} [playerElement]
   * @returns {HTMLElement} The root container.
   */
  mount(playerElement) {
    if (playerElement) {
      this.playerElement = playerElement;
    }
    if (!this.playerElement && typeof document !== 'undefined') {
      this.playerElement = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    }
    if (!this.playerElement) {
      return null;
    }

    let existing = this.playerElement.querySelector('#yt-misinfo-overlay-root');
    if (existing) {
      this.container = existing;
      return this.container;
    }

    this.container = document.createElement('div');
    this.container.id = 'yt-misinfo-overlay-root';
    this.container.className = 'yt-misinfo-overlay-container';

    this.playerElement.appendChild(this.container);
    return this.container;
  }

  /**
   * Synchronizes the overlay state with current active claim and settings.
   * @param {Object|null} activeClaim
   * @param {{ enabled: boolean, showOverlays: boolean }} settings
   */
  update(activeClaim, settings = { enabled: true, showOverlays: true }) {
    if (!settings.enabled || !settings.showOverlays) {
      this.hide();
      return;
    }

    if (!activeClaim || activeClaim.verdict !== 'misinformation') {
      this.hide();
      return;
    }

    const claimKey = `${activeClaim.timestamp}_${activeClaim.sentence}`;
    if (this.dismissedClaimKey === claimKey) {
      return;
    }

    if (this.activeClaim && `${this.activeClaim.timestamp}_${this.activeClaim.sentence}` === claimKey) {
      // Already displaying this active claim
      return;
    }

    this.show(activeClaim);
  }

  /**
   * Renders and displays the warning card for a misinformation claim.
   * @param {Object} claim
   */
  show(claim) {
    if (!this.container) {
      this.mount();
    }
    if (!this.container) return;

    this.activeClaim = claim;
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Build Card DOM safely (using textContent for XSS prevention)
    const card = document.createElement('div');
    card.className = 'yt-misinfo-card yt-misinfo-card--misinformation';
    card.setAttribute('role', 'alert');
    card.setAttribute('aria-live', 'polite');
    card.dataset.timestamp = String(claim.timestamp);

    // Header
    const header = document.createElement('div');
    header.className = 'yt-misinfo-card-header';

    const badge = document.createElement('div');
    badge.className = 'yt-misinfo-card-badge';
    badge.innerHTML = `
      <svg class="yt-misinfo-icon" viewBox="0 0 24 24" width="16" height="16">
        <path d="M12 2L1 21h22L12 2zm0 3.5L20 19H4L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="currentColor"/>
      </svg>
      <span class="yt-misinfo-card-badge-text">Misinformation Alert</span>
    `;

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'yt-misinfo-card-dismiss';
    dismissBtn.setAttribute('aria-label', 'Dismiss alert');
    dismissBtn.innerHTML = '&times;';
    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss();
    });

    header.appendChild(badge);
    header.appendChild(dismissBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'yt-misinfo-card-body';

    const meta = document.createElement('div');
    meta.className = 'yt-misinfo-card-meta';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'yt-misinfo-card-time';
    timeSpan.textContent = formatTimestamp(claim.timestamp);
    meta.appendChild(timeSpan);

    const quote = document.createElement('blockquote');
    quote.className = 'yt-misinfo-card-sentence';
    quote.textContent = `“${claim.sentence}”`;

    const explanation = document.createElement('p');
    explanation.className = 'yt-misinfo-card-explanation';
    explanation.textContent = claim.explanation || 'This statement has been flagged as inaccurate or misleading.';

    body.appendChild(meta);
    body.appendChild(quote);
    body.appendChild(explanation);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'yt-misinfo-card-footer';

    if (claim.sources && claim.sources.length > 0) {
      const sourceUrl = claim.sources[0];
      if (/^https?:\/\//i.test(sourceUrl)) {
        const sourceLink = document.createElement('a');
        sourceLink.className = 'yt-misinfo-card-source';
        sourceLink.href = sourceUrl;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        try {
          sourceLink.textContent = new URL(sourceUrl).hostname.replace(/^www\./, '');
        } catch {
          sourceLink.textContent = 'Fact Check Source';
        }
        footer.appendChild(sourceLink);
      }
    }

    const timelineBtn = document.createElement('button');
    timelineBtn.type = 'button';
    timelineBtn.className = 'yt-misinfo-card-btn-timeline';
    timelineBtn.textContent = 'View in Timeline →';
    timelineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof this.onViewTimelineCallback === 'function') {
        this.onViewTimelineCallback(claim);
      }
    });
    footer.appendChild(timelineBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    this.container.replaceChildren(card);
  }

  /**
   * Hides the active warning overlay.
   */
  hide() {
    if (!this.container || !this.activeClaim) return;
    const card = this.container.querySelector('.yt-misinfo-card');
    if (card) {
      card.classList.add('yt-misinfo-card--hiding');
      this.hideTimeout = setTimeout(() => {
        if (this.container) {
          this.container.replaceChildren();
        }
        this.activeClaim = null;
        this.hideTimeout = null;
      }, 180);
    } else {
      this.container.replaceChildren();
      this.activeClaim = null;
    }
  }

  /**
   * Dismisses the current claim instance on manual user action.
   */
  dismiss() {
    if (this.activeClaim) {
      this.dismissedClaimKey = `${this.activeClaim.timestamp}_${this.activeClaim.sentence}`;
    }
    this.hide();
  }

  /**
   * Resets the dismissed claim key (e.g., when the user seeks or navigates).
   */
  resetDismissed() {
    this.dismissedClaimKey = null;
  }

  /**
   * Registers a callback for the "View in Timeline" button.
   * @param {(claim: Object) => void} callback
   */
  onViewTimeline(callback) {
    this.onViewTimelineCallback = callback;
  }

  /**
   * Completely removes the overlay from the DOM.
   */
  destroy() {
    this.hide();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.activeClaim = null;
    this.dismissedClaimKey = null;
  }
}
```

---

### 4.4 Blueprint: `src/drawer-manager.js`

```javascript
import { formatTimestamp } from './youtube-url.js';

/**
 * Manages the collapsible interactive timeline drawer listing all analyzed claims chronologically.
 */
export class DrawerManager {
  /**
   * @param {Object} [options]
   * @param {HTMLElement} [options.parent]
   * @param {(timestamp: number) => void} [options.onSeek]
   */
  constructor(options = {}) {
    this.parent = options.parent || null;
    this.root = null;
    this.tabElement = null;
    this.panelElement = null;
    this.cardsListElement = null;
    this.emptyStateElement = null;
    this.totalBadge = null;
    this.tabCount = null;
    this.tabAlertDot = null;

    this.claims = [];
    this.activeClaim = null;
    this.currentFilter = 'all'; // 'all' | 'misinformation' | 'verified' | 'unknown'
    this.isOpenState = false;
    this.onSeekCallback = options.onSeek || null;
  }

  /**
   * Injects the drawer and floating toggle tab into the DOM.
   * @param {HTMLElement} [parent]
   * @returns {HTMLElement}
   */
  mount(parent) {
    if (parent) {
      this.parent = parent;
    }
    if (!this.parent && typeof document !== 'undefined') {
      this.parent = document.body;
    }
    if (!this.parent) return null;

    let existing = document.getElementById('yt-misinfo-drawer-root');
    if (existing) {
      this.root = existing;
      this._bindElements();
      return this.root;
    }

    this.root = document.createElement('div');
    this.root.id = 'yt-misinfo-drawer-root';

    // 1. Floating Toggle Tab
    this.tabElement = document.createElement('button');
    this.tabElement.id = 'yt-misinfo-drawer-tab';
    this.tabElement.className = 'yt-misinfo-drawer-tab';
    this.tabElement.setAttribute('aria-label', 'Toggle Fact Check Timeline');
    this.tabElement.setAttribute('title', 'Toggle Fact Check Timeline');
    this.tabElement.innerHTML = `
      <svg class="yt-misinfo-tab-icon" viewBox="0 0 24 24" width="18" height="18">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="currentColor"/>
      </svg>
      <span class="yt-misinfo-tab-label">Claims</span>
      <span class="yt-misinfo-tab-count">0</span>
      <span class="yt-misinfo-tab-alert-dot yt-misinfo-hidden"></span>
    `;
    this.tabElement.addEventListener('click', () => this.toggle());

    // 2. Sliding Drawer Panel
    this.panelElement = document.createElement('aside');
    this.panelElement.id = 'yt-misinfo-drawer-panel';
    this.panelElement.className = 'yt-misinfo-drawer-panel yt-misinfo-drawer-panel--collapsed';
    this.panelElement.setAttribute('role', 'complementary');
    this.panelElement.setAttribute('aria-label', 'Fact check claims timeline');

    // Header
    const header = document.createElement('header');
    header.className = 'yt-misinfo-drawer-header';
    header.innerHTML = `
      <div class="yt-misinfo-drawer-title-group">
        <svg class="yt-misinfo-header-icon" viewBox="0 0 24 24" width="20" height="20">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
        </svg>
        <h2 class="yt-misinfo-drawer-title">Claims Timeline</h2>
        <span class="yt-misinfo-drawer-total-badge" id="yt-misinfo-drawer-total">0</span>
      </div>
      <button type="button" class="yt-misinfo-drawer-close" aria-label="Close timeline drawer">&times;</button>
    `;
    header.querySelector('.yt-misinfo-drawer-close').addEventListener('click', () => this.close());

    // Filter Chips
    const filters = document.createElement('nav');
    filters.className = 'yt-misinfo-drawer-filters';
    filters.setAttribute('role', 'tablist');
    filters.innerHTML = `
      <button type="button" class="yt-misinfo-filter-chip yt-misinfo-filter-chip--active" data-filter="all">All</button>
      <button type="button" class="yt-misinfo-filter-chip" data-filter="misinformation">Misinformation</button>
      <button type="button" class="yt-misinfo-filter-chip" data-filter="verified">Verified</button>
      <button type="button" class="yt-misinfo-filter-chip" data-filter="unknown">Unverified</button>
    `;
    filters.addEventListener('click', (e) => {
      const chip = e.target.closest('.yt-misinfo-filter-chip');
      if (chip && chip.dataset.filter) {
        this.setFilter(chip.dataset.filter);
      }
    });

    // Body
    const body = document.createElement('div');
    body.className = 'yt-misinfo-drawer-body';

    this.cardsListElement = document.createElement('div');
    this.cardsListElement.className = 'yt-misinfo-cards-list';
    this.cardsListElement.setAttribute('role', 'list');
    this._attachEventDelegation(this.cardsListElement);

    this.emptyStateElement = document.createElement('div');
    this.emptyStateElement.className = 'yt-misinfo-empty-state yt-misinfo-hidden';
    this.emptyStateElement.textContent = 'No claims match the selected filter.';

    body.appendChild(this.cardsListElement);
    body.appendChild(this.emptyStateElement);

    // Footer
    const footer = document.createElement('footer');
    footer.className = 'yt-misinfo-drawer-footer';
    footer.textContent = 'YouTube Misinformation Detector • Real-time';

    this.panelElement.appendChild(header);
    this.panelElement.appendChild(filters);
    this.panelElement.appendChild(body);
    this.panelElement.appendChild(footer);

    this.root.appendChild(this.tabElement);
    this.root.appendChild(this.panelElement);
    this.parent.appendChild(this.root);

    this._bindElements();
    return this.root;
  }

  _bindElements() {
    if (!this.root) return;
    this.tabElement = this.root.querySelector('#yt-misinfo-drawer-tab');
    this.panelElement = this.root.querySelector('#yt-misinfo-drawer-panel');
    this.cardsListElement = this.root.querySelector('.yt-misinfo-cards-list');
    this.emptyStateElement = this.root.querySelector('.yt-misinfo-empty-state');
    this.totalBadge = this.root.querySelector('#yt-misinfo-drawer-total');
    this.tabCount = this.root.querySelector('.yt-misinfo-tab-count');
    this.tabAlertDot = this.root.querySelector('.yt-misinfo-tab-alert-dot');
  }

  _attachEventDelegation(container) {
    container.addEventListener('click', (e) => {
      // Don't intercept clicks on source links
      if (e.target.closest('a')) return;

      const card = e.target.closest('.yt-misinfo-timeline-card');
      if (card && card.dataset.timestamp) {
        const timestamp = parseFloat(card.dataset.timestamp);
        if (!isNaN(timestamp) && typeof this.onSeekCallback === 'function') {
          this.onSeekCallback(timestamp);
        }
      }
    });

    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.yt-misinfo-timeline-card');
        if (card && card.dataset.timestamp) {
          e.preventDefault();
          const timestamp = parseFloat(card.dataset.timestamp);
          if (!isNaN(timestamp) && typeof this.onSeekCallback === 'function') {
            this.onSeekCallback(timestamp);
          }
        }
      }
    });
  }

  /**
   * Sets the claims array and re-renders the chronological cards.
   * @param {Array<Object>} claims
   */
  setClaims(claims = []) {
    this.claims = [...claims].sort((a, b) => a.timestamp - b.timestamp);
    this._updateCounters();
    this.render();
  }

  _updateCounters() {
    const total = this.claims.length;
    const misinfoCount = this.claims.filter((c) => c.verdict === 'misinformation').length;

    if (this.totalBadge) this.totalBadge.textContent = String(total);
    if (this.tabCount) this.tabCount.textContent = String(total);
    if (this.tabAlertDot) {
      if (misinfoCount > 0) {
        this.tabAlertDot.classList.remove('yt-misinfo-hidden');
      } else {
        this.tabAlertDot.classList.add('yt-misinfo-hidden');
      }
    }

    if (this.root) {
      const chips = this.root.querySelectorAll('.yt-misinfo-filter-chip');
      chips.forEach((chip) => {
        const f = chip.dataset.filter;
        if (f === 'all') chip.textContent = `All (${total})`;
        else if (f === 'misinformation') chip.textContent = `Misinformation (${misinfoCount})`;
        else if (f === 'verified') chip.textContent = `Verified (${this.claims.filter((c) => c.verdict === 'verified').length})`;
        else if (f === 'unknown') chip.textContent = `Unverified (${this.claims.filter((c) => c.verdict === 'unknown').length})`;
      });
    }
  }

  /**
   * Renders the claim cards according to the active filter.
   */
  render() {
    if (!this.cardsListElement) return;

    const filtered = this.claims.filter((claim) => {
      if (this.currentFilter === 'all') return true;
      return claim.verdict === this.currentFilter;
    });

    this.cardsListElement.replaceChildren();

    if (filtered.length === 0) {
      if (this.emptyStateElement) this.emptyStateElement.classList.remove('yt-misinfo-hidden');
      return;
    }

    if (this.emptyStateElement) this.emptyStateElement.classList.add('yt-misinfo-hidden');

    filtered.forEach((claim) => {
      const card = document.createElement('article');
      card.className = `yt-misinfo-timeline-card yt-misinfo-timeline-card--${claim.verdict}`;
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');
      card.dataset.timestamp = String(claim.timestamp);
      card.dataset.verdict = claim.verdict;

      if (this.activeClaim && this.activeClaim.timestamp === claim.timestamp) {
        card.classList.add('yt-misinfo-card--active');
      }

      // Top Row (Timestamp Pill + Verdict Badge)
      const topRow = document.createElement('div');
      topRow.className = 'yt-misinfo-card-row-top';

      const tsPill = document.createElement('button');
      tsPill.type = 'button';
      tsPill.className = 'yt-misinfo-ts-pill';
      tsPill.title = `Jump to ${formatTimestamp(claim.timestamp)}`;
      tsPill.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
        <span>${formatTimestamp(claim.timestamp)}</span>
      `;

      const badge = document.createElement('span');
      badge.className = `yt-misinfo-badge yt-misinfo-badge--${claim.verdict}`;
      badge.textContent = claim.verdict === 'misinformation'
        ? 'Misinformation'
        : claim.verdict === 'verified'
          ? 'Verified'
          : 'Unverified';

      topRow.appendChild(tsPill);
      topRow.appendChild(badge);

      // Quote & Explanation (Sanitized with textContent)
      const quote = document.createElement('p');
      quote.className = 'yt-misinfo-card-quote';
      quote.textContent = `“${claim.sentence}”`;

      const desc = document.createElement('p');
      desc.className = 'yt-misinfo-card-desc';
      desc.textContent = claim.explanation;

      card.appendChild(topRow);
      card.appendChild(quote);
      card.appendChild(desc);

      // Sources
      if (claim.sources && claim.sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'yt-misinfo-card-sources';

        const label = document.createElement('span');
        label.className = 'yt-misinfo-sources-label';
        label.textContent = 'Sources:';
        sourcesDiv.appendChild(label);

        claim.sources.forEach((src) => {
          if (/^https?:\/\//i.test(src)) {
            const link = document.createElement('a');
            link.className = 'yt-misinfo-source-link';
            link.href = src;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            try {
              link.textContent = new URL(src).hostname.replace(/^www\./, '');
            } catch {
              link.textContent = 'source';
            }
            sourcesDiv.appendChild(link);
          }
        });

        card.appendChild(sourcesDiv);
      }

      this.cardsListElement.appendChild(card);
    });
  }

  /**
   * Highlights the active claim currently playing and scrolls into view.
   * @param {Object|null} activeClaim
   */
  setActiveClaim(activeClaim) {
    this.activeClaim = activeClaim;
    if (!this.cardsListElement) return;

    const cards = this.cardsListElement.querySelectorAll('.yt-misinfo-timeline-card');
    cards.forEach((card) => {
      const ts = parseFloat(card.dataset.timestamp);
      if (activeClaim && ts === activeClaim.timestamp) {
        if (!card.classList.contains('yt-misinfo-card--active')) {
          card.classList.add('yt-misinfo-card--active');
          if (this.isOpenState) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      } else {
        card.classList.remove('yt-misinfo-card--active');
      }
    });
  }

  /**
   * Filters the visible cards by verdict.
   * @param {'all' | 'misinformation' | 'verified' | 'unknown'} filter
   */
  setFilter(filter) {
    this.currentFilter = filter;
    if (this.root) {
      const chips = this.root.querySelectorAll('.yt-misinfo-filter-chip');
      chips.forEach((chip) => {
        if (chip.dataset.filter === filter) {
          chip.classList.add('yt-misinfo-filter-chip--active');
        } else {
          chip.classList.remove('yt-misinfo-filter-chip--active');
        }
      });
    }
    this.render();
  }

  open() {
    this.isOpenState = true;
    if (this.panelElement) {
      this.panelElement.classList.remove('yt-misinfo-drawer-panel--collapsed');
    }
    if (this.activeClaim) {
      this.setActiveClaim(this.activeClaim);
    }
  }

  close() {
    this.isOpenState = false;
    if (this.panelElement) {
      this.panelElement.classList.add('yt-misinfo-drawer-panel--collapsed');
    }
  }

  toggle() {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open();
    }
  }

  isOpen() {
    return this.isOpenState;
  }

  /**
   * Registers a seek callback when a claim or timestamp is clicked.
   * @param {(timestamp: number) => void} callback
   */
  onSeek(callback) {
    this.onSeekCallback = callback;
  }

  /**
   * Removes drawer from DOM and cleans up listeners.
   */
  destroy() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.claims = [];
    this.activeClaim = null;
    this.isOpenState = false;
  }
}
```

---

### 4.5 Blueprint: `src/styles.css`

```css
/* ==========================================================================
   YouTube Real-Time Misinformation Detector - Scoped Styles
   Uses YouTube official CSS variables (--yt-spec-*) with fallbacks
   ========================================================================== */

:root {
  --yt-misinfo-red: #ff4d4f;
  --yt-misinfo-red-bg: rgba(255, 77, 79, 0.14);
  --yt-misinfo-red-glow: rgba(255, 77, 79, 0.4);
  --yt-misinfo-green: #52c41a;
  --yt-misinfo-green-bg: rgba(82, 196, 26, 0.14);
  --yt-misinfo-gray: #8c8c8c;
  --yt-misinfo-gray-bg: rgba(140, 140, 140, 0.14);
  --yt-misinfo-font: "YouTube Sans", Roboto, Arial, sans-serif;
}

/* ==========================================================================
   1. In-Video Warning Overlay inside #movie_player
   ========================================================================== */

#yt-misinfo-overlay-root.yt-misinfo-overlay-container {
  position: absolute !important;
  top: 24px !important;
  right: 24px !important;
  z-index: 65 !important;
  pointer-events: none !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-end !important;
  max-width: 380px !important;
  width: calc(100% - 48px) !important;
  box-sizing: border-box !important;
  font-family: var(--yt-misinfo-font) !important;
}

/* Fullscreen mode scaling */
#movie_player:fullscreen .yt-misinfo-overlay-container,
#movie_player.ytp-fullscreen .yt-misinfo-overlay-container {
  top: 36px !important;
  right: 36px !important;
  max-width: 440px !important;
}

.yt-misinfo-card {
  pointer-events: auto !important;
  background-color: var(--yt-spec-raised-background, rgba(28, 28, 28, 0.95)) !important;
  color: var(--yt-spec-text-primary, #ffffff) !important;
  border: 1px solid var(--yt-misinfo-red) !important;
  border-left: 4px solid var(--yt-misinfo-red) !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px var(--yt-misinfo-red-glow) !important;
  padding: 14px 16px !important;
  width: 100% !important;
  box-sizing: border-box !important;
  animation: ytMisinfoSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
  transition: opacity 0.18s ease, transform 0.18s ease !important;
  backdrop-filter: blur(8px) !important;
}

.yt-misinfo-card--hiding {
  opacity: 0 !important;
  transform: translateY(-8px) scale(0.96) !important;
}

@keyframes ytMisinfoSlideDown {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.yt-misinfo-card-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  margin-bottom: 8px !important;
}

.yt-misinfo-card-badge {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  color: var(--yt-misinfo-red) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
}

.yt-misinfo-card-dismiss {
  background: none !important;
  border: none !important;
  color: var(--yt-spec-text-secondary, #aaaaaa) !important;
  font-size: 20px !important;
  line-height: 1 !important;
  cursor: pointer !important;
  padding: 2px 6px !important;
  border-radius: 4px !important;
  transition: color 0.15s, background-color 0.15s !important;
}

.yt-misinfo-card-dismiss:hover {
  color: #ffffff !important;
  background-color: rgba(255, 255, 255, 0.15) !important;
}

.yt-misinfo-card-meta {
  margin-bottom: 6px !important;
}

.yt-misinfo-card-time {
  display: inline-block !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  color: var(--yt-spec-text-secondary, #aaaaaa) !important;
  background-color: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.1)) !important;
  padding: 2px 6px !important;
  border-radius: 4px !important;
}

.yt-misinfo-card-sentence {
  font-size: 13.5px !important;
  font-weight: 500 !important;
  line-height: 1.4 !important;
  margin: 0 0 8px 0 !important;
  padding-left: 8px !important;
  border-left: 2px solid var(--yt-spec-text-secondary, #666) !important;
  font-style: italic !important;
  color: var(--yt-spec-text-primary, #f1f1f1) !important;
  word-break: break-word !important;
}

.yt-misinfo-card-explanation {
  font-size: 12px !important;
  line-height: 1.45 !important;
  color: var(--yt-spec-text-secondary, #cccccc) !important;
  margin: 0 0 10px 0 !important;
  word-break: break-word !important;
}

.yt-misinfo-card-footer {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding-top: 8px !important;
  border-top: 1px solid var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.08)) !important;
}

.yt-misinfo-card-source {
  font-size: 11px !important;
  color: #3ea6ff !important;
  text-decoration: none !important;
  max-width: 160px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

.yt-misinfo-card-source:hover {
  text-decoration: underline !important;
}

.yt-misinfo-card-btn-timeline {
  background: none !important;
  border: 1px solid var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.2)) !important;
  color: var(--yt-spec-text-primary, #ffffff) !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  padding: 4px 10px !important;
  border-radius: 12px !important;
  cursor: pointer !important;
  transition: background-color 0.15s, border-color 0.15s !important;
}

.yt-misinfo-card-btn-timeline:hover {
  background-color: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.15)) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
}

/* ==========================================================================
   2. Floating Toggle Tab
   ========================================================================== */

#yt-misinfo-drawer-tab.yt-misinfo-drawer-tab {
  position: fixed !important;
  top: 100px !important;
  right: 0 !important;
  z-index: 2001 !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  background-color: var(--yt-spec-raised-background, #212121) !important;
  color: var(--yt-spec-text-primary, #ffffff) !important;
  border: 1px solid var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.15)) !important;
  border-right: none !important;
  border-radius: 20px 0 0 20px !important;
  padding: 8px 14px 8px 12px !important;
  cursor: pointer !important;
  box-shadow: -2px 4px 12px rgba(0, 0, 0, 0.3) !important;
  font-family: var(--yt-misinfo-font) !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s !important;
}

#yt-misinfo-drawer-tab:hover {
  transform: translateX(-4px) !important;
  background-color: var(--yt-spec-menu-background, #282828) !important;
}

.yt-misinfo-tab-count {
  background-color: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.2)) !important;
  padding: 1px 6px !important;
  border-radius: 10px !important;
  font-size: 11px !important;
}

.yt-misinfo-tab-alert-dot {
  width: 8px !important;
  height: 8px !important;
  background-color: var(--yt-misinfo-red) !important;
  border-radius: 50% !important;
  box-shadow: 0 0 6px var(--yt-misinfo-red) !important;
}

/* ==========================================================================
   3. Sliding Drawer Panel
   ========================================================================== */

#yt-misinfo-drawer-panel.yt-misinfo-drawer-panel {
  position: fixed !important;
  top: 56px !important;
  right: 0 !important;
  width: 360px !important;
  height: calc(100vh - 56px) !important;
  z-index: 2000 !important;
  background-color: var(--yt-spec-base-background, #0f0f0f) !important;
  color: var(--yt-spec-text-primary, #ffffff) !important;
  border-left: 1px solid var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.1)) !important;
  box-shadow: -6px 0 20px rgba(0, 0, 0, 0.4) !important;
  display: flex !important;
  flex-direction: column !important;
  font-family: var(--yt-misinfo-font) !important;
  transform: translateX(0) !important;
  transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1) !important;
  box-sizing: border-box !important;
}

#yt-misinfo-drawer-panel.yt-misinfo-drawer-panel--collapsed {
  transform: translateX(100%) !important;
}

.yt-misinfo-drawer-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: 14px 16px !important;
  border-bottom: 1px solid var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.1)) !important;
}

.yt-misinfo-drawer-title-group {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.yt-misinfo-drawer-title {
  margin: 0 !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: var(--yt-spec-text-primary, #ffffff) !important;
}

.yt-misinfo-drawer-total-badge {
  background-color: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.15)) !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  padding: 2px 7px !important;
  border-radius: 10px !important;
}

.yt-misinfo-drawer-close {
  background: none !important;
  border: none !important;
  color: var(--yt-spec-text-secondary, #aaaaaa) !important;
  font-size: 24px !important;
  line-height: 1 !important;
  cursor: pointer !important;
  padding: 0 4px !important;
  border-radius: 4px !important;
}

.yt-misinfo-drawer-close:hover {
  color: #ffffff !important;
}

/* Filter bar */
.yt-misinfo-drawer-filters {
  display: flex !important;
  gap: 6px !important;
  padding: 10px 16px !important;
  border-bottom: 1px solid var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.08)) !important;
  overflow-x: auto !important;
  scrollbar-width: none !important;
}

.yt-misinfo-drawer-filters::-webkit-scrollbar {
  display: none !important;
}

.yt-misinfo-filter-chip {
  background-color: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.08)) !important;
  color: var(--yt-spec-text-secondary, #aaaaaa) !important;
  border: 1px solid transparent !important;
  border-radius: 16px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  padding: 5px 12px !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  transition: all 0.15s ease !important;
}

.yt-misinfo-filter-chip:hover {
  background-color: rgba(255, 255, 255, 0.15) !important;
  color: #ffffff !important;
}

.yt-misinfo-filter-chip--active {
  background-color: var(--yt-spec-text-primary, #ffffff) !important;
  color: var(--yt-spec-base-background, #000000) !important;
  font-weight: 600 !important;
}

/* Body & Cards List */
.yt-misinfo-drawer-body {
  flex: 1 1 auto !important;
  overflow-y: auto !important;
  padding: 12px 14px !important;
}

.yt-misinfo-cards-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
}

.yt-misinfo-timeline-card {
  background-color: var(--yt-spec-raised-background, #1f1f1f) !important;
  border: 1px solid var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.1)) !important;
  border-left: 3px solid transparent !important;
  border-radius: 8px !important;
  padding: 12px !important;
  cursor: pointer !important;
  outline: none !important;
  transition: transform 0.15s, border-color 0.15s, background-color 0.15s !important;
}

.yt-misinfo-timeline-card:hover {
  transform: translateY(-1px) !important;
  background-color: var(--yt-spec-menu-background, #282828) !important;
}

.yt-misinfo-timeline-card:focus-visible {
  border-color: #3ea6ff !important;
}

.yt-misinfo-timeline-card--misinformation {
  border-left-color: var(--yt-misinfo-red) !important;
}

.yt-misinfo-timeline-card--verified {
  border-left-color: var(--yt-misinfo-green) !important;
}

.yt-misinfo-timeline-card--unknown {
  border-left-color: var(--yt-misinfo-gray) !important;
}

/* Active card highlight */
.yt-misinfo-timeline-card.yt-misinfo-card--active {
  background-color: rgba(255, 255, 255, 0.1) !important;
  border-color: #3ea6ff !important;
  box-shadow: 0 0 10px rgba(62, 166, 255, 0.3) !important;
}

.yt-misinfo-card-row-top {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  margin-bottom: 6px !important;
}

.yt-misinfo-ts-pill {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  background: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.1)) !important;
  color: var(--yt-spec-text-primary, #ffffff) !important;
  border: none !important;
  border-radius: 4px !important;
  padding: 3px 6px !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
}

.yt-misinfo-ts-pill:hover {
  background: #3ea6ff !important;
  color: #000000 !important;
}

.yt-misinfo-badge {
  font-size: 11px !important;
  font-weight: 600 !important;
  padding: 2px 7px !important;
  border-radius: 4px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.3px !important;
}

.yt-misinfo-badge--misinformation {
  color: var(--yt-misinfo-red) !important;
  background-color: var(--yt-misinfo-red-bg) !important;
  border: 1px solid var(--yt-misinfo-red) !important;
}

.yt-misinfo-badge--verified {
  color: var(--yt-misinfo-green) !important;
  background-color: var(--yt-misinfo-green-bg) !important;
  border: 1px solid var(--yt-misinfo-green) !important;
}

.yt-misinfo-badge--unknown {
  color: var(--yt-misinfo-gray) !important;
  background-color: var(--yt-misinfo-gray-bg) !important;
  border: 1px solid var(--yt-misinfo-gray) !important;
}

.yt-misinfo-card-quote {
  font-size: 13px !important;
  line-height: 1.4 !important;
  font-weight: 500 !important;
  margin: 0 0 6px 0 !important;
  color: var(--yt-spec-text-primary, #ffffff) !important;
  word-break: break-word !important;
}

.yt-misinfo-card-desc {
  font-size: 12px !important;
  line-height: 1.4 !important;
  color: var(--yt-spec-text-secondary, #aaaaaa) !important;
  margin: 0 0 8px 0 !important;
  word-break: break-word !important;
}

.yt-misinfo-card-sources {
  display: flex !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  gap: 6px !important;
  font-size: 11px !important;
}

.yt-misinfo-sources-label {
  color: var(--yt-spec-text-secondary, #888888) !important;
}

.yt-misinfo-source-link {
  color: #3ea6ff !important;
  text-decoration: none !important;
}

.yt-misinfo-source-link:hover {
  text-decoration: underline !important;
}

.yt-misinfo-empty-state {
  text-align: center !important;
  padding: 32px 16px !important;
  color: var(--yt-spec-text-secondary, #888888) !important;
  font-size: 13px !important;
}

.yt-misinfo-drawer-footer {
  padding: 10px 16px !important;
  border-top: 1px solid var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.08)) !important;
  font-size: 11px !important;
  color: var(--yt-spec-text-secondary, #777777) !important;
  text-align: center !important;
}

.yt-misinfo-hidden {
  display: none !important;
}

/* ==========================================================================
   4. Light Mode Adaptations (html:not([dark]))
   ========================================================================== */

html:not([dark]) #yt-misinfo-drawer-panel {
  background-color: #ffffff !important;
  color: #0f0f0f !important;
  border-left-color: rgba(0, 0, 0, 0.1) !important;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1) !important;
}

html:not([dark]) .yt-misinfo-card {
  background-color: #ffffff !important;
  color: #0f0f0f !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
}

html:not([dark]) .yt-misinfo-timeline-card {
  background-color: #f9f9f9 !important;
  border-color: #e5e5e5 !important;
}

html:not([dark]) .yt-misinfo-timeline-card:hover {
  background-color: #f0f0f0 !important;
}

html:not([dark]) .yt-misinfo-drawer-tab {
  background-color: #ffffff !important;
  color: #0f0f0f !important;
  border-color: rgba(0, 0, 0, 0.15) !important;
}
```

---

### 4.6 Blueprint: `src/content.js`

```javascript
/**
 * Main content script coordinator for YouTube Misinformation Detector.
 * Runs on YouTube watch pages, handles SPA navigations, synchronizes playback with claims,
 * and mounts/unmounts overlay and drawer interfaces.
 */

import { parseYouTubeVideoId, isYouTubeWatchUrl } from './youtube-url.js';
import { getClaimsForVideo } from './claim-service.js';
import { findActiveClaim, seekToTimestamp, isAdActive } from './video-tracker.js';
import { OverlayManager } from './overlay-manager.js';
import { DrawerManager } from './drawer-manager.js';
import { getSettings, onSettingsChanged } from './storage.js';

let activeVideoId = null;
let currentClaims = [];
let currentSettings = { enabled: true, showOverlays: true, filterVerdict: 'all' };
let overlayManager = null;
let drawerManager = null;
let activeVideoElement = null;
let isSeeking = false;
let checkObserver = null;

/**
 * Initializes the content script on page load.
 */
async function init() {
  currentSettings = await getSettings();

  onSettingsChanged((newSettings) => {
    currentSettings = newSettings;
    if (overlayManager) {
      overlayManager.update(null, currentSettings);
    }
    if (drawerManager) {
      if (!currentSettings.enabled) {
        drawerManager.close();
      }
      if (currentSettings.filterVerdict) {
        drawerManager.setFilter(currentSettings.filterVerdict);
      }
    }
  });

  // Listen to YouTube's SPA navigation lifecycle events
  document.addEventListener('yt-navigate-finish', handleNavigation);
  window.addEventListener('popstate', handleNavigation);

  // Setup message listener for popup queries
  chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_VIDEO_STATS') {
      const stats = computeVideoStats();
      sendResponse(stats);
    }
    return true;
  });

  // Immediate check for current page
  handleNavigation();
}

/**
 * Computes claims statistics for current active video.
 */
function computeVideoStats() {
  if (!activeVideoId || !currentClaims) {
    return {
      active: false,
      videoId: null,
      total: 0,
      misinformation: 0,
      verified: 0,
      unknown: 0
    };
  }

  return {
    active: true,
    videoId: activeVideoId,
    total: currentClaims.length,
    misinformation: currentClaims.filter((c) => c.verdict === 'misinformation').length,
    verified: currentClaims.filter((c) => c.verdict === 'verified').length,
    unknown: currentClaims.filter((c) => c.verdict === 'unknown').length
  };
}

/**
 * Handles YouTube navigation events and SPA client-side routing.
 */
async function handleNavigation() {
  const url = window.location.href;
  if (!isYouTubeWatchUrl(url)) {
    teardownSession();
    return;
  }

  const videoId = parseYouTubeVideoId(url);
  if (!videoId) {
    teardownSession();
    return;
  }

  if (videoId === activeVideoId && activeSessionValid()) {
    return;
  }

  await startVideoSession(videoId);
}

function activeSessionValid() {
  return Boolean(activeVideoElement && overlayManager && drawerManager);
}

/**
 * Teardowns any running video session and cleans up UI and listeners.
 */
function teardownSession() {
  if (activeVideoElement) {
    activeVideoElement.removeEventListener('timeupdate', onTimeUpdate);
    activeVideoElement.removeEventListener('seeking', onSeeking);
    activeVideoElement.removeEventListener('seeked', onSeeked);
    activeVideoElement = null;
  }

  if (overlayManager) {
    overlayManager.destroy();
    overlayManager = null;
  }

  if (drawerManager) {
    drawerManager.destroy();
    drawerManager = null;
  }

  if (checkObserver) {
    checkObserver.disconnect();
    checkObserver = null;
  }

  activeVideoId = null;
  currentClaims = [];
  isSeeking = false;
}

/**
 * Starts a new session for the given video ID.
 * @param {string} videoId
 */
async function startVideoSession(videoId) {
  teardownSession();
  activeVideoId = videoId;

  try {
    currentClaims = await getClaimsForVideo(videoId);
  } catch (err) {
    console.error('[YouTube Misinformation Detector] Failed to load claims:', err);
    currentClaims = [];
  }

  const videoElement = await waitForVideoElement(5000);
  if (!videoElement || activeVideoId !== videoId) return;

  activeVideoElement = videoElement;

  // Mount UI components
  overlayManager = new OverlayManager();
  overlayManager.mount();
  overlayManager.onViewTimeline(() => {
    if (drawerManager) {
      drawerManager.open();
    }
  });

  drawerManager = new DrawerManager();
  drawerManager.mount();
  drawerManager.setClaims(currentClaims);
  if (currentSettings.filterVerdict) {
    drawerManager.setFilter(currentSettings.filterVerdict);
  }
  drawerManager.onSeek((targetTime) => {
    if (activeVideoElement) {
      seekToTimestamp(activeVideoElement, targetTime);
      if (overlayManager) {
        overlayManager.resetDismissed();
      }
    }
  });

  // Attach video playback listeners
  activeVideoElement.addEventListener('timeupdate', onTimeUpdate);
  activeVideoElement.addEventListener('seeking', onSeeking);
  activeVideoElement.addEventListener('seeked', onSeeked);
}

function onSeeking() {
  isSeeking = true;
  if (overlayManager) {
    overlayManager.hide();
  }
}

function onSeeked() {
  isSeeking = false;
  if (overlayManager) {
    overlayManager.resetDismissed();
  }
  onTimeUpdate();
}

function onTimeUpdate() {
  if (!activeVideoElement || isSeeking || !currentSettings.enabled) return;

  if (isAdActive()) {
    if (overlayManager) overlayManager.hide();
    return;
  }

  const currentTime = activeVideoElement.currentTime;
  const activeClaim = findActiveClaim(currentClaims, currentTime);

  if (overlayManager) {
    overlayManager.update(activeClaim, currentSettings);
  }
  if (drawerManager) {
    drawerManager.setActiveClaim(activeClaim);
  }
}

/**
 * Resolves the <video> element with MutationObserver retry fallback.
 * @param {number} timeoutMs
 * @returns {Promise<HTMLVideoElement|null>}
 */
function waitForVideoElement(timeoutMs = 5000) {
  const existing = document.querySelector('video.html5-main-video') || document.querySelector('#movie_player video') || document.querySelector('video');
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const startTime = Date.now();
    const observer = new MutationObserver(() => {
      const vid = document.querySelector('video.html5-main-video') || document.querySelector('video');
      if (vid) {
        observer.disconnect();
        resolve(vid);
      } else if (Date.now() - startTime > timeoutMs) {
        observer.disconnect();
        resolve(null);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// Start
init().catch((err) => console.error('[YouTube Misinformation Detector] Init error:', err));
```

---

### 4.7 Blueprint: `popup/popup.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube Misinformation Detector</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <!-- Header -->
    <header class="popup-header">
      <div class="popup-brand">
        <svg class="popup-logo" viewBox="0 0 24 24" width="22" height="22">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" fill="#ff4d4f"/>
        </svg>
        <div>
          <h1 class="popup-title">Misinfo Detector</h1>
          <p class="popup-subtitle" id="status-subtitle">Checking page...</p>
        </div>
      </div>
      <span class="status-indicator" id="status-indicator"></span>
    </header>

    <!-- Master Controls -->
    <section class="popup-section controls-section">
      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">Enable Detector</span>
          <span class="toggle-desc">Master switch for overlays and drawer</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggle-enabled" checked>
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">In-Video Overlays</span>
          <span class="toggle-desc">Show warning cards during playback</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggle-overlays" checked>
          <span class="slider"></span>
        </label>
      </div>
    </section>

    <!-- Video Claim Stats -->
    <section class="popup-section stats-section" id="stats-section">
      <div class="section-header">
        <h2 class="section-title">Current Video Analysis</h2>
        <span class="video-id-badge" id="video-id-badge">No video</span>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" id="stat-total">0</div>
          <div class="stat-label">Total Claims</div>
        </div>
        <div class="stat-card stat-card--misinfo">
          <div class="stat-value" id="stat-misinfo">0</div>
          <div class="stat-label">Misinformation</div>
        </div>
        <div class="stat-card stat-card--verified">
          <div class="stat-value" id="stat-verified">0</div>
          <div class="stat-label">Verified</div>
        </div>
        <div class="stat-card stat-card--unknown">
          <div class="stat-value" id="stat-unknown">0</div>
          <div class="stat-label">Unverified</div>
        </div>
      </div>
    </section>

    <!-- Empty State (Non-YouTube) -->
    <section class="popup-section empty-section yt-misinfo-hidden" id="empty-section">
      <div class="empty-icon">📺</div>
      <h3 class="empty-title">Not on a YouTube Video</h3>
      <p class="empty-desc">Open a YouTube video watch page to see real-time fact checks and claims analysis.</p>
    </section>

    <!-- Filter Preference -->
    <section class="popup-section filter-section">
      <label class="setting-label" for="select-filter">Default Timeline Filter</label>
      <select id="select-filter" class="select-input">
        <option value="all">Show All Claims</option>
        <option value="misinformation">Misinformation Only</option>
        <option value="verified">Verified Only</option>
        <option value="unknown">Unverified Only</option>
      </select>
    </section>

    <footer class="popup-footer">
      <span>v1.0.0 &bull; Manifest V3</span>
    </footer>
  </div>

  <script type="module" src="popup.js"></script>
</body>
</html>
```

---

### 4.8 Blueprint: `popup/popup.css`

```css
:root {
  --bg-color: #0f0f0f;
  --bg-card: #1f1f1f;
  --text-main: #f1f1f1;
  --text-muted: #aaaaaa;
  --border-color: rgba(255, 255, 255, 0.1);
  --accent-red: #ff4d4f;
  --accent-green: #52c41a;
  --accent-gray: #8c8c8c;
  --accent-blue: #3ea6ff;
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

@media (prefers-color-scheme: light) {
  :root {
    --bg-color: #ffffff;
    --bg-card: #f8f9fa;
    --text-main: #0f172a;
    --text-muted: #64748b;
    --border-color: #e2e8f0;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 330px;
  background-color: var(--bg-color);
  color: var(--text-main);
  font-family: var(--font-family);
  font-size: 13px;
  line-height: 1.4;
  user-select: none;
}

.popup-container {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Header */
.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.popup-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.popup-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.popup-subtitle {
  font-size: 11px;
  color: var(--text-muted);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--accent-gray);
}

.status-indicator.active {
  background-color: var(--accent-green);
  box-shadow: 0 0 6px var(--accent-green);
}

/* Sections */
.popup-section {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
}

.controls-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-info {
  display: flex;
  flex-direction: column;
}

.toggle-label {
  font-weight: 600;
  font-size: 12.5px;
}

.toggle-desc {
  font-size: 11px;
  color: var(--text-muted);
}

/* Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #4b5563;
  transition: 0.2s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--accent-blue);
}

input:checked + .slider:before {
  transform: translateX(16px);
}

/* Stats */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.video-id-badge {
  font-size: 10px;
  background-color: var(--border-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 4px;
  text-align: center;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 9.5px;
  color: var(--text-muted);
  margin-top: 3px;
}

.stat-card--misinfo .stat-value {
  color: var(--accent-red);
}

.stat-card--verified .stat-value {
  color: var(--accent-green);
}

.stat-card--unknown .stat-value {
  color: var(--accent-gray);
}

/* Empty Section */
.empty-section {
  text-align: center;
  padding: 20px 14px;
}

.empty-icon {
  font-size: 28px;
  margin-bottom: 6px;
}

.empty-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.empty-desc {
  font-size: 11px;
  color: var(--text-muted);
}

/* Filter */
.filter-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-muted);
}

.select-input {
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  background-color: var(--bg-color);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  font-size: 12px;
  outline: none;
}

.select-input:focus {
  border-color: var(--accent-blue);
}

/* Footer */
.popup-footer {
  text-align: center;
  font-size: 10px;
  color: var(--text-muted);
}

.yt-misinfo-hidden {
  display: none !important;
}
```

---

### 4.9 Blueprint: `popup/popup.js`

```javascript
import { getSettings, saveSettings } from '../src/storage.js';

const dom = {
  statusSubtitle: document.getElementById('status-subtitle'),
  statusIndicator: document.getElementById('status-indicator'),
  toggleEnabled: document.getElementById('toggle-enabled'),
  toggleOverlays: document.getElementById('toggle-overlays'),
  statsSection: document.getElementById('stats-section'),
  emptySection: document.getElementById('empty-section'),
  videoIdBadge: document.getElementById('video-id-badge'),
  statTotal: document.getElementById('stat-total'),
  statMisinfo: document.getElementById('stat-misinfo'),
  statVerified: document.getElementById('stat-verified'),
  statUnknown: document.getElementById('stat-unknown'),
  selectFilter: document.getElementById('select-filter')
};

async function initPopup() {
  const settings = await getSettings();
  dom.toggleEnabled.checked = settings.enabled;
  dom.toggleOverlays.checked = settings.showOverlays;
  dom.selectFilter.value = settings.filterVerdict || 'all';

  setupEventListeners();
  await queryCurrentTab();
}

function setupEventListeners() {
  dom.toggleEnabled.addEventListener('change', async () => {
    await saveSettings({ enabled: dom.toggleEnabled.checked });
  });

  dom.toggleOverlays.addEventListener('change', async () => {
    await saveSettings({ showOverlays: dom.toggleOverlays.checked });
  });

  dom.selectFilter.addEventListener('change', async () => {
    await saveSettings({ filterVerdict: dom.selectFilter.value });
  });
}

async function queryCurrentTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
    showNonYouTubeView('Extension preview mode');
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      showNonYouTubeView('No active tab');
      return;
    }

    const tab = tabs[0];
    const url = tab.url || '';

    if (!url.includes('youtube.com/watch')) {
      showNonYouTubeView('Not a YouTube watch page');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'GET_VIDEO_STATS' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.active) {
        showActiveYouTubeView({
          videoId: new URL(url).searchParams.get('v') || 'Unknown',
          total: 0,
          misinformation: 0,
          verified: 0,
          unknown: 0
        });
        return;
      }

      showActiveYouTubeView(response);
    });
  } catch (err) {
    console.error('Error querying active tab:', err);
    showNonYouTubeView('Error reading tab');
  }
}

function showActiveYouTubeView(stats) {
  dom.statusSubtitle.textContent = `Active on video`;
  dom.statusIndicator.classList.add('active');

  dom.emptySection.classList.add('yt-misinfo-hidden');
  dom.statsSection.classList.remove('yt-misinfo-hidden');

  dom.videoIdBadge.textContent = stats.videoId || 'Active';
  dom.statTotal.textContent = String(stats.total || 0);
  dom.statMisinfo.textContent = String(stats.misinformation || 0);
  dom.statVerified.textContent = String(stats.verified || 0);
  dom.statUnknown.textContent = String(stats.unknown || 0);
}

function showNonYouTubeView(reason) {
  dom.statusSubtitle.textContent = reason;
  dom.statusIndicator.classList.remove('active');

  dom.statsSection.classList.add('yt-misinfo-hidden');
  dom.emptySection.classList.remove('yt-misinfo-hidden');
}

document.addEventListener('DOMContentLoaded', initPopup);
```

---

## 5. Verification Method

To independently verify the completeness, correctness, and adherence of this blueprint:

1. **Syntax Check & Linting**:
   ```bash
   node --check src/overlay-manager.js src/drawer-manager.js src/storage.js src/content.js popup/popup.js
   ```
2. **DOM Component Unit Testing (`tests/dom-components.test.js`)**:
   Verify overlay creation, dismissal, drawer tab click, filter chips, and click-to-seek jump:
   ```javascript
   // Pseudo-code assertion:
   const drawer = new DrawerManager();
   drawer.mount(document.body);
   drawer.setClaims([{ timestamp: 42.5, sentence: 'Test', verdict: 'misinformation', explanation: 'Exp', sources: [] }]);
   let seekedTs = null;
   drawer.onSeek((ts) => { seekedTs = ts; });
   document.querySelector('.yt-misinfo-timeline-card').click();
   assert.equal(seekedTs, 42.5);
   ```
3. **Storage Fallback Verification (`tests/storage.test.js`)**:
   ```bash
   npm test
   ```
4. **Puppeteer Browser Verification (`npm run test:e2e`)**:
   Load simulated YouTube watch page with `#movie_player`, verify overlay appears at `currentTime = 42.5`, disappears past window, and drawer highlights active card.
5. **Invalidation Conditions**:
   - If overlay disappears during native fullscreen mode.
   - If clicks outside overlay card fail to reach `#movie_player`.
   - If settings changes in popup fail to update running content scripts.
