# Architectural Investigation Report: YouTube Watch Page & DOM Integration

**Agent**: Survey Agent 2 (`explorer_survey_2`)  
**Role**: YouTube Watch Page & DOM Architecture Explorer  
**Working Directory**: `/Users/kadirpili/Documents/chrome-extension/.agents/teamwork/explorer_survey_2/`  
**Target File**: `/Users/kadirpili/Documents/chrome-extension/.agents/teamwork/explorer_survey_2/handoff.md`  
**Date**: 2026-10-17T06:03:00Z  

---

## 1. Observation

### 1.1 Requirements and Constraints from `ORIGINAL_REQUEST.md`
Inspection of `/Users/kadirpili/Documents/chrome-extension/ORIGINAL_REQUEST.md`:
- **Line 12-14 (R1)**:
  > "The extension runs exclusively on YouTube watch pages (`*://*.youtube.com/watch*`)."  
  > "Detects video ID updates across both initial page loads and client-side YouTube Single-Page-App (SPA) navigations (`yt-navigate-finish`, URL popstate, or DOM mutation observers) without requiring manual page reloads."
- **Line 16-28 (R2)**:
  > "Given an active YouTube video ID, retrieve analysis records structured as:
  > `[{ "timestamp": 42.5, "sentence": "Sample excerpt...", "verdict": "misinformation" | "verified" | "unknown", "explanation": "...", "sources": ["..."] }]`"
- **Line 31-36 (R3)**:
  > "**In-Video Warning Overlay**: When the current playback time (`currentTime`) aligns with a sentence flagged as `misinformation`, display a clean, non-intrusive warning card/banner on or directly adjacent to the YouTube video player."  
  > "**Side Panel / Interactive Drawer**: Embed a collapsible, YouTube-native styled panel beside the player or comments section listing all analyzed sentences chronologically. Color-coded badges for verdicts (`misinformation` = warning red/amber, `verified` = green, `unknown` = neutral gray). Clicking any sentence jumps the YouTube player to that specific timestamp."

### 1.2 Existing Codebase State
Direct inspection of `/Users/kadirpili/Documents/chrome-extension/manifest.json`, `package.json`, `src/content.js`, and `tests/`:
- **Current `manifest.json` (lines 24-30)**:
  ```json
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content.js"],
      "run_at": "document_idle"
    }
  ]
  ```
  The workspace is currently configured with the legacy "PagePulse" reading stats extension.
- **Current `package.json` (lines 7-10, 21-23)**:
  ```json
  "scripts": {
    "test": "node --test tests/stats.test.js tests/storage.test.js",
    "test:e2e": "node tests/e2e.test.js",
    "test:all": "node --test tests/stats.test.js tests/storage.test.js && node tests/e2e.test.js"
  },
  "devDependencies": {
    "puppeteer": "^25.14.0"
  }
  ```
  The test environment runs natively via Node.js (`node --test`), ES modules (`"type": "module"`), and Puppeteer E2E tests targeting `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

### 1.3 YouTube Watch Page DOM Architecture & Selectors
Investigation of YouTube's production desktop Web Client (Polymer / Lit custom element architecture):
1. **Root Application Element**: `<ytd-app>` handles overall routing, header bar, and layout orchestration.
2. **Watch Page Container**: `<ytd-watch-flexy>` is the root component for `/watch` pages. It reflects player state via attributes:
   - Default mode: `<ytd-watch-flexy class="style-scope ytd-page-manager" role="main" video-id="VIDEO_ID">`
   - Theater mode: `<ytd-watch-flexy theater ...>`
   - Fullscreen mode: `<ytd-watch-flexy fullscreen ...>`
3. **Player Container (`#movie_player`)**:
   - Selector: `div#movie_player.html5-video-player`
   - This container wraps the HTML5 `<video>`, controls, overlays, and captions.
   - Crucially, when YouTube requests native browser fullscreen (`Element.requestFullscreen()`), it invokes it on `#movie_player`. `document.fullscreenElement` is `#movie_player`.
