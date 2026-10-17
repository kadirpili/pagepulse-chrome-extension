# Milestone 1 Architecture & Code Implementation Blueprint: Core Data & Playback Engine

**Agent**: Milestone 1 Explorer 1 (`explorer_m1_1`)  
**Role**: Core Data & Architecture Explorer  
**Working Directory**: `/Users/kadirpili/Documents/chrome-extension/.agents/teamwork/explorer_m1_1/`  
**Target Path**: `/Users/kadirpili/Documents/chrome-extension/.agents/teamwork/explorer_m1_1/handoff.md`  
**Date**: 2026-10-17T06:08:00Z  

---

## 1. Observation

### 1.1 Verbatim Requirements from `ORIGINAL_REQUEST.md`
- **R1: YouTube In-Page Integration & SPA Navigation Handling** (lines 12–14):
  > "The extension runs exclusively on YouTube watch pages (`*://*.youtube.com/watch*`). Detects video ID updates across both initial page loads and client-side YouTube Single-Page-App (SPA) navigations (`yt-navigate-finish`, URL popstate, or DOM mutation observers) without requiring manual page reloads."
- **R2: Video Claim & Sentence Data Retrieval** (lines 16–29):
  > "Given an active YouTube video ID, retrieve analysis records structured as:
  > `[{ "timestamp": 42.5, "sentence": "Sample excerpt from video speech or transcript", "verdict": "misinformation" | "verified" | "unknown", "explanation": "Context explaining why this statement is flagged or confirmed", "sources": ["https://factcheck.org/..."] }]`
  > For the initial release, implement a mock data service that provides rich, realistic timestamped claims for YouTube video IDs with fallback default demo datasets for any arbitrary video ID."
- **R3: In-Video Warnings & Interactive Timeline Drawer UI** (lines 31–36):
  > "When the current playback time (`currentTime`) aligns with a sentence flagged as `misinformation`, display a clean, non-intrusive warning card/banner on or directly adjacent to the YouTube video player."
  > "Clicking any sentence jumps the YouTube player to that specific timestamp."
- **Acceptance Criteria** (lines 40–50):
  > "Comprehensive unit test suite covering: Video ID extraction from standard and short YouTube URLs; Sentence retrieval, parsing, and fallback matching for arbitrary video IDs; Playback time synchronization logic (detecting active claim at given `currentTime` with tolerance windows)."

### 1.2 Architectural Contracts from `PROJECT.md`
From `PROJECT.md` lines 86–113:
- **`src/youtube-url.js`**:
  - `parseYouTubeVideoId(urlOrStr: string): string | null`
    - Validates and returns 11-char string matching `^[a-zA-Z0-9_-]{11}$` or `null`.
  - `isYouTubeWatchUrl(urlOrStr: string): boolean`
    - Returns `true` if URL represents a watch page with a valid video ID.
  - `formatTimestamp(seconds: number): string`
    - Formats seconds as `MM:SS` (or `HH:MM:SS` if $\ge 3600$).
- **`src/claim-service.js`**:
  - `type Verdict = "misinformation" | "verified" | "unknown"`
  - `interface Claim { timestamp: number; sentence: string; verdict: Verdict; explanation: string; sources: string[]; duration?: number; }`
  - `validateClaim(raw: unknown): Claim`
  - `generateDeterministicClaims(videoId: string): Claim[]`
  - `getClaimsForVideo(videoId: string): Promise<Claim[]>`
- **`src/video-tracker.js`**:
  - `findActiveClaim(claims: Claim[], currentTime: number, leadTolerance?: number, defaultDuration?: number): Claim | null`
    - Returns active claim if $t - \text{leadTolerance} \le \text{currentTime} < t + \text{duration}$.
  - `seekToTimestamp(videoElement: HTMLVideoElement, targetSeconds: number, autoPlay?: boolean): boolean`
  - `isAdActive(): boolean`

### 1.3 Prior Survey Findings
- **`explorer_survey_1`**: The repository is an active Node.js 25 environment with native test runner (`node --test`), Puppeteer 25.14.0, ES modules (`"type": "module"`), and pre-existing icon assets (`icons/icon16.png`, `48`, `128`).
- **`explorer_survey_2`**: YouTube SPA navigation triggers `yt-navigate-finish` on `document`/`window` while reusing `<video class="html5-main-video">`. Matching `*://*.youtube.com/*` in `manifest.json` is mandatory so initial entry via `https://www.youtube.com/` will have the content script ready to intercept transitions to `/watch`.
- **`spec_miner_survey_3`**: Cataloged 30 features (F01–F30) and 30 edge cases, including deterministic Mulberry32 PRNG requirements, duration bounding, overlapping claim priority for misinformation, and ad playback suppression.

---

## 2. Logic Chain

