# Specification & Requirements Mining Report: YouTube Real-Time Misinformation Detector Extension

**Agent**: Survey Agent 3 (Specification & Requirements Miner)  
**Date**: 2026-10-17  
**Working Directory**: `/Users/kadirpili/Documents/chrome-extension/.agents/teamwork/spec_miner_survey_3/`  
**Reference Specification**: `/Users/kadirpili/Documents/chrome-extension/ORIGINAL_REQUEST.md`  

---

## 1. Observation

### 1.1 Verbatim Specifications from `ORIGINAL_REQUEST.md`
The user request mandates:
> "A dedicated Manifest V3 Chrome Extension exclusively for YouTube that detects, tracks, and warns viewers about misinformation in real-time as video plays, highlighting flagged sentences and providing an interactive timeline drawer."

Key verbatim requirements:
1. **R1: YouTube In-Page Integration & SPA Navigation Handling**:
   - *"The extension runs exclusively on YouTube watch pages (`*://*.youtube.com/watch*`)."*
   - *"Detects video ID updates across both initial page loads and client-side YouTube Single-Page-App (SPA) navigations (`yt-navigate-finish`, URL popstate, or DOM mutation observers) without requiring manual page reloads."*
2. **R2: Video Claim & Sentence Data Retrieval**:
   - Record schema:
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
   - *"For the initial release, implement a mock data service that provides rich, realistic timestamped claims for YouTube video IDs with fallback default demo datasets for any arbitrary video ID."*
3. **R3: In-Video Warnings & Interactive Timeline Drawer UI**:
   - **In-Video Warning Overlay**: *"When the current playback time (`currentTime`) aligns with a sentence flagged as `misinformation`, display a clean, non-intrusive warning card/banner on or directly adjacent to the YouTube video player."*
   - **Side Panel / Interactive Drawer**: *"Embed a collapsible, YouTube-native styled panel beside the player or comments section listing all analyzed sentences chronologically.*
     - *Color-coded badges for verdicts (`misinformation` = warning red/amber, `verified` = green, `unknown` = neutral gray).*
     - *Clicking any sentence jumps the YouTube player to that specific timestamp."*
   - **Popup & Settings**: *"Extension popup provides global toggle, summary stats of claims for the current video, and filter toggles."*
4. **Acceptance Criteria**:
   - **Unit tests**: Video ID extraction (standard and short YouTube URLs); sentence retrieval, parsing, fallback matching; playback time synchronization with tolerance windows.
   - **Automated browser / DOM tests**: Injection and rendering of overlay warnings on simulated video player; click-to-seek video jump; accurate verdict styling and drawer visibility toggling.
   - **Code quality**: Linting, type/syntax checks, and readability passing without warnings.

### 1.2 Inspection of Existing Workspace
- **Legacy Extension**: The existing repository contains files for an old extension named `"PagePulse - Reading Stats & Notes"` (`package.json`, `manifest.json`, `src/stats.js`, `src/storage.js`, `popup/popup.*`, `tests/stats.test.js`, `tests/e2e.test.js`).
- **Test Infrastructure**:
  - Test runner: Native Node.js test runner (`node --test`).
  - Browser Automation: `puppeteer: ^25.14.0` targeting Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
  - Modules: Vanilla ES Modules (`"type": "module"`). Zero runtime build dependencies needed.
- **Replacement Scope**: The old reading stats functionality must be replaced with the YouTube Misinformation Detector while reusing and extending the proven native Node test runner and Puppeteer E2E architecture.

---

## 2. Logic Chain & In-Depth Requirement Mining

### 2.1 Domain Analysis & Architectural Inferences

#### A. R1: YouTube In-Page Integration & SPA Navigation Handling
1. **URL Patterns and Scope Enforcement**:
   - YouTube URLs come in diverse formats:
     - Standard desktop watch: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
     - Watch URLs with query parameters: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123&index=2`
     - Shortened URLs: `https://youtu.be/dQw4w9WgXcQ?t=10`
     - Mobile web: `https://m.youtube.com/watch?v=dQw4w9WgXcQ`
     - Embeds: `https://www.youtube.com/embed/dQw4w9WgXcQ`
   - *Implicit SPA navigation constraint*: When a user navigates from YouTube Home (`https://www.youtube.com/`) to a watch page (`/watch?v=...`), standard browser full page reloads do not occur. YouTube uses custom custom events (`yt-navigate-finish`, `yt-page-data-updated`) and `history.pushState`. If `manifest.json` restricts `content_scripts` solely to `*://*.youtube.com/watch*`, navigating into a video from the home feed will not inject the script. Therefore:
     - `manifest.json` matches `*://*.youtube.com/*`.
     - The content script must immediately check if the current page is a watch page (`/watch`).
     - The script attaches listeners for `yt-navigate-finish`, `popstate`, and observes DOM mutations on the title or container.
2. **Lifecycle & Clean Teardown**:
   - Navigation from Video A -> Video B:
     - Extract new `v` parameter.
     - Unsubscribe or cancel prior time monitors and animation frames.
     - Remove any active warning overlay card from Video A.
     - Clear and reload the interactive drawer with Video B's claim list.
     - Re-bind to the `<video>` element (YouTube frequently replaces or re-attaches HTML5 video nodes during SPA navigations).
   - Navigation from Watch -> Non-Watch (e.g. search or subscriptions):
     - Hide/remove the overlay and drawer entirely.
     - Pause playback tracking.