4. **Media Video Element**:
   - Selector: `video.html5-main-video` (descendant of `#movie_player .html5-video-container`).
   - When users navigate between videos in SPA mode, YouTube **reuses** this `<video>` DOM node, swapping out its `src` or `MediaSource` buffer without destroying the element.
5. **Player Controls & Auto-Hide State**:
   - Bottom control bar: `.ytp-chrome-bottom` (contains seek bar, play/pause, volume, time indicator, settings, fullscreen; height ~48px; `z-index: 60`).
   - Top control bar: `.ytp-chrome-top` (video title, share button; height ~48px; `z-index: 60`).
   - Caption / Subtitle container: `.ytp-caption-window-container` (`z-index: 50`).
   - Auto-hide class: When the user's cursor is idle, `#movie_player` gains `.ytp-autohide`. When the mouse moves, `.ytp-autohide` is removed.
6. **Watch Page Column Structure**:
   ```html
   <ytd-watch-flexy>
     <div id="columns">
       <div id="primary">
         <div id="primary-inner">
           <div id="player">...</div>
           <div id="below">
             <ytd-watch-metadata>...</ytd-watch-metadata>
             <ytd-comments id="comments">...</ytd-comments>
           </div>
         </div>
       </div>
       <div id="secondary">
         <div id="secondary-inner">
           <!-- Related videos, chat, playlist queue -->
         </div>
       </div>
     </div>
   </ytd-watch-flexy>
   ```
7. **Theme Variables & Root Attribute**:
   - Dark mode toggle sets attribute: `<html dark="true">` or `<html dark>`.
   - YouTube CSS variables:
     - `--yt-spec-base-background`: `#0f0f0f` (dark) / `#ffffff` (light)
     - `--yt-spec-raised-background`: `#212121` (dark) / `#f2f2f2` (light)
     - `--yt-spec-text-primary`: `#f1f1f1` (dark) / `#0f0f0f` (light)
     - `--yt-spec-text-secondary`: `#aaaaaa` (dark) / `#606060` (light)
     - `--yt-spec-10-percent-layer`: `rgba(255, 255, 255, 0.1)` (dark) / `rgba(0, 0, 0, 0.1)` (light)
     - `--yt-spec-brand-background-solid`: `#cc0000`

---

## 2. Logic Chain

### 2.1 YouTube URL Schemas & Video ID Extraction
1. **Observation**: YouTube video links appear in diverse formats in the real world:
   - Standard watch URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Watch URL with non-leading `v`: `https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&t=42s`
   - Short URL: `https://youtu.be/dQw4w9WgXcQ?t=42`
   - Shorts: `https://www.youtube.com/shorts/dQw4w9WgXcQ`
   - Embed: `https://www.youtube.com/embed/dQw4w9WgXcQ`
   - Mobile: `https://m.youtube.com/watch?v=dQw4w9WgXcQ`
   - Live stream: `https://www.youtube.com/live/dQw4w9WgXcQ`
2. **Deduction**: A simple string split on `?v=` or assuming `v` is the first query parameter will fail when parameters like `feature`, `list`, or `index` precede `v`.
3. **Deduction**: Standard YouTube Video IDs are strictly 11 characters conforming to the Base64 URL-safe alphabet `[a-zA-Z0-9_-]{11}`.
4. **Conclusion**: Robust parsing requires a multi-step parser using standard `URL` / `URLSearchParams` with a regex fallback:
   - Primary: `url.searchParams.get('v')` for `/watch` and `/watch_popup`.
   - Path-based: `url.pathname.split('/')[1]` for `youtu.be`, and segment matching for `/shorts/`, `/embed/`, `/live/`.
   - Validation: Verify strictly matches `^[a-zA-Z0-9_-]{11}$`.