1. **Manifest V3 Specification**:
   - *Observation*: Chrome extensions require MV3. Content scripts declared with `matches: ["*://*.youtube.com/*"]` must execute at `document_idle`.
   - *Deduction*: In MV3, background service worker runs as `"type": "module"`. In addition, declaring `web_accessible_resources` for `src/*.js` allows content script or in-page components to dynamically import pure ES module files.
   - *Deduction*: Host permissions must include `*://*.youtube.com/*`, and permissions must include `"storage"` and `"activeTab"`.

2. **YouTube Video ID Parsing Logic (`src/youtube-url.js`)**:
   - *Observation*: YouTube URLs appear as desktop watch (`/watch?v=ID`), short URLs (`youtu.be/ID`), embedded (`/embed/ID`), shorts (`/shorts/ID`), live streams (`/live/ID`), and parameterized URLs where `v` is preceded by `feature=shared`, `list=...`, etc.
   - *Deduction*: A simple regex split on `?v=` fails on non-leading `v` params. Using `new URL(str, 'https://www.youtube.com')` allows robust querying of `url.searchParams.get('v')`, with path extraction for `youtu.be` and `/shorts/`.
   - *Deduction*: A bare 11-char string matching `^[a-zA-Z0-9_-]{11}$` should directly return the ID. Non-YouTube hostnames (e.g. `vimeo.com`, `example.com`) must return `null`.
   - *Deduction*: `isYouTubeWatchUrl(urlOrStr)` must verify that the URL is on a YouTube domain, has a path indicating watch playback (`/watch`, `/watch_popup`, or `youtu.be`), and has a valid 11-char video ID.
   - *Deduction*: `formatTimestamp(seconds)` must gracefully handle floating-point numbers, zero, negative/NaN, formatting as `MM:SS` (e.g. `42.5` $\to$ `"00:42"`) and `HH:MM:SS` (e.g. `3665` $\to$ `"01:01:05"`).

3. **Claim Service Architecture (`src/claim-service.js`)**:
   - *Observation*: Requirement R2 specifies exact schema: `timestamp`, `sentence`, `verdict`, `explanation`, `sources`.
   - *Deduction*: `validateClaim(raw)` must enforce:
     - `raw` is a valid non-null object.
     - `timestamp`: finite number $\ge 0$.
     - `sentence`: non-empty string.
     - `verdict`: strictly one of `'misinformation'`, `'verified'`, `'unknown'`.
     - `explanation`: string.
     - `sources`: array of strings.
     - `duration`: positive number, defaulting to `4.5` if omitted.
   - *Deduction*: For demo IDs (`dQw4w9WgXcQ`, `jNQXAC9IVRw`, `demo-misinfo-1`, `M7lc1UVf-VE`), the service must return curated, realistic claims with mixed verdicts and verifiable sources.
   - *Deduction*: For arbitrary IDs, the fallback generator must be 100% deterministic (calling 100 times yields identical objects) and diverse (distinct IDs yield distinct sets). A 32-bit FNV-1a string hash paired with Mulberry32 PRNG satisfies these mathematical constraints with zero runtime dependencies.
   - *Deduction*: `getClaimsForVideo(videoId, options)` must be an async function returning a Promise. It should check an in-memory cache, return clones to prevent mutation, and handle missing/invalid video IDs safely by resolving to `[]`.

4. **Playback Synchronization Engine (`src/video-tracker.js`)**:
   - *Observation*: Video time ticks at ~250ms intervals. Spoken sentences span a duration (e.g. 3.0 to 5.0 seconds).
   - *Deduction*: `findActiveClaim(claims, currentTime, leadTolerance = 0.25, defaultDuration = 4.5)`:
     - Must return `null` if `currentTime < 0`, `NaN`, or outside all claim windows.
     - Window formula: $\text{startTime} \le \text{currentTime} < \text{endTime}$, where $\text{startTime} = \max(0, \text{claim.timestamp} - \text{leadTolerance})$ and $\text{endTime} = \text{claim.timestamp} + (\text{claim.duration} \parallel \text{defaultDuration})$.
     - Overlapping claims: If multiple claims are active simultaneously, prioritize `misinformation` to guarantee critical safety alerts are displayed.
   - *Deduction*: `seekToTimestamp(videoElement, targetSeconds, autoPlay = true)`:
     - Clamps target between `0` and `videoElement.duration || Infinity`.
     - Sets `videoElement.currentTime = clamped`.
     - If `autoPlay` and `videoElement.paused`, invokes `videoElement.play().catch(() => {})`.
     - Returns boolean success indicator.
   - *Deduction*: `isAdActive()`:
     - Checks `#movie_player.ad-showing`, `#movie_player.ad-interrupting`, `.ytp-ad-player-overlay`, and `.ytp-ad-text`.
     - Returns `true` if an ad is actively playing, allowing content scripts to suppress misinformation overlays during ads.

---

## 3. Caveats