#### B. R2: Claim Data Model, Mock Service & Deterministic Fallback
1. **Claim Data Contract**:
   ```typescript
   type Verdict = "misinformation" | "verified" | "unknown";

   interface Claim {
     timestamp: number;       // Seconds (e.g. 42.5)
     sentence: string;        // Spoken transcript excerpt
     verdict: Verdict;        // "misinformation" | "verified" | "unknown"
     explanation: string;     // Contextual fact-check rationale
     sources: string[];       // Fact-checking reference URLs
   }
   ```
2. **Seeded Dataset vs. Deterministic Fallback**:
   - **Seeded Dataset**: High-quality, realistic multi-sentence claims for prominent test video IDs (e.g., `"dQw4w9WgXcQ"`, `"jNQXAC9IVRw"`, `"demo-misinfo-1"`).
   - **Deterministic Fallback Algorithm**:
     - Requirement: Any arbitrary video ID entered by a user or automated test must return a realistic claim dataset.
     - Must be **deterministic**: querying the same video ID `V` 100 times must yield the identical array of claims every time.
     - Pseudo-random hashing based on the characters of `videoId`:
       - Derive claim count (e.g., 3 to 6 claims).
       - Spread timestamps predictably across the video timeline (e.g., 10s, 30s, 75s, 140s).
       - Generate claims with a deterministic mix of `misinformation`, `verified`, and `unknown` verdicts.
       - Provide readable, context-rich sentences and plausible fact-checking sources (e.g. Reuters Fact Check, AP News, PolitiFact).
3. **Asynchronous Interface & Tolerance Windows**:
   - Method: `getClaimsForVideo(videoId: string): Promise<Claim[]>`
   - Playback synchronization tolerance window: Speech duration is not a single instant; a sentence spoken at `t=42.5s` takes several seconds. The synchronizer must define an active window:
     $$\text{Active if } \text{timestamp} \le \text{currentTime} < \text{timestamp} + \text{WINDOW\_SECONDS}$$
     Default `WINDOW_SECONDS = 5.0` seconds (or sentence duration).

#### C. R3: In-Video Warnings & Interactive Timeline Drawer UI
1. **In-Video Warning Overlay Component**:
   - Appears exclusively when an active claim has `verdict === "misinformation"`.
   - Mount location: Inside `#movie_player` or direct sibling to `<video class="html5-main-video">`. Mounting inside the player guarantees overlay persistence during Fullscreen mode (`document.fullscreenElement`).
   - UI Layout:
     - Red/amber alert icon & header: "Misinformation Alert".
     - Claim excerpt: Quote of the spoken sentence.
     - Explanation summary.
     - Actions: "Dismiss" (X) button, and "View in Drawer" / "Source" link.
     - Non-intrusive: Positioned at top-center or bottom-left (above native YouTube control bar `#movie_player .ytp-chrome-bottom`).
   - Dismissal logic: If dismissed by user, it remains dismissed for that specific claim instance until playback leaves and re-enters the window.
2. **Interactive Timeline Drawer**:
   - Mount location: Adjacent to player/comments (e.g. inserted above `#secondary-inner` or within `#related` column on desktop, or collapsible side container).
   - UI Structure:
     - Header: "Fact Check & Claim Timeline" with toggle collapse/expand icon, filter tabs (All, Flagged, Verified), and claim count badge.
     - Body: Scrollable list of sentence cards sorted chronologically by `timestamp`.
     - Card Elements:
       - Time badge: Formatted `MM:SS` (e.g. `00:42`, `02:15`).
       - Verdict pill: Color-coded badge:
         - `misinformation`: Red (`#e53935` / `#d32f2f`)
         - `verified`: Green (`#2e7d32` / `#4caf50`)
         - `unknown`: Neutral Gray (`#616161` / `#757575`)
       - Sentence excerpt and expandable explanation & source links.
       - Active state: Highlights the card currently aligned with `video.currentTime`.
   - Interaction (Click-to-Seek):
     - Clicking any claim card triggers: `video.currentTime = claim.timestamp;`
3. **Extension Popup & User Preferences**:
   - Opened via Chrome toolbar icon.
   - Elements:
     - Global toggle switch: Enable/disable extension overlays and drawer.
     - Video summary stats: Total claims, flagged count, verified count, unknown count for the active tab's video.
     - Filter toggles: "Show warning overlays", "Filter drawer by verdict".
     - Storage: Preferences stored in `chrome.storage.local` with real-time change broadcasting via `chrome.storage.onChanged` to content scripts.

---

## 3. Features Discovered & Probed