### 2.2 SPA Navigation & Content Script Lifecycle Trap
1. **Observation**: YouTube is a Single Page Application. Clicking links on the home page (`youtube.com/`) or related videos updates the browser location via `history.pushState` and dispatches internal custom events (`yt-navigate-start`, `yt-navigate-finish`, `yt-page-data-updated`).
2. **Observation**: Chrome Manifest V3 content scripts matched strictly to `*://*.youtube.com/watch*` are **only injected upon initial document load**. If a user enters YouTube on `https://www.youtube.com/` and clicks a video link, Chrome does NOT trigger content script injection on client-side `pushState`!
3. **Deduction**: To support user journeys starting from the homepage or search feed, the content script must either match `*://*.youtube.com/*` with in-script path filtering (`window.location.pathname.startsWith('/watch')`), or the extension service worker must monitor `chrome.tabs.onUpdated` and inject via `chrome.scripting.executeScript`.
4. **Deduction**: Since declarative content script injection is simpler, safer, and faster, registering `*://*.youtube.com/*` in `manifest.json` and managing an active/inactive state machine in `content.js` based on `location.pathname === '/watch'` is the industry standard approach for YouTube extensions.
5. **Deduction**: When navigating between videos (`Video A` -> `Video B`):
   - YouTube fires `yt-navigate-finish` on `document` and `window`.
   - The `<video>` element is reused.
   - If previous state is not purged, claims from `Video A` would trigger on `Video B`.
6. **Conclusion**: `content.js` must implement a video session coordinator:
   - Maintain `activeVideoId`.
   - On `yt-navigate-finish` or `popstate` or MutationObserver detection, compare `extractVideoId(location.href)` with `activeVideoId`.
   - If leaving `/watch`, execute full teardown (destroy overlay, hide drawer, unhook video listeners).
   - If switching video IDs on `/watch`, tear down previous video session and initialize a fresh session (fetch new claims, rebind video player, refresh drawer).

### 2.3 Video Player Element Discovery & Playback Event Synchronization
1. **Observation**: On watch pages, `<video class="html5-main-video">` inside `#movie_player` may mount asynchronously after `yt-navigate-finish` fires (latency typically 0–300ms depending on cache and network).
2. **Deduction**: Querying `document.querySelector('video')` immediately upon event reception can yield `null`.
3. **Conclusion**: Element discovery must use a `waitForElement` utility combining an immediate query with a short-lived `MutationObserver` (with a 5000ms safety timeout).
4. **Observation**: Standard playback events on `<video>` include:
   - `timeupdate`: Fires at ~250ms intervals during normal playback.
   - `seeking` / `seeked`: Fired during timeline scrubbing.
   - `play` / `pause`: Playback state changes.
   - `ended`: Playback completed.