1. **Pure ES Module Architecture**:
   - All modules are designed as native ES Modules (`export function ...`).
   - In Node.js test runs (`node --test`), this works seamlessly due to `"type": "module"` in `package.json`.
   - In Chrome Extension MV3, `src/background.js` is declared as `"type": "module"` in `manifest.json`. For content scripts, `manifest.json` specifies `src/content.js`. In Chrome, content scripts can dynamically import ES modules via `await import(chrome.runtime.getURL('src/youtube-url.js'))` because `web_accessible_resources` exposes `src/*.js`.
2. **YouTube Player Internal Class Stability**:
   - Class names like `.ad-showing` and `#movie_player` have been stable in YouTube for over 6 years. However, `isAdActive()` includes defensive fallbacks checking multiple selectors.
3. **Floating Point Rounding in Playback Time**:
   - `currentTime` is a high-precision double (e.g. `42.50312`). Strict `<` and `>=` comparisons against floating bounds avoid double-firing or gaps between adjacent claims.

---

## 4. Conclusion & Precise Code Implementation Blueprints

Below are the complete, production-ready code blueprints for the implementer agent.

### 4.1 Blueprint: `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "YouTube Misinformation Detector",
  "version": "1.0.0",
  "description": "Real-time misinformation warnings, claim tracking, and interactive timeline drawer for YouTube videos.",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "*://*.youtube.com/*"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "YouTube Misinformation Detector",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.youtube.com/*"
      ],
      "js": [
        "src/content.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "src/*.js",
        "src/*.css",
        "icons/*.png"
      ],
      "matches": [
        "*://*.youtube.com/*"
      ]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

### 4.2 Blueprint: `src/youtube-url.js`

```javascript
/**
 * YouTube URL Parser and Time Formatter Module.
 * Provides resilient video ID extraction, watch page verification, and timestamp formatting.
 */

const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const KNOWN_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
  'youtu.be',
  'www.youtu.be'
]);

/**
 * Extracts an 11-character YouTube video ID from a URL, path, or string.
 *
 * @param {string} urlOrStr - The input URL, query string, or video ID.
 * @returns {string|null} The 11-character video ID, or null if invalid/not found.
 */
export function parseYouTubeVideoId(urlOrStr) {
  if (!urlOrStr || typeof urlOrStr !== 'string') {
    return null;
  }

  const trimmed = urlOrStr.trim();
  if (!trimmed) {
    return null;
  }

  // Case 1: The input is already a bare 11-character video ID
  if (YOUTUBE_VIDEO_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    // Parse using URL API; if relative, use youtube.com as base
    const parsed = new URL(trimmed, 'https://www.youtube.com');
    const hostname = parsed.hostname.toLowerCase();

    // Verify hostname is YouTube or localhost/test domain
    const isYouTubeDomain =
      KNOWN_YOUTUBE_HOSTS.has(hostname) ||
      hostname.endsWith('.youtube.com') ||
      hostname.endsWith('.youtu.be');

    // Case 2: Shortened youtu.be URL (e.g. https://youtu.be/dQw4w9WgXcQ?t=10)
    if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
      const candidate = parsed.pathname.slice(1).split('/')[0];
      if (YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
        return candidate;
      }
      return null;
    }

    if (!isYouTubeDomain) {
      return null;
    }

    // Case 3: Standard watch URL (e.g. /watch?v=dQw4w9WgXcQ or /watch_popup?v=...)
    if (parsed.pathname === '/watch' || parsed.pathname === '/watch_popup') {
      const v = parsed.searchParams.get('v');
      if (v && YOUTUBE_VIDEO_ID_REGEX.test(v)) {
        return v;
      }
      return null;
    }

    // Case 4: Path-based endpoints: /embed/ID, /shorts/ID, /live/ID, /v/ID
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const prefix = segments[0].toLowerCase();
      if (['embed', 'shorts', 'live', 'v'].includes(prefix)) {
        const candidate = segments[1];
        if (YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // Fall through to regex search
  }

  // Case 5: Regex fallback for partial/malformed inputs matching standard YouTube patterns
  const match = trimmed.match(
    /(?:v=|\/embed\/|\/shorts\/|\/live\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&#/]|$)/
  );
  if (match && YOUTUBE_VIDEO_ID_REGEX.test(match[1])) {
    return match[1];
  }

  return null;
}

/**
 * Determines whether a URL or string represents a YouTube watch page with a valid video ID.
 *
 * @param {string} urlOrStr - The URL or string to test.
 * @returns {boolean} True if the input is a valid YouTube watch page.
 */
export function isYouTubeWatchUrl(urlOrStr) {
  if (!urlOrStr || typeof urlOrStr !== 'string') {
    return false;
  }

  const trimmed = urlOrStr.trim();
  const videoId = parseYouTubeVideoId(trimmed);
  if (!videoId) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, 'https://www.youtube.com');
    const hostname = parsed.hostname.toLowerCase();
    const isYouTubeDomain =
      KNOWN_YOUTUBE_HOSTS.has(hostname) ||
      hostname.endsWith('.youtube.com') ||
      hostname.endsWith('.youtu.be');

    if (!isYouTubeDomain) {
      return false;
    }

    // Check watch page pathname or short url
    return (
      parsed.pathname === '/watch' ||
      parsed.pathname === '/watch_popup' ||
      hostname === 'youtu.be' ||
      parsed.pathname.startsWith('/shorts/')
    );
  } catch {
    return false;
  }
}