```
## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Navigation | Watch Page Matching | Detects whether the current active URL is a YouTube watch page | URL string / window.location | Boolean isWatchPage | Returns false for non-watch URLs | ORIGINAL_REQUEST R1 |
| 2 | Navigation | Video ID Extraction | Extracts 11-char YouTube video ID from standard, short, mobile, and parameterized URLs | URL string | String videoId or null | Returns null if not a watch URL or missing 'v' | ORIGINAL_REQUEST R1 & Acceptance Criteria |
| 3 | Navigation | SPA Navigation Listener | Listens to yt-navigate-finish, popstate, and DOM mutations to detect video changes without reloads | DOM events, URL changes | Dispatches onVideoIdChange(videoId) | Gracefully cleans up prior video state | ORIGINAL_REQUEST R1 |
| 4 | Navigation | Video Element Resolver | Resolves and tracks the active HTML5 <video> element even if re-created by YouTube DOM | DOM tree | HTMLVideoElement reference | Retries/observes via MutationObserver if not yet in DOM | Implicit R1 (YouTube SPA behavior) |
| 5 | Navigation | Non-Watch Teardown | Automatically cleans up overlays, hides drawer, and suspends time-tracking when leaving watch page | Navigation away from /watch | DOM elements removed, timers stopped | No-op if already unmounted | Implicit R1 |
| 6 | Data Service | Claim Schema Validator | Validates claim records against the strict schema (timestamp, sentence, verdict, explanation, sources) | Raw JSON object | Validated Claim object | Rejects or sanitizes invalid fields | ORIGINAL_REQUEST R2 |
| 7 | Data Service | Verdict Enum System | Enforces verdict values: 'misinformation', 'verified', 'unknown' | Verdict string | Enum value | Defaults to 'unknown' if unexpected value | ORIGINAL_REQUEST R2 |
| 8 | Data Service | Seeded Mock Claim Repository | Provides realistic multi-sentence claims for specific known video IDs (e.g. dQw4w9WgXcQ) | String videoId | Claim[] array | Falls back to deterministic generator if unknown | ORIGINAL_REQUEST R2 |
| 9 | Data Service | Deterministic Fallback Generator | Generates reproducible, realistic claims for any arbitrary video ID based on string hash | Arbitrary string videoId | Claim[] array (same for same ID) | Never returns empty; valid claims generated | ORIGINAL_REQUEST R2 |
| 10 | Data Service | Claim Retrieval Service | Public async service to fetch claims for a video ID with cache and simulated async latency | videoId, options | Promise<Claim[]> | Returns empty array or fallback on error | ORIGINAL_REQUEST R2 |
| 11 | Playback Sync | Real-Time Time Synchronizer | Subscribes to video timeupdate events and checks active claim against currentTime | video.currentTime, Claim[] | Active Claim or null | Handles rapid scrubbing without locking | ORIGINAL_REQUEST R3 & Acceptance Criteria |
| 12 | Playback Sync | Tolerance Window Evaluation | Determines whether currentTime falls within [timestamp, timestamp + window] | currentTime, timestamp, windowSec | Boolean isActive | False if currentTime < timestamp or >= timestamp + window | Acceptance Criteria |
| 13 | Warning UI | In-Video Warning Overlay | Renders clean warning banner on video player when misinformation claim is active | Active misinformation Claim | DOM warning overlay card | Only displays for 'misinformation' verdict | ORIGINAL_REQUEST R3 |
| 14 | Warning UI | Overlay Auto-Dismissal | Automatically hides the warning banner once playback advances beyond the tolerance window | currentTime advancing | Overlay hidden / unmounted | Immediate dismissal | ORIGINAL_REQUEST R3 |
| 15 | Warning UI | Manual Overlay Dismiss | Allows viewer to close warning banner via 'X' button; stays hidden for that sentence instance | User click event | Overlay dismissed for current claim ID | Re-arms if user re-seeks into claim | Implicit R3 |
| 16 | Warning UI | Fullscreen Compatibility | Ensures warning overlay remains visible when player enters native fullscreen mode | FullscreenChangeEvent | Overlay rendered inside player container | Maintains layout in fullscreen | Implicit R3 |
| 17 | Drawer UI | Collapsible Side Drawer Panel | YouTube-styled sidebar panel embedded beside player or comments | Collapsed state, Claim[] | Rendered collapsible drawer DOM | Adapts to YouTube layout changes | ORIGINAL_REQUEST R3 |
| 18 | Drawer UI | Chronological Claim Cards | Displays list of all analyzed sentences sorted in ascending order of timestamp | Claim[] | Rendered list of sentence cards | Displays empty state if no claims | ORIGINAL_REQUEST R3 |
| 19 | Drawer UI | Color-Coded Verdict Badges | Applies distinct styling: red/amber (misinformation), green (verified), gray (unknown) | Claim verdict | Styled badge CSS class | Falls back to neutral gray | ORIGINAL_REQUEST R3 |
| 20 | Drawer UI | Click-to-Seek Video Control | Jumps video playback directly to claim.timestamp when card or timestamp badge is clicked | Click event on claim card | video.currentTime = claim.timestamp | Clamps to video duration | ORIGINAL_REQUEST R3 & Acceptance Criteria |
| 21 | Drawer UI | Active Sentence Highlighting | Highlights the drawer sentence card corresponding to the currently playing sentence | Active claim timestamp | Visual highlight class on card | Auto-scrolls card into view if drawer open | Implicit R3 |
| 22 | Drawer UI | In-Drawer Verdict Filtering | Filter chips in drawer to show All, Only Misinformation, or Only Verified | User filter selection | Filtered card view in drawer | Shows 'No claims match filter' if none match | Implicit R3 |
| 23 | Extension Popup | Popup Main View | Extension toolbar popup displaying stats and quick settings | Active tab status | Rendered popup HTML/CSS | Shows 'Not on YouTube' on non-YouTube tabs | ORIGINAL_REQUEST R3 |
| 24 | Extension Popup | Video Claim Statistics | Displays aggregate counts: total claims, misinformation, verified, unknown | Current video Claim[] | Rendered stats grid with counts | Shows 0 / dashes when video not loaded | ORIGINAL_REQUEST R3 |
| 25 | Extension Popup | Global Extension Toggle | Switch to globally enable or disable the extension UI (overlay and drawer) | Toggle input change | Updates storage & broadcasts message | Hides all UI when toggled OFF | ORIGINAL_REQUEST R3 |
| 26 | Extension Popup | Warning & Filter Preferences | Checkboxes to toggle overlay banners and default verdict filters | Checkbox change | Saves to chrome.storage.local | Restores default preferences if missing | ORIGINAL_REQUEST R3 |
| 27 | Storage Sync | Settings Persistence & Sync | Manages chrome.storage.local for preferences with broadcast to content scripts | Settings object | Saved settings, change events | Fallback to in-memory store in tests | Implicit R3 & Acceptance Criteria |
| 28 | Security | XSS Protection & Escaping | Sanitizes sentence text, explanations, and source URLs to prevent script injection | Claim data strings | Text content nodes / sanitized URLs | Never uses raw unescaped innerHTML | Security Requirement |
| 29 | Verification | Automated Unit Test Suite | Tests URL parser, fallback determinism, schema validation, and time synchronizer | Test runner (node:test) | Test report & exit code 0 | Fails on regression or mismatch | Acceptance Criteria |
| 30 | Verification | Automated Browser/DOM Tests | Puppeteer browser tests verifying overlay injection, click-to-seek, and drawer toggle | Headless Chrome browser | E2E test report & assertions | Fails on DOM error or console exception | Acceptance Criteria |
```