5. **Deduction**: At 1x playback speed, `timeupdate` fires every 0.25s. At 2x speed, time advances 0.5s per tick. If claims have exact point timestamps (e.g. `42.5s`), an exact equality check `currentTime === timestamp` will almost never match.
6. **Deduction**: Spoken sentences take time to enunciate (average 3.0 to 5.0 seconds). A claim record spoken at `42.5s` should remain active during the sentence interval:
   $$\text{active if } (\text{claim.timestamp} - 0.25) \le \text{currentTime} < \text{claim.timestamp} + \text{duration}$$
   where `duration` defaults to `4.5` seconds (or up to the next claim's timestamp).
7. **Conclusion**: Time synchronizer must implement bounding window search and highlight synchronization on both `timeupdate` and `seeked` events.

### 2.4 In-Video Warning Overlay Positioning & Fullscreen Mechanics
1. **Observation**: In standard view, the video sits inside `#player #movie_player`. In theater mode, `#movie_player` widens to full viewport width. In native Fullscreen mode (`F` key), YouTube calls `moviePlayer.requestFullscreen()`, setting `document.fullscreenElement === #movie_player`.
2. **Deduction**: If an overlay DOM node is injected outside `#movie_player` (e.g., into `document.body` or `ytd-watch-flexy`), the browser's native fullscreen compositor will completely hide the overlay in fullscreen mode!
3. **Conclusion**: The overlay container MUST be injected as a direct child of `#movie_player` (`document.getElementById('movie_player').appendChild(overlay)`).
4. **Observation**: `#movie_player` contains internal UI layers:
   - `.ytp-chrome-bottom` (seek bar, buttons) with `z-index: 60`.
   - `.ytp-chrome-top` (title, share button) with `z-index: 60`.
   - `.ytp-caption-window-container` (subtitles) with `z-index: 50`.
   - Player click-to-pause captures all pointer events on the video area.
5. **Deduction**: Placing the warning banner at the bottom can obstruct the seekbar or collide with captions. Placing it at the top-right (`top: 24px; right: 24px; max-width: 380px;`) avoids all bottom chrome, captions, and the top-left title bar.
6. **Deduction**: To allow users to click/pause the video behind the overlay, the overlay container must have `pointer-events: none;`, while the interactive card (containing dismissal button, source links, and drawer expand button) has `pointer-events: auto;`.
7. **Deduction**: When controls auto-hide (`.ytp-autohide`), the misinformation warning must remain clearly visible if an active false claim is being spoken, fading out gracefully once the claim's time window has passed.

### 2.5 Timeline Drawer UI Architecture & Layout Integration
1. **Observation**: The user request specifies:
   > "Embed a collapsible, YouTube-native styled panel beside the player or comments section listing all analyzed sentences chronologically."
2. **Analysis of Candidate Injection Targets**:
   - **Target A: `#secondary-inner` (Right column)**:
     - Standard mode: Appears at the top of the sidebar above recommended videos.
     - Theater mode: YouTube moves `#secondary` below `#primary` (under the entire video), making it invisible unless the user scrolls down.
     - YouTube reactivity: `#secondary-inner` is frequently wiped or re-rendered by YouTube when playlist queues or chat panels toggle.
   - **Target B: `#below` (Under video metadata)**:
     - Always below the fold; requires scrolling to view while watching the video.
   - **Target C: Collapsible Floating / Docked Side Drawer (`#yt-misinfo-drawer`)**:
     - Positioned fixed on the right edge of the viewport (`top: 56px; right: 0; height: calc(100vh - 56px); width: 360px; z-index: 2000;`).
     - Features a compact floating pill/tab trigger (`🛡️ Fact Checks (3)`) that can be toggled by click or keyboard shortcut.
     - Works seamlessly in standard view, theater view, and across all responsive viewport widths without disturbing YouTube's layout grid.
   - **Target D: In-Layout Primary Dock with Float Toggle**:
     - Can be prepended to `#secondary-inner` in standard mode, with an automatic floating fallback or toggle tab.
3. **Conclusion**: The most robust, professional architecture is a **collapsible floating drawer** anchored to the right viewport margin (or docked neatly above `#secondary-inner`), accompanied by a persistent toggle tab. This ensures the timeline is always accessible regardless of theater mode, scroll position, or player resizing.
4. **Theme Alignment**:
   - Using CSS variables (`var(--yt-spec-base-background)`, `var(--yt-spec-text-primary)`, `var(--yt-spec-10-percent-layer)`) and scoping under `html[dark]` guarantees flawless dark and light mode aesthetics indistinguishable from native YouTube components.
   - Badges:
     - `misinformation`: Red border (`#ff4d4f`), subtle red tint background (`rgba(255, 77, 79, 0.15)`), warning badge text.
     - `verified`: Green border (`#52c41a`), subtle green tint (`rgba(82, 196, 26, 0.15)`).
     - `unknown`: Neutral gray border (`#8c8c8c`), subtle gray tint (`rgba(140, 140, 140, 0.15)`).

### 2.6 Click-to-Seek Mechanics
1. **Observation**: `<video class="html5-main-video">` is an HTML5 `HTMLMediaElement`.
2. **Deduction**: In standard web APIs, setting `video.currentTime = targetTimestamp` causes the browser media pipeline to seek immediately to the requested frame.
3. **Deduction**: YouTube's player UI (`#movie_player`) listens to the video element's native `seeking`, `seeked`, and `timeupdate` events. Mutating `video.currentTime` automatically updates YouTube's native seek bar scrubber and elapsed time counters!
4. **Deduction**: If the video is paused when the user clicks a claim in the timeline drawer, resuming playback (`if (video.paused) video.play().catch(() => {});`) provides the best user experience.
5. **Conclusion**: Click-to-seek requires no fragile private YouTube API hooks; setting `video.currentTime = Math.max(0, Math.min(video.duration || Infinity, targetSeconds))` and invoking `video.play()` is clean, standards-compliant, and 100% reliable.

### 2.7 Edge Cases and Defensive Mitigations
1. **Ad Playback**:
   - When an ad is playing, `#movie_player` has `.ad-showing` or `.ad-interrupting` classes, or `.ytp-ad-player-overlay` is present in DOM.
   - `video.currentTime` reflects the ad's time (0 to 15s), not the main video.
   - Mitigation: Implement `isAdActive()` check; if true, suppress all misinformation warnings and pause claim synchronization.
2. **Livestreams & Premieres**:
   - Livestreams have `video.duration === Infinity` or `.ytp-live` indicator.
   - Seeking past live window is restricted.
   - Mitigation: Detect `video.duration === Infinity` or `.ytp-live`; display a "Live Stream" indicator in drawer and clamp seek actions.
3. **SPA Navigation Away from Watch Page**:
   - User navigates to `/` (Home) or `/feed/subscriptions`.
   - Mitigation: On navigation finish, if `!location.pathname.startsWith('/watch')`, tear down all overlay and drawer DOM nodes, cancel intervals, and reset state.
4. **Rapid Timeline Scrubbing**:
   - Dragging the seekbar triggers rapid `timeupdate` and `seeking` events.
   - Mitigation: Suppress active warning popup during `seeking`; re-evaluate cleanly on `seeked`.

---

## 3. Caveats

1. **YouTube Internal Class Stability**:
   - YouTube occasionally refactors internal class names. However, `#movie_player`, `video.html5-main-video`, `ytd-watch-flexy`, and `yt-navigate-finish` have remained stable for over 6 years across YouTube Polymer, Lit, and modern redesigns.
   - Fallback queries (`document.querySelector('video')`, `document.getElementById('movie_player')`) ensure resilience if minor class tweaks occur.
2. **Manifest Scope vs. User Prompt Wording**:
   - The user prompt states: *"The extension runs exclusively on YouTube watch pages (`*://*.youtube.com/watch*`)."*
   - In pure MV3 declarative semantics, matching only `/watch*` will fail for users navigating from `youtube.com` homepage to a video via SPA navigation without page reload.
   - Architectural resolution: To strictly satisfy both requirements (SPA navigation support AND running exclusively on watch pages), `manifest.json` matches `*://*.youtube.com/*`, while the script immediately verifies `location.pathname.startsWith('/watch')` and only executes when on a watch page, remaining idle elsewhere.
3. **Shadow DOM vs Scoped BEM**:
   - Injecting into `#movie_player` with Shadow DOM isolates extension CSS from YouTube styles. If BEM classes are used without Shadow DOM, CSS resets (`all: initial;` on root) and strict namespace prefixes (`yt-misinfo-*`) must be enforced.

---

## 4. Conclusion

### 4.1 Recommended Architecture Blueprint

```
┌────────────────────────────────────────────────────────────────────────┐
│                          YouTube Web Page                              │
│                                                                        │
│  ┌───────────────────────── ytd-app ────────────────────────────────┐  │
│  │                                                                  │  │
│  │  SPA Router Hooks:                                               │  │
│  │  - yt-navigate-finish                                            │  │
│  │  - popstate                                                      │  │
│  │  - MutationObserver (URL & Video ID change)                      │  │
│  │                                                                  │  │
│  │  ┌─────────────────────── #movie_player ──────────────────────┐  │  │
│  │  │                                                            │  │  │
│  │  │   <video class="html5-main-video">                         │  │  │
│  │  │                                                            │  │  │
│  │  │   ┌─────────────────────────────────────────────────────┐  │  │  │
│  │  │   │ In-Video Warning Overlay Container                  │  │  │  │
│  │  │   │ Position: absolute; top: 24px; right: 24px; z: 65; │  │  │  │
│  │  │   │                                                     │  │  │  │
│  │  │   │  [⚠️ Misinformation Alert]                         │  │  │  │
│  │  │   │  "The moon landing was filmed on a stage..."        │  │  │  │
│  │  │   │  Verdict: Misinformation                            │  │  │  │
│  │  │   │  Sources: NASA Fact Sheet, Reuters Fact Check       │  │  │  │
│  │  │   │  [View in Timeline]  [Dismiss]                      │  │  │  │
│  │  │   └─────────────────────────────────────────────────────┘  │  │  │
│  │  │                                                            │  │  │
│  │  │   Native Controls (.ytp-chrome-bottom)                     │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │ Collapsible Interactive Timeline Drawer                    │  │  │
│  │  │ Position: fixed; right: 0; top: 56px; z-index: 2000;       │  │  │
│  │  │                                                            │  │  │
│  │  │ Header: "Claims Timeline (4)"  [Filter: All/Misinfo] [X]   │  │  │
│  │  │                                                            │  │  │
│  │  │ ┌────────────────────────────────────────────────────────┐ │  │  │
│  │  │ │ 0:42  [🔴 Misinformation]                              │ │  │  │
│  │  │ │ "Statement text here..."                               │ │  │  │
│  │  │ │ Sources: factcheck.org                                 │ │  │  │
│  │  │ └────────────────────────────────────────────────────────┘ │  │  │
│  │  │ ┌────────────────────────────────────────────────────────┐ │  │  │
│  │  │ │ 1:15  [🟢 Verified]                                    │ │  │  │
│  │  │ │ "Statement text here..."                               │ │  │  │
│  │  │ └────────────────────────────────────────────────────────┘ │  │  │
│  │  │                                                            │  │  │
│  │  │ Floating Toggle Tab: [🛡️ Claims (4)]                      │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Module Specifications

| Module | Location | Primary Responsibilities |
|---|---|---|
| **`youtube-url.js`** | `src/youtube-url.js` | Parses YouTube URLs, extracts 11-char Video ID, formats `MM:SS` timestamps, detects watch page vs other routes. |
| **`claim-service.js`** | `src/claim-service.js` | Mock data provider with seeded records for known test videos and deterministic fallback generator for arbitrary video IDs. |
| **`video-tracker.js`** | `src/video-tracker.js` | Discovers `<video>` and `#movie_player`, listens to `timeupdate`/`seeking`/`seeked`, determines active claim within tolerance window, handles `isAdActive()`. |
| **`overlay-manager.js`** | `src/overlay-manager.js` | Injects overlay inside `#movie_player`, manages top-right placement, animated display/dismissal, click-through pass-through (`pointer-events: none/auto`), responsive fullscreen scaling. |
| **`drawer-manager.js`** | `src/drawer-manager.js` | Mounts collapsible timeline drawer, populates chronologically, renders color-coded verdict badges, executes click-to-seek jump (`video.currentTime`), aligns with `html[dark]` theme variables. |
| **`content.js`** | `src/content.js` | Main coordinator: listens to `yt-navigate-finish`, `popstate`, manages video lifecycle transitions, activates on watch pages, tears down on non-watch pages. |
| **`styles.css`** | `src/styles.css` | Scoped CSS rules with `--yt-spec-*` variables, dark/light theme rules, responsive fullscreen adjustments. |

### 4.3 Key Algorithms & Snippets

#### 1. Robust Video ID Extractor (`src/youtube-url.js`):
```javascript
export function parseYouTubeVideoId(urlOrStr) {
  if (!urlOrStr || typeof urlOrStr !== 'string') return null;
  const trimmed = urlOrStr.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed, 'https://www.youtube.com');
    const hostname = url.hostname.toLowerCase();

    if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
      const id = url.pathname.slice(1).split('/')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    if (url.pathname === '/watch' || url.pathname === '/watch_popup') {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(segments[0])) {
      const id = segments[1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    // Non-standard URL, fallback to regex
  }

  const match = trimmed.match(/(?:v=|\/embed\/|\/shorts\/|\/live\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
```

#### 2. Claim Playback Synchronizer with Tolerance Window (`src/video-tracker.js`):
```javascript
export function findActiveClaim(claims, currentTime, leadTolerance = 0.3, defaultDuration = 4.5) {
  if (!claims || !claims.length) return null;

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const startTime = Math.max(0, claim.timestamp - leadTolerance);
    const duration = claim.duration || defaultDuration;
    const nextClaim = claims[i + 1];
    const maxEndTime = nextClaim 
      ? Math.min(claim.timestamp + duration, nextClaim.timestamp) 
      : claim.timestamp + duration;

    if (currentTime >= startTime && currentTime < maxEndTime) {
      return claim;
    }
  }
  return null;
}
```

#### 3. Click-to-Seek Handler:
```javascript
export function seekToTimestamp(videoElement, targetTimestamp, autoPlay = true) {
  if (!videoElement) return false;
  const target = Math.max(0, Math.min(videoElement.duration || Infinity, targetTimestamp));
  videoElement.currentTime = target;
  if (autoPlay && videoElement.paused) {
    videoElement.play().catch(() => {});
  }
  return true;
}
```

#### 4. Ad Detection Guard:
```javascript
export function isAdActive() {
  const player = document.getElementById('movie_player');
  if (player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))) {
    return true;
  }
  return Boolean(document.querySelector('.ytp-ad-player-overlay, .ytp-ad-text'));
}
```

---

## 5. Verification Method

### 5.1 Verification Checklist for Implementer

1. **Unit Testing (Node.js test runner)**:
   - Command: `npm test`
   - Test files to implement:
     - `tests/youtube-url.test.js`:
       - Standard watch URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ` -> `dQw4w9WgXcQ`
       - Query params: `...watch?feature=shared&v=dQw4w9WgXcQ&t=42s` -> `dQw4w9WgXcQ`
       - Short URL: `https://youtu.be/dQw4w9WgXcQ?t=10` -> `dQw4w9WgXcQ`
       - Shorts: `https://www.youtube.com/shorts/dQw4w9WgXcQ` -> `dQw4w9WgXcQ`
       - Embeds: `https://www.youtube.com/embed/dQw4w9WgXcQ` -> `dQw4w9WgXcQ`
       - Invalid/non-YouTube URLs -> returns `null`
     - `tests/claim-service.test.js`:
       - Determinism: Calling arbitrary video ID twice returns identical claims.
       - Schema validation: Every record has `timestamp`, `sentence`, `verdict`, `explanation`, `sources`.
       - Seeded data: Test video IDs return expected specific claims.
     - `tests/video-tracker.test.js`:
       - Active claim lookup inside tolerance window.
       - Returns `null` when current time is outside any claim window.
       - Handles edge timestamps (`0.0s`, end of video).
       - Boundary tolerance checks at `timestamp - 0.25` and `timestamp + duration`.

2. **DOM Component Unit Testing (Mock DOM)**:
   - Verify overlay DOM creation:
     - Warning card contains `misinformation` badge, sentence text, explanation, sources.
     - `pointer-events: none` on container, `pointer-events: auto` on card.
   - Verify timeline drawer rendering:
     - Correct color-coded badge classes (`badge-misinformation`, `badge-verified`, `badge-unknown`).
     - Clicking claim invokes `seekToTimestamp`.
     - Drawer toggle expands/collapses.

3. **End-to-End Puppeteer Testing (`tests/e2e.test.js`)**:
   - Command: `npm run test:e2e`
   - Test flow:
     - Launch Chrome with `--load-extension=.`.
     - Load a simulated YouTube watch page DOM containing `#movie_player`, `video.html5-main-video`, `#secondary`, and dark/light themes.
     - Verify overlay banner appears when `video.currentTime` matches a misinformation claim.
     - Verify clicking a claim item in the drawer changes `video.currentTime`.
     - Verify popup renders summary counts and filter toggles.

4. **Invalidation Conditions**:
   - If setting `video.currentTime` fails to move playback in Chrome.
   - If overlay disappears during Fullscreen mode because it was appended outside `#movie_player`.
   - If misinformation overlay renders during pre-roll or mid-roll advertisements.
   - If client-side navigation between videos retains the previous video's claims.