/**
 * Formats a playback time in seconds into MM:SS (or HH:MM:SS if >= 3600 seconds).
 *
 * @param {number} seconds - Number of seconds.
 * @returns {string} Formatted timestamp string.
 */
export function formatTimestamp(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}
```

---

### 4.3 Blueprint: `src/claim-service.js`

```javascript
/**
 * Claim Data Service.
 * Manages claim schema validation, seeded realistic test datasets,
 * deterministic pseudo-random fallback generation for arbitrary IDs, and cached claim retrieval.
 */

/**
 * Validates a raw claim object against the required schema.
 * Throws a descriptive Error if the object fails validation.
 *
 * @param {unknown} raw - The raw claim candidate object.
 * @returns {Object} The validated and normalized Claim object.
 */
export function validateClaim(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Claim must be a non-null object');
  }

  // 1. Timestamp validation
  if (typeof raw.timestamp !== 'number' || isNaN(raw.timestamp) || raw.timestamp < 0) {
    throw new Error('Claim timestamp must be a non-negative number');
  }

  // 2. Sentence validation
  if (typeof raw.sentence !== 'string' || raw.sentence.trim().length === 0) {
    throw new Error('Claim sentence must be a non-empty string');
  }

  // 3. Verdict validation
  const validVerdicts = ['misinformation', 'verified', 'unknown'];
  if (!raw.verdict || !validVerdicts.includes(raw.verdict)) {
    throw new Error(`Claim verdict must be one of: ${validVerdicts.join(', ')}`);
  }

  // 4. Explanation validation
  if (typeof raw.explanation !== 'string') {
    throw new Error('Claim explanation must be a string');
  }

  // 5. Sources validation
  if (!Array.isArray(raw.sources)) {
    throw new Error('Claim sources must be an array of strings');
  }
  for (const src of raw.sources) {
    if (typeof src !== 'string') {
      throw new Error('Each source in claim sources must be a string URL');
    }
  }

  // 6. Optional duration validation
  let duration = 4.5;
  if (typeof raw.duration === 'number' && !isNaN(raw.duration) && raw.duration > 0) {
    duration = raw.duration;
  }

  return {
    timestamp: Number(raw.timestamp),
    sentence: String(raw.sentence).trim(),
    verdict: raw.verdict,
    explanation: String(raw.explanation).trim(),
    sources: raw.sources.map((s) => String(s).trim()).filter(Boolean),
    duration: duration
  };
}

/**
 * Seeded mock datasets for prominent demonstration and test video IDs.
 */