---

## 4. Edge Cases & Boundary Analysis

```
## Edge Cases
| # | Feature | Input / Scenario | Observed / Expected Behavior |
|---|---------|------------------|------------------------------|
| 1 | Video ID Extraction | URL with multiple query params: https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&t=30s | Correctly extracts 'dQw4w9WgXcQ', ignoring prefix and suffix query parameters |
| 2 | Video ID Extraction | Short URL: https://youtu.be/dQw4w9WgXcQ?t=15 | Correctly extracts 'dQw4w9WgXcQ' from pathname |
| 3 | Video ID Extraction | Non-watch YouTube URLs: https://www.youtube.com/, /results?search_query=..., /feed/subscriptions | Returns null; does not activate content scripts or throw errors |
| 4 | Video ID Extraction | Non-YouTube URL: https://example.com/watch?v=12345 | Returns null |
| 5 | Video ID Extraction | Malformed URL: https://www.youtube.com/watch?v= | Returns null |
| 6 | SPA Navigation | User navigates from Video A directly to Video B via YouTube recommended video | Content script detects yt-navigate-finish, discards Video A's data, clears old overlay, loads Video B claims |
| 7 | SPA Navigation | User clicks Back/Forward browser buttons between watch pages | Content script catches popstate, updates active video ID without page refresh |
| 8 | SPA Navigation | User navigates from /watch to YouTube homepage | Overlay removed, drawer unmounted, time monitor paused |
| 9 | Video Element Resolver | Video element not present in DOM at exact time of yt-navigate-finish event | Retries via MutationObserver or requestAnimationFrame polling until <video> element exists |
| 10 | Deterministic Fallback | Arbitrary video ID 'arbitrary-xyz-999' queried 100 times | Yields 100% identical array of claims with exact same timestamps, verdicts, and sentences |
| 11 | Deterministic Fallback | Two distinct arbitrary IDs 'video-alpha' and 'video-beta' | Produces different, unique claim sets tailored to their respective hash seeds |
| 12 | Deterministic Fallback | Video ID with special characters: 'abc_123-XYZ' | Generates valid claims without regex errors or NaN timestamps |
| 13 | Playback Sync | Exact start boundary: currentTime === claim.timestamp (e.g. 42.0) | Evaluates to TRUE; active claim detected |
| 14 | Playback Sync | Epsilon before boundary: currentTime === claim.timestamp - 0.001 | Evaluates to FALSE; no active claim |
| 15 | Playback Sync | Epsilon before end boundary: currentTime === claim.timestamp + 5.0 - 0.001 | Evaluates to TRUE; active claim detected |
| 16 | Playback Sync | Exact end boundary: currentTime === claim.timestamp + 5.0 | Evaluates to FALSE; active claim expires and hides |
| 17 | Playback Sync | Rapid scrubbing / jumping across video | Synchronizer immediately detects new currentTime; does not leave ghost overlay from previous timestamp |
| 18 | Playback Sync | Multiple claims adjacent/overlapping (e.g. at 10.0s and 12.0s) | Prioritizes misinformation claim for overlay; highlights current active claim in drawer |
| 19 | In-Video Warning | Verdict is 'verified' or 'unknown' at current timestamp | No warning overlay is displayed on video player; only highlighted in drawer |
| 20 | In-Video Warning | User clicks dismiss 'X' button on warning card | Overlay closes immediately; does not reappear for the remainder of that claim's active window |
| 21 | In-Video Warning | Video paused while warning card is visible | Card remains visible while paused; does not flicker or disappear prematurely |
| 22 | In-Video Warning | Player toggled into Fullscreen mode | Overlay remains visible and properly styled inside fullscreen player container |
| 23 | Click-to-Seek | User clicks claim at timestamp 185.5s in drawer | Video element currentTime is updated to 185.5s; playback continues |
| 24 | Drawer UI | YouTube comments or layout re-rendered dynamically | Drawer maintains its position or re-attaches safely without crashing page |
| 25 | Drawer UI | Extremely long sentence text (e.g. 500 characters) | Drawer card wraps text cleanly with CSS ellipsis or expandable view without overflow |
| 26 | Security / XSS | Claim sentence contains HTML: `<img src=x onerror=alert(1)>` | Escaped safely via textContent; no script execution |
| 27 | Security / XSS | Source URL contains `javascript:alert(1)` | Validated against http/https protocols; blocked if malicious |
| 28 | Popup & Storage | Extension toggled OFF in popup | Message broadcast to content script; removes overlay and hides drawer immediately |
| 29 | Popup & Storage | Storage unavailable or private browsing mode | Graceful fallback to memory state without extension crash |
| 30 | Network / Error | Mock service called with empty or invalid video ID | Returns empty claims array gracefully with error log; UI shows 'No claims available' |
```