export const SEEDED_CLAIMS = {
  // Rick Astley - Never Gonna Give You Up (Standard Demo ID)
  dQw4w9WgXcQ: [
    {
      timestamp: 12.0,
      sentence: 'This song was completely improvised in a single take without prior rehearsal.',
      verdict: 'misinformation',
      explanation:
        'The track was meticulously written, arranged, and produced by Stock Aitken Waterman over several weeks at PWL Studios in London.',
      sources: [
        'https://www.factcheck.org/2021/music-history-pwl',
        'https://en.wikipedia.org/wiki/Never_Gonna_Give_You_Up'
      ],
      duration: 4.5
    },
    {
      timestamp: 42.5,
      sentence: 'Never Gonna Give You Up reached number one in 25 countries upon its release in 1987.',
      verdict: 'verified',
      explanation:
        'Official international music record charts confirm the single topped charts in 25 countries worldwide including the UK, US, and Australia.',
      sources: ['https://www.billboard.com/charts/hot-100/1988-03-12'],
      duration: 5.0
    },
    {
      timestamp: 88.0,
      sentence: 'The music video was shot on a multi-million dollar film soundstage in Hollywood.',
      verdict: 'misinformation',
      explanation:
        'The video was directed by Simon West on a shoestring budget of under £3,000 near London Battersea District.',
      sources: ['https://apnews.com/article/fact-check-astley-video-production'],
      duration: 4.5
    },
    {
      timestamp: 135.0,
      sentence: 'Rick Astley originally declined to record the vocal track until persuaded by Pete Waterman.',
      verdict: 'unknown',
      explanation:
        'Historical accounts from studio engineers and producers differ on whether Astley was initially hesitant or eager to record.',
      sources: ['https://www.reuters.com/fact-check/pwl-studios-retrospective'],
      duration: 4.0
    }
  ],

  // Me at the zoo (First YouTube Video)
  jNQXAC9IVRw: [
    {
      timestamp: 3.0,
      sentence: 'Elephants have the longest trunks of any terrestrial mammal on Earth.',
      verdict: 'verified',
      explanation:
        'Biological taxonomies confirm that proboscideans possess the largest and longest muscular proboscis among all land mammals.',
      sources: ['https://nationalzoo.si.edu/animals/asian-elephant'],
      duration: 4.0
    },
    {
      timestamp: 9.5,
      sentence: 'The San Diego Zoo currently houses over two million individual elephants.',
      verdict: 'misinformation',
      explanation:
        'The total worldwide population of wild and captive elephants is under 500,000. The San Diego Zoo hosts a small herd of fewer than a dozen.',
      sources: ['https://sandiegozoowildlifealliance.org/animals/elephant'],
      duration: 4.5
    },
    {
      timestamp: 15.0,
      sentence: 'Elephants communicate over long distances using low-frequency infrasound.',
      verdict: 'verified',
      explanation:
        'Bioacoustic field studies demonstrate elephants emit infrasonic rumbles between 14-24 Hz that travel several kilometers.',
      sources: ['https://www.scientificamerican.com/article/how-elephants-communicate/'],
      duration: 4.0
    }
  ],

  // Dedicated Misinformation Demo ID
  'demo-misinfo-1': [
    {
      timestamp: 5.0,
      sentence: 'Drinking distilled seawater can cure viral respiratory infections within 24 hours.',
      verdict: 'misinformation',
      explanation:
        'World Health Organization and medical authorities explicitly warn that drinking saline seawater induces severe dehydration and exhibits zero antiviral properties.',
      sources: [
        'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters',
        'https://www.cdc.gov/healthywater/drinking/travel/desalination.html'
      ],
      duration: 5.0
    },
    {
      timestamp: 22.0,
      sentence: 'Hand hygiene with regular soap and water significantly reduces viral pathogen transmission.',
      verdict: 'verified',
      explanation:
        'Peer-reviewed epidemiological investigations show soap molecules disrupt viral lipid bilayer membranes and detach pathogens from skin.',
      sources: ['https://www.cdc.gov/handwashing/why-handwashing.html'],
      duration: 4.5
    },
    {
      timestamp: 48.0,
      sentence: 'Certain rare herbs found only in high-altitude mountain caves provide complete lifelong immunity.',
      verdict: 'unknown',
      explanation:
        'While isolated phytochemical compounds are studied for immunomodulation, there is insufficient clinical evidence to substantiate claims of complete lifelong immunity.',
      sources: ['https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7158392/'],
      duration: 5.0
    }
  ],

  // YouTube IFrame API Official Demo ID
  'M7lc1UVf-VE': [
    {
      timestamp: 10.0,
      sentence: 'JavaScript was invented in 1995 in ten days by Brendan Eich at Netscape.',
      verdict: 'verified',
      explanation:
        'Documented computing history confirms Mocha (subsequently renamed LiveScript and JavaScript) was created by Brendan Eich in May 1995.',
      sources: ['https://www.w3.org/community/webed/wiki/A_Short_History_of_JavaScript'],
      duration: 4.5
    },
    {
      timestamp: 35.0,
      sentence: 'HTML is a Turing-complete functional programming language.',
      verdict: 'misinformation',
      explanation:
        'HTML (HyperText Markup Language) is a declarative markup specification for document structuring, not a Turing-complete programming language.',
      sources: ['https://developer.mozilla.org/en-US/docs/Learn/HTML/Introduction_to_HTML'],
      duration: 4.5
    }
  ]
};

/**
 * 32-bit FNV-1a string hashing function.
 *
 * @param {string} str
 * @returns {number} 32-bit unsigned integer hash.
 */
function fnv1a(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 32-bit pseudo-random number generator.
 * Highly uniform, deterministic, and fast.
 *
 * @param {number} seed - Unsigned 32-bit integer.
 * @returns {() => number} Returns float in [0, 1).
 */
function createMulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic sentence topic templates for fallback generation.
 */
const FALLBACK_TOPICS = [
  {
    verdict: 'misinformation',
    sentences: [
      'Global atmospheric carbon dioxide has no measurable greenhouse heat-trapping effect.',
      'Sunlight exposure to closed eyelids converts melanin directly into vitamin B12.',
      'Charging smartphones to 100% permanently damages lithium batteries within one week.',
      'The Great Wall of China is clearly visible from low Earth orbit with the unaided naked eye.',
      'Microwave ovens alter food molecular chemistry into radioactive carcinogens.'
    ],
    explanations: [
      'Spectroscopic physics measurements consistently demonstrate CO2 absorbs and re-emits infrared radiation.',
      'Vitamin B12 is synthesized exclusively by bacteria; photoreceptors have no biochemical pathway to synthesize B-vitamins.',
      'Modern smartphones utilize battery management circuits that throttle voltage and prevent overcharging.',
      'NASA astronaut observations and satellite imagery confirm the Great Wall is indistinguishable from surrounding terrain without optical magnification.',
      'Microwaves utilize non-ionizing radiation that causes thermal excitation of water molecules without ionizing atomic nuclei.'
    ],
    sources: [
      ['https://climate.nasa.gov/evidence/', 'https://www.ipcc.ch/report/ar6/wg1/'],
      ['https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/'],
      ['https://batteryuniversity.com/article/bu-808-how-to-prolong-lithium-based-batteries'],
      ['https://www.nasa.gov/vision/space/workinginspace/great_wall.html'],
      ['https://www.fda.gov/radiation-emitting-products/resources-you-radiation-emitting-products/microwave-ovens']
    ]
  },
  {
    verdict: 'verified',
    sentences: [
      'The speed of light in a vacuum is approximately 299,792 kilometers per second.',
      'Water reaches its maximum density in liquid state at approximately 3.98 degrees Celsius.',
      'Photosynthesis in green plants converts water and carbon dioxide into glucose and oxygen.',
      'The human genome contains roughly three billion base pairs of DNA.',
      'Saturn has a lower average density than liquid water.'
    ],
    explanations: [
      'Standard SI international metrology defines c = 299,792,458 m/s exactly.',
      'Thermal expansion and hydrogen-bonding lattice structure account for the density peak of liquid water at 4°C.',
      'Biochemical analysis of chloroplast chlorophyll reactions validates the standard photosynthetic equation.',
      'The Human Genome Project confirmed the diploid human genome spans approximately 3.1 billion base pairs.',
      'Astrophysical density models show Saturn mean density is ~0.687 g/cm³, lower than water at 1.0 g/cm³.'
    ],
    sources: [
      ['https://physics.nist.gov/cgi-bin/cuu/Value?c'],
      ['https://water.usgs.gov/edu/density.html'],
      ['https://www.khanacademy.org/science/biology/photosynthesis-in-plants'],
      ['https://www.genome.gov/human-genome-project'],
      ['https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html']
    ]
  },
  {
    verdict: 'unknown',
    sentences: [
      'Dark matter consists predominantly of primordial black holes formed during the Big Bang.',
      'The Phaistos Disc represents an ancient astronomical calendar rather than a written script.',
      'Certain deep-sea hydrothermal organisms possess a biological lifespan exceeding ten millennia.'
    ],
    explanations: [
      'While primordial black holes remain an active candidate for dark matter, observational microlensing constraints leave the hypothesis unconfirmed.',
      'The script and pictograms on the Minoan Phaistos Disc remain undeciphered and subject to debate among epigraphers.',
      'Radiometric dating of deep benthic colonies suggests extreme longevity, but continuous generational cellular replacement is difficult to quantify.'
    ],
    sources: [
      ['https://arxiv.org/abs/2002.12778'],
      ['https://en.wikipedia.org/wiki/Phaistos_Disc'],
      ['https://www.nature.com/articles/s41598-020-61868-3']
    ]
  }
];

/**
 * Generates a reproducible, deterministic list of 3-6 realistic claims
 * for an arbitrary video ID using Mulberry32 PRNG.
 *
 * @param {string} videoId - YouTube video ID.
 * @returns {Array<Object>} Array of validated Claim objects.
 */
export function generateDeterministicClaims(videoId) {
  const safeId = typeof videoId === 'string' && videoId.trim() ? videoId.trim() : 'default-id';
  const seed = fnv1a(safeId);
  const rnd = createMulberry32(seed);

  // Number of claims: 3 to 6
  const count = 3 + Math.floor(rnd() * 4);
  const claims = [];

  let currentTimestamp = 8 + Math.floor(rnd() * 10); // Start between 8s and 17s

  // Ensure balanced verdicts: always at least one misinformation and one verified
  const verdictSequence = ['misinformation', 'verified', 'unknown'];

  for (let i = 0; i < count; i++) {
    // Pick topic category
    const categoryIndex = i < verdictSequence.length ? i : Math.floor(rnd() * FALLBACK_TOPICS.length);
    const category = FALLBACK_TOPICS[categoryIndex % FALLBACK_TOPICS.length];

    const itemIndex = Math.floor(rnd() * category.sentences.length);
    const sentence = category.sentences[itemIndex];
    const explanation = category.explanations[itemIndex];
    const sources = category.sources[itemIndex] || ['https://factcheck.org/'];

    const duration = 4.0 + Math.round(rnd() * 20) / 10; // 4.0 to 6.0 seconds

    const rawClaim = {
      timestamp: Math.round(currentTimestamp * 10) / 10,
      sentence,
      verdict: category.verdict,
      explanation,
      sources,
      duration
    };

    claims.push(validateClaim(rawClaim));

    // Space out next claim timestamp: +20 to +45 seconds
    currentTimestamp += 20 + Math.floor(rnd() * 25);
  }

  // Sort chronologically ascending
  claims.sort((a, b) => a.timestamp - b.timestamp);
  return claims;
}

// In-memory cache for retrieved claims
const claimsCache = new Map();

/**
 * Resets the in-memory claims cache (useful for testing).
 */
export function clearClaimsCache() {
  claimsCache.clear();
}

/**
 * Asynchronously retrieves claims for a given YouTube video ID.
 * Returns seeded dataset for known IDs, or deterministically generated claims for arbitrary IDs.
 *
 * @param {string} videoId - The YouTube video ID.
 * @param {Object} [options] - Optional settings (e.g. simulated delayMs).
 * @returns {Promise<Array<Object>>} Resolves to an array of validated Claims.
 */
export async function getClaimsForVideo(videoId, options = {}) {
  if (!videoId || typeof videoId !== 'string' || !videoId.trim()) {
    return [];
  }

  const cleanId = videoId.trim();

  // Check cache first
  if (claimsCache.has(cleanId)) {
    return JSON.parse(JSON.stringify(claimsCache.get(cleanId)));
  }

  if (options.delayMs && options.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));
  }

  let claims = [];

  if (Object.prototype.hasOwnProperty.call(SEEDED_CLAIMS, cleanId)) {
    claims = SEEDED_CLAIMS[cleanId].map((c) => validateClaim(c));
  } else {
    claims = generateDeterministicClaims(cleanId);
  }

  // Cache results
  claimsCache.set(cleanId, claims);

  // Return deep clone
  return JSON.parse(JSON.stringify(claims));
}
```

---

### 4.4 Blueprint: `src/video-tracker.js`

```javascript
/**
 * Video Playback Tracker & Synchronizer Engine.
 * Evaluates active claims within configurable tolerance windows, executes seek jumps,
 * and detects active YouTube ad overlays.
 */