---

## 5. Precise Numbered Feature Inventory (100% Coverage)

| # | Feature Name | Description | Source Requirement | Key Constraints | Acceptance Criteria |
|---|--------------|-------------|--------------------|-----------------|---------------------|
| **F01** | **Watch Page Route Filter** | Restricts extension content script execution exclusively to YouTube watch pages. | R1 | Must match `*://*.youtube.com/watch*` (and SPA navigation from YouTube root). | Returns false and halts UI injection on any page other than `/watch`. |
| **F02** | **URL Video ID Parser** | Robust parser that extracts the standard 11-character video ID from all YouTube URL formats. | R1, Acceptance Criteria | Handles `v=` parameter, `youtu.be/` short links, mobile URLs, and query parameters in any order. | Correctly parses all valid formats; returns `null` for non-watch or malformed URLs. Verified by unit tests. |
| **F03** | **SPA Navigation Monitor** | Intercepts YouTube client-side SPA navigations without requiring page reload. | R1 | Must listen to `yt-navigate-finish`, `popstate`, and DOM URL changes. | When navigating from video A to video B, detects new video ID within 100ms and triggers lifecycle re-mount. |
| **F04** | **Content Script Lifecycle Controller** | Manages mounting, updating, and unmounting of in-page components during navigations. | R1 | Must cleanly teardown timers, overlay elements, and drawer state on navigation. | No memory leaks, ghost banners, or duplicate event listeners across 20+ sequential SPA navigations. |
| **F05** | **Video Element Attachment Resolver** | Locates and binds to YouTube's `<video class="html5-main-video">` element, handling dynamic DOM mounting. | R1, R3 | Handles late-loading video elements via MutationObserver or retry polling. | Binds successfully within 500ms of video element availability; recovers if YouTube replaces the video node. |
| **F06** | **Claim Data Schema & Validation** | Formal data contract definition and validator for timestamped claim records. | R2 | Fields: `timestamp` (number), `sentence` (string), `verdict` (enum), `explanation` (string), `sources` (string[]). | Rejects or sanitizes records with missing/malformed fields; enforces valid types and protocols. |
| **F07** | **Verdict Enum System** | Canonical representation and categorization for claim verdicts. | R2, R3 | Strictly three valid values: `"misinformation"`, `"verified"`, `"unknown"`. | Categorizes claims accurately; invalid strings default safely to `"unknown"`. |
| **F08** | **Seeded Mock Dataset Repository** | In-memory repository of rich, realistic timestamped claims for known demo video IDs. | R2 | Must contain at least 2-3 realistic datasets with mixed verdicts, detailed explanations, and real fact-checking sources. | Querying known IDs (e.g. `dQw4w9WgXcQ`) returns exact pre-configured claim list with high fidelity. |
| **F09** | **Deterministic Fallback Claim Generator** | Algorithmic generator producing realistic, reproducible claims for any arbitrary video ID. | R2 | Must be 100% deterministic: `f(videoId)` always produces identical claims, distributed across the video timeline. | Every arbitrary video ID yields 3-6 valid claims; consecutive calls with identical ID yield identical outputs. |
| **F10** | **Asynchronous Claim Retrieval Service** | Public API service to fetch claims for a given video ID with local caching. | R2 | Signature: `getClaimsForVideo(videoId): Promise<Claim[]>`. Supports optional simulated delay. | Resolves with Claim array; catches errors and falls back to deterministic generator without throwing unhandled rejections. |
| **F11** | **Playback Time Synchronizer** | Core engine that synchronizes video `currentTime` with active claims in real time. | R3, Acceptance Criteria | Uses `timeupdate` and/or `requestAnimationFrame`; efficient lookup with $O(N)$ or binary search. | Accurately identifies active claim at `currentTime`; tested against exact timestamps and boundaries. |
| **F12** | **Configurable Tolerance Window** | Time window during which a claim is considered active (`[timestamp, timestamp + window]`). | R3, Acceptance Criteria | Default window of 5.0 seconds. Configurable in settings. | Claim remains active for exact duration; boundary tests verify exact entry and exit points. |
| **F13** | **Scrubbing & Seek Handler** | Detects video seeking and immediately recalibrates active claims and UI states. | R3 | Must react immediately to `seeking` / `seeked` events or discontinuous `currentTime` jumps. | Dismisses outdated overlays and renders relevant overlay immediately when seeking into a claim window. |
| **F14** | **In-Video Warning Overlay Banner** | Clean, non-intrusive floating alert card positioned over the YouTube player for misinformation. | R3 | Displayed ONLY when active claim has `verdict === "misinformation"`. Must not block native YouTube playback controls. | Injected into player DOM; renders alert title, sentence quote, explanation, and action buttons. |
| **F15** | **Overlay Auto-Hide Engine** | Automatically removes or fades out the warning overlay when playback exits the claim window. | R3 | Triggers when `currentTime >= timestamp + window`. | Banner smoothly disappears without layout shift or lingering artifacts. |
| **F16** | **Manual Overlay Dismissal** | Dismiss button ("X") enabling viewer to hide the active warning immediately. | R3 | Click on dismiss button hides banner for current claim instance until next seek/re-entry. | Banner hides on click; does not re-pop while playing continuously through the same claim window. |
| **F17** | **Player Fullscreen Support** | Ensures warning overlay renders correctly inside native YouTube fullscreen mode. | R3 | Mounts overlay inside `#movie_player` container so it remains inside the fullscreen DOM hierarchy. | Overlay remains visible, properly positioned, and accessible in fullscreen and standard modes. |
| **F18** | **Interactive Timeline Drawer Container** | Collapsible sidebar panel embedded beside player or comments section in YouTube-native style. | R3 | Uses YouTube dark/light theme tokens and fonts (`Roboto, Arial`); collapsible via header button. | Mounts into YouTube layout without breaking existing page components; collapses and expands smoothly. |
| **F19** | **Chronological Claim List** | Renders all video claims in ascending chronological order with timestamps. | R3 | Formats timestamps as `MM:SS`. Displays sentence excerpt and expandable explanation & sources. | All claims listed chronologically; empty state displayed if no claims exist for the video. |
| **F20** | **Color-Coded Verdict Badges** | Distinct visual badges for claim verdicts on each drawer card. | R3 | Red/amber for `misinformation`, green for `verified`, neutral gray for `unknown`. | Badges render with correct color codes and readable contrast; accessible text labels included. |
| **F21** | **Click-to-Seek Navigation** | Allows viewers to click any sentence card or timestamp in the drawer to jump playback. | R3, Acceptance Criteria | Sets `video.currentTime = claim.timestamp` and triggers playback. | Clicking card seeks video element directly to target timestamp. Verified by automated DOM tests. |
| **F22** | **Active Sentence Highlight** | Visually highlights the drawer card corresponding to the sentence currently being spoken. | R3 | Updates highlight class as video plays; scrolls active item into view if drawer is scrolled. | Correct card highlighted in sync with video playback; highlight clears when outside all claims. |
| **F23** | **Drawer Verdict Filter Bar** | Filter chips at the top of the drawer to filter items (All, Misinformation, Verified). | R3 | Dynamically filters visible list; preserves seek functionality for filtered cards. | Filtering updates visible card count; clicking filtered cards still seeks correctly. |
| **F24** | **Extension Popup View** | Extension toolbar popup UI providing summary data and control switches. | R3 | Built with accessible HTML/CSS; opens in Chrome action toolbar. | Loads and renders cleanly within 150ms without console errors or CSP violations. |
| **F25** | **Per-Video Claim Statistics** | Displays real-time breakdown of claims in active tab (Total, Misinformation, Verified, Unknown). | R3 | Queries active tab or background service worker for current video stats. | Displays accurate counts matching drawer claims; updates if video changes. |
| **F26** | **Global Extension Toggle Switch** | Master ON/OFF toggle in popup to enable or disable extension features. | R3 | Stored in `chrome.storage.local`. Broadcasts toggle state to active tabs. | When toggled OFF: warning overlay and drawer immediately hidden. When ON: UI restored. |
| **F27** | **Warning Overlay Toggle Preference** | User preference to enable/disable overlay banners independently of the drawer. | R3 | Stored in `chrome.storage.local`. | When disabled, no warning overlay appears during playback, while drawer continues functioning. |
| **F28** | **Cross-Context Storage Sync** | Synchronizes user settings between popup, background worker, and content scripts. | R3 | Uses `chrome.storage.local` with fallback to memory storage for test environments. | Settings saved in popup immediately reflect in active content scripts without page refresh. |
| **F29** | **Security & XSS Sanitization** | Comprehensive sanitization of sentences, explanations, and URLs to prevent injection. | Security / Reliability | All text rendered using `textContent` / `innerText`; URLs validated for safe protocols (`http:`, `https:`). | Malicious payload strings (e.g. `<script>`) rendered as inert plain text; zero script execution. |
| **F30** | **Automated Multi-Tier Test Suite** | Automated verification harness encompassing unit tests, DOM tests, and Puppeteer E2E tests. | Acceptance Criteria | Native Node.js test runner (`node:test`) and Puppeteer Chrome automation. | 100% tests passing across Tiers 1-4 with zero warnings or errors. |