/**
 * Finds the currently active claim at a given video playback time.
 * Evaluates within [t - leadTolerance, t + duration].
 * If multiple claims overlap, prioritizes 'misinformation' verdict to ensure warning alerts fire.
 *
 * @param {Array<Object>} claims - Array of Claim objects.
 * @param {number} currentTime - Current playback time in seconds.
 * @param {number} [leadTolerance=0.25] - Lead tolerance window in seconds.
 * @param {number} [defaultDuration=4.5] - Default duration in seconds if claim.duration is omitted.
 * @returns {Object|null} The active Claim object, or null if no claim is active.
 */
export function findActiveClaim(claims, currentTime, leadTolerance = 0.25, defaultDuration = 4.5) {
  if (!Array.isArray(claims) || claims.length === 0) {
    return null;
  }

  if (typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
    return null;
  }

  const safeLead = Math.max(0, typeof leadTolerance === 'number' && !isNaN(leadTolerance) ? leadTolerance : 0.25);
  const safeDuration = Math.max(0.1, typeof defaultDuration === 'number' && !isNaN(defaultDuration) ? defaultDuration : 4.5);

  const activeCandidates = [];

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    if (!claim || typeof claim.timestamp !== 'number') continue;

    const startTime = Math.max(0, claim.timestamp - safeLead);
    const duration = typeof claim.duration === 'number' && claim.duration > 0 ? claim.duration : safeDuration;
    const endTime = claim.timestamp + duration;

    // Strict boundary condition: startTime <= currentTime < endTime
    if (currentTime >= startTime && currentTime < endTime) {
      activeCandidates.push(claim);
    }
  }

  if (activeCandidates.length === 0) {
    return null;
  }

  // If multiple claims match the window, prioritize misinformation
  const misinfoClaim = activeCandidates.find((c) => c.verdict === 'misinformation');
  if (misinfoClaim) {
    return misinfoClaim;
  }

  return activeCandidates[0];
}

/**
 * Seeks the HTML5 video element to a specified timestamp in seconds.
 * Clamps target timestamp within [0, videoElement.duration].
 *
 * @param {HTMLVideoElement} videoElement - The video element to seek.
 * @param {number} targetSeconds - Target playback time in seconds.
 * @param {boolean} [autoPlay=true] - Whether to resume playback if paused.
 * @returns {boolean} True if seek was successfully initiated, false otherwise.
 */