---

## 6. Testing Specification: Multi-Tier Test Matrix

### Tier 1: Feature Coverage (Core Happy Paths)
*Objective: Verify every individual feature functions as specified under standard operating conditions.*

| Test ID | Feature | Test Description | Expected Result |
|---------|---------|------------------|-----------------|
| **T1.01** | F02 | Extract video ID from standard watch URL (`https://www.youtube.com/watch?v=dQw4w9WgXcQ`) | Returns `"dQw4w9WgXcQ"` |
| **T1.02** | F02 | Extract video ID from short URL (`https://youtu.be/dQw4w9WgXcQ`) | Returns `"dQw4w9WgXcQ"` |
| **T1.03** | F02 | Extract video ID from URL with extra parameters (`?v=dQw4w9WgXcQ&t=45s&list=xyz`) | Returns `"dQw4w9WgXcQ"` |
| **T1.04** | F06, F07 | Schema validation on valid claim record | Passes validation without errors; schema types intact |
| **T1.05** | F08 | Retrieve claims for known seeded video ID (`dQw4w9WgXcQ`) | Returns seeded array of realistic claims with mixed verdicts |
| **T1.06** | F09 | Retrieve claims for unknown arbitrary video ID | Triggers deterministic fallback; returns array of 3-6 valid claims |
| **T1.07** | F11, F12 | Playback sync identifies active claim when `currentTime === timestamp` | Returns matching claim record |
| **T1.08** | F11, F12 | Playback sync identifies active claim when `currentTime === timestamp + 2.5` | Returns matching claim record |
| **T1.09** | F11, F12 | Playback sync returns `null` when `currentTime` is outside claim windows | Returns `null` |
| **T1.10** | F14 | In-video warning overlay renders when `currentTime` hits misinformation claim | Warning banner DOM element inserted into player with warning text |
| **T1.11** | F15 | In-video warning overlay disappears when `currentTime` passes claim window | Warning banner element removed/hidden |
| **T1.12** | F18, F19 | Timeline drawer renders with all claims sorted by timestamp | Drawer DOM rendered containing cards in ascending timestamp order |
| **T1.13** | F20 | Color-coded badges rendered with appropriate classes (`misinformation`, `verified`, `unknown`) | Correct CSS classes and styling applied to respective badges |
| **T1.14** | F21 | Click-to-seek: click on claim card with timestamp `42.5` | Simulates click; asserts `video.currentTime` equals `42.5` |
| **T1.15** | F24, F25 | Popup UI renders summary stats for active video claims | Stats cards display total, misinformation, verified, unknown counts |
| **T1.16** | F26, F28 | Global toggle in popup persists to storage | `chrome.storage.local` contains `{ enabled: false }` |