export function seekToTimestamp(videoElement, targetSeconds, autoPlay = true) {
  if (!videoElement || typeof videoElement.currentTime === 'undefined') {
    return false;
  }

  if (typeof targetSeconds !== 'number' || isNaN(targetSeconds)) {
    return false;
  }

  const duration =
    typeof videoElement.duration === 'number' &&
    !isNaN(videoElement.duration) &&
    videoElement.duration > 0
      ? videoElement.duration
      : Infinity;

  const clamped = Math.max(0, Math.min(duration, targetSeconds));
  videoElement.currentTime = clamped;

  if (autoPlay && videoElement.paused) {
    videoElement.play().catch(() => {
      // Autoplay policies or user gesture constraints may reject play()
    });
  }

  return true;
}

/**
 * Detects whether a YouTube ad is currently actively playing.
 * Inspects player container classes and ad overlay DOM elements.
 *
 * @returns {boolean} True if an ad is currently playing.
 */
export function isAdActive() {
  if (typeof document === 'undefined') {
    return false;
  }

  // 1. Check movie player container for ad classes
  const player =
    document.getElementById('movie_player') ||
    document.querySelector('.html5-video-player');

  if (player && player.classList) {
    if (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting')
    ) {
      return true;
    }
  }

  // 2. Check for active YouTube ad overlay components
  const adOverlay = document.querySelector(
    '.ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-module, .video-ads'
  );
  if (adOverlay && adOverlay.children && adOverlay.children.length > 0) {
    return true;
  }

  // 3. Check video element attributes (some ad formats alter video source or class)
  const video =
    document.querySelector('video.html5-main-video') ||
    document.querySelector('video');

  if (video && video.src) {
    if (
      video.src.includes('&adformat=') ||
      video.src.includes('googlevideo.com/videoplayback?sparams=.*ad')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Discovers the active YouTube HTML5 video element with retry polling.
 *
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds.
 * @returns {Promise<HTMLVideoElement>} Resolves with the video element.
 */
export function waitForVideoElement(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('Document is undefined'));
    }

    const immediate =
      document.querySelector('video.html5-main-video') ||
      document.querySelector('#movie_player video') ||
      document.querySelector('video');

    if (immediate) {
      return resolve(immediate);
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const el =
        document.querySelector('video.html5-main-video') ||
        document.querySelector('#movie_player video') ||
        document.querySelector('video');

      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - startTime >= timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for video element after ${timeoutMs}ms`));
      }
    }, 100);
  });
}
```

---

## 5. Verification Method

To independently verify this architectural blueprint:

### 5.1 Unit Test Execution
The blueprints are directly covered by the Milestone 1 unit test suite. Implementer and Explorer 3 should run:
```bash
node --test tests/youtube-url.test.js tests/claim-service.test.js tests/video-tracker.test.js
```

### 5.2 Assertions to Verify
1. **`tests/youtube-url.test.js`**:
   - `parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')` $\to$ `'dQw4w9WgXcQ'`.
   - `parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')` $\to$ `'dQw4w9WgXcQ'`.
   - `parseYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')` $\to$ `'dQw4w9WgXcQ'`.
   - `parseYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')` $\to$ `null`.
   - `isYouTubeWatchUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')` $\to$ `true`.
   - `isYouTubeWatchUrl('https://www.youtube.com/feed/subscriptions')` $\to$ `false`.
   - `formatTimestamp(42.5)` $\to$ `'00:42'`.
   - `formatTimestamp(3665)` $\to$ `'01:01:05'`.

2. **`tests/claim-service.test.js`**:
   - `validateClaim({ timestamp: 10, sentence: 'Test', verdict: 'misinformation', explanation: 'Exp', sources: [] })` passes.
   - `validateClaim({ timestamp: -1, ... })` throws Error.
   - `validateClaim({ verdict: 'bogus', ... })` throws Error.
   - `generateDeterministicClaims('test-id-1')` called 100 times yields identical deep-equal arrays.
   - `generateDeterministicClaims('test-id-1')` vs `generateDeterministicClaims('test-id-2')` yields distinct datasets.
   - `getClaimsForVideo('dQw4w9WgXcQ')` returns the 4 seeded claims.

3. **`tests/video-tracker.test.js`**:
   - Given claim at `timestamp: 42.0` with `duration: 4.5` and `leadTolerance: 0.25`:
     - `currentTime = 41.74` $\to$ `null` (before $42.0 - 0.25$).
     - `currentTime = 41.75` $\to$ matches active claim.
     - `currentTime = 42.0` $\to$ matches active claim.
     - `currentTime = 46.49` $\to$ matches active claim.
     - `currentTime = 46.50` $\to$ `null` (expired).
   - `seekToTimestamp(videoEl, 50)` updates `videoEl.currentTime = 50`.
   - `isAdActive()` returns `true` when `#movie_player` has `.ad-showing` class.

4. **Invalidation Conditions**:
   - If calling `generateDeterministicClaims` with identical string yields different outputs across Node vs Chrome.
   - If `parseYouTubeVideoId` extracts an ID from a non-YouTube hostname.
   - If `findActiveClaim` matches when `currentTime >= timestamp + duration`.