---

### Tier 2: Boundaries, Edge Cases & Error Handling
*Objective: Probe boundary conditions, invalid inputs, edge cases, and defensive fallbacks.*

| Test ID | Feature | Test Description | Expected Result |
|---------|---------|------------------|-----------------|
| **T2.01** | F01, F02 | URL parser on YouTube homepage (`https://www.youtube.com/`) | Returns `null`; no error thrown |
| **T2.02** | F01, F02 | URL parser on non-YouTube URL (`https://vimeo.com/12345`) | Returns `null`; no error thrown |
| **T2.03** | F01, F02 | URL parser on empty string or null input | Returns `null`; handles gracefully without crashing |
| **T2.04** | F09 | Determinism check: call fallback generator with ID `"test-video-123"` 100 times | 100% of generated results are strictly deep-equal |
| **T2.05** | F09 | Diversity check: call fallback with two distinct IDs (`"video-a"` vs `"video-b"`) | Generates distinct datasets with different timestamps/sentences |
| **T2.06** | F11, F12 | Boundary precision: `currentTime = timestamp - 0.001` | Returns `null` (not yet active) |
| **T2.07** | F11, F12 | Boundary precision: `currentTime = timestamp + window - 0.001` | Returns active claim |
| **T2.08** | F11, F12 | Boundary precision: `currentTime = timestamp + window + 0.001` | Returns `null` (expired) |
| **T2.09** | F11 | Empty claim list provided to synchronizer | Returns `null`; zero exceptions |
| **T2.10** | F11 | Negative `currentTime` or `NaN` provided to synchronizer | Returns `null`; handles invalid number safely |
| **T2.11** | F13 | Rapid seeking stress: jump `currentTime` across 10 different timestamps in 50ms | Synchronizer reflects final timestamp; no stale or duplicate overlays |
| **T2.12** | F14, F19 | Long text overflow: sentence with 1000 characters | Text rendered with proper wrapping; does not break layout or viewport |
| **T2.13** | F29 | XSS Injection probe: sentence containing `<img src=x onerror=alert(1)>` | Injected as plain text via `textContent`; zero script execution |
| **T2.14** | F29 | Malicious source URL: `javascript:alert(document.cookie)` | Disallowed/sanitized; link href omitted or set to `#` |
| **T2.15** | F05 | Video element delayed: `<video>` inserted into DOM 200ms after navigation | MutationObserver detects and binds to element successfully |
| **T2.16** | F28 | Storage failure: `chrome.storage.local` throws or is undefined | Falls back to in-memory preferences without crashing extension |

---

### Tier 3: Cross-Feature Interactions
*Objective: Verify coordinated behavior between multiple interconnected modules under dynamic conditions.*

| Test ID | Features Involved | Test Description | Expected Result |
|---------|-------------------|------------------|-----------------|
| **T3.01** | F14, F26, F28 | Global toggle turned OFF while warning overlay is currently active | Warning overlay immediately unmounts; drawer hidden without reload |
| **T3.02** | F14, F26, F28 | Global toggle turned ON while playback is on a misinformation claim | Warning overlay re-appears immediately; drawer re-appears |
| **T3.03** | F14, F16 | User clicks dismiss 'X' on active overlay; video continues playing | Overlay closes; does not re-open during remainder of current claim window |
| **T3.04** | F14, F16, F13 | User dismisses overlay, then seeks backward into the same claim | Overlay re-appears (new seek event re-arms the detection) |
| **T3.05** | F14, F17 | Player enters Fullscreen mode while overlay is active | Overlay remains visible inside `#movie_player` fullscreen container |
| **T3.06** | F03, F04, F10 | SPA navigation from Video A to Video B while overlay A is active | Overlay A removed; claims for Video B fetched; drawer rebuilt with B's claims |
| **T3.07** | F19, F22, F21 | Drawer card highlighted while playing; user clicks another card at 120s | Video seeks to 120s; active card highlight moves to the 120s card |
| **T3.08** | F23, F21 | Drawer filtered to "Misinformation Only"; user clicks first card | Only misinformation cards shown; click seeks video accurately to that timestamp |
| **T3.09** | F14, F11 | Playback hits `verified` claim at 20s, then `misinformation` claim at 40s | No overlay shown at 20s; overlay banner shown at 40s |
| **T3.10** | F24, F25, F03 | Popup opened after SPA navigation | Popup displays stats for the newly navigated video ID |

---

### Tier 4: Real-World Scenarios (End-to-End Simulation)
*Objective: Full end-to-end user workflows executed via Puppeteer in real Google Chrome.*

| Test ID | Scenario | Steps & Actions | Verification Checkpoints |
|---------|----------|-----------------|--------------------------|
| **T4.01** | **Direct Watch Page Landing** | 1. User loads `https://www.youtube.com/watch?v=dQw4w9WgXcQ`.<br>2. Extension content script initializes.<br>3. Video element loaded. | - Video ID extracted as `dQw4w9WgXcQ`.<br>- Drawer injected into page.<br>- Claims rendered in drawer with badges.<br>- No console errors. |
| **T4.02** | **Continuous Playback & Warning Flow** | 1. Video begins playing from `t=0`.<br>2. Reaches `t=15` (verified claim).<br>3. Reaches `t=42` (misinformation claim).<br>4. Reaches `t=48` (past tolerance window). | - At `t=15`: Verified card highlighted in drawer; NO overlay on player.<br>- At `t=42`: Misinformation overlay appears on player.<br>- At `t=48`: Overlay automatically dismissed.<br>- Seamless playback throughout. |
| **T4.03** | **Interactive Timeline Exploration** | 1. Viewer scrolls drawer.<br>2. Viewer clicks sentence card at `01:30`.<br>3. Video seeks to 90 seconds.<br>4. Active card highlight updates. | - `video.currentTime` becomes `90`.<br>- Drawer scrolls active card into view.<br>- Corresponding claim badge highlighted. |
| **T4.04** | **Client-Side SPA Navigation** | 1. Viewer watches Video A (`dQw4w9WgXcQ`).<br>2. Viewer clicks a related video (navigates to `jNQXAC9IVRw` via SPA).<br>3. `yt-navigate-finish` fires. | - Video A drawer & overlay cleanly unmounted.<br>- Video ID `jNQXAC9IVRw` detected.<br>- New claims fetched and populated in drawer.<br>- Zero page reload occurred. |
| **T4.05** | **Popup Management & Real-Time Sync** | 1. User clicks extension action icon to open popup.<br>2. Views claims statistics (misinformation, verified, total).<br>3. Toggles extension OFF.<br>4. Switches back to YouTube tab. | - Popup reflects accurate video claim counts.<br>- YouTube tab immediately hides drawer and overlays.<br>- Turning toggle ON restores UI immediately. |
| **T4.06** | **Arbitrary Video Fallback Experience** | 1. User loads uncatalogued video ID `unknown-xyz-777`.<br>2. Fallback service generates deterministic claims.<br>3. Playback progresses. | - Drawer displays deterministic claims with realistic text and sources.<br>- Overlays and click-to-seek function identically to seeded videos. |

---

## 7. Caveats & Assumptions

1. **YouTube DOM Dynamics**:
   - YouTube frequently updates internal class names and Web Component structures (e.g. `ytd-watch-flexy`, `#movie_player`, `#secondary`, `#below`). The implementation should prioritize resilient selectors with fallbacks (e.g., query `#secondary` then fallback to `#related` or `#below`).
   - The `<video>` element should be queried as `document.querySelector('video.html5-main-video')` or `document.querySelector('video')`.
2. **SPA Navigation Hooking**:
   - YouTube dispatches `yt-navigate-finish` on `window` or `document`. In some browser configurations, `yt-page-data-updated` or History API monkey-patching / URL polling may be needed as a backup to guarantee 100% detection rate.
3. **Manifest Permissions**:
   - `manifest.json` requires:
     - `permissions`: `["storage", "activeTab"]`
     - `host_permissions`: `["*://*.youtube.com/*"]`
     - Content script matching: `*://*.youtube.com/*` (filtering inside script for `/watch` to handle SPA transitions from YouTube homepage).
4. **Tolerance Window Sizing**:
   - We specify a default of 5.0 seconds for the claim active window. In reality, sentences take 3–8 seconds to speak. A 5-second window provides viewers sufficient time to read the warning without visual annoyance.
5. **Mock Data Quality**:
   - While mock/fallback data is used for this release, sentences and explanations should resemble realistic journalism/fact-checking language rather than generic "lorem ipsum" to satisfy "rich, realistic timestamped claims".

---

## 8. Conclusion

This specification mining analysis establishes the complete feature and test architecture for the YouTube Misinformation Detector Chrome Extension:
- **30 Numbered Features** spanning Navigation (F01–F05), Data & Fallback (F06–F10), Playback Sync (F11–F13), In-Video Warning UI (F14–F17), Interactive Drawer UI (F18–F23), Extension Popup & Settings (F24–F28), and Security & Verification (F29–F30), ensuring **100% requirements coverage**.
- **30 Edge Cases** rigorously mapped to observed and defensive behaviors.
- **28 Specific Test Cases** structured across Tiers 1–4, establishing clear acceptance criteria for both implementation agents and test engineers.
- Clean architectural transition from the legacy "PagePulse" code to the dedicated YouTube extension while leveraging the existing Node native test runner and Puppeteer setup.

---

## 9. Verification Method

To verify the mined requirements and validate implementations against this specification:

### 1. Syntax & Lint Checks
```bash
node --check src/content.js
node --check src/background.js
node --check popup/popup.js
```

### 2. Unit Test Verification (Tiers 1 & 2)
```bash
npm test
```
*Expected output: All unit tests for URL parsing, claim schema validation, deterministic fallback generation, and playback synchronization pass with 0 failures.*

### 3. Automated Browser E2E Verification (Tiers 3 & 4)
```bash
npm run test:e2e
# or
npm run test:all
```
*Expected output: Puppeteer launches Google Chrome with the extension loaded, navigates simulated/real YouTube watch DOM, verifies overlay injection, click-to-seek, drawer filtering, and popup settings synchronization with 0 uncaught errors.*
