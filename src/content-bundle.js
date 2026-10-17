(() => {
  // src/youtube-url.js
  var YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
  var KNOWN_YOUTUBE_HOSTS = /* @__PURE__ */ new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "gaming.youtube.com",
    "youtu.be",
    "www.youtu.be"
  ]);
  function parseYouTubeVideoId(urlOrStr) {
    if (!urlOrStr || typeof urlOrStr !== "string") {
      return null;
    }
    const trimmed = urlOrStr.trim();
    if (!trimmed) {
      return null;
    }
    if (YOUTUBE_VIDEO_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed, "https://www.youtube.com");
      const hostname = parsed.hostname.toLowerCase();
      const isYouTubeDomain = KNOWN_YOUTUBE_HOSTS.has(hostname) || hostname.endsWith(".youtube.com") || hostname.endsWith(".youtu.be");
      if (hostname === "youtu.be" || hostname.endsWith(".youtu.be")) {
        const candidate = parsed.pathname.slice(1).split("/")[0];
        if (YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
          return candidate;
        }
        return null;
      }
      if (!isYouTubeDomain) {
        return null;
      }
      if (parsed.pathname === "/watch" || parsed.pathname === "/watch_popup") {
        const v = parsed.searchParams.get("v");
        if (v && YOUTUBE_VIDEO_ID_REGEX.test(v)) {
          return v;
        }
        return null;
      }
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length >= 2) {
        const prefix = segments[0].toLowerCase();
        if (["embed", "shorts", "live", "v"].includes(prefix)) {
          const candidate = segments[1];
          if (YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
            return candidate;
          }
        }
      }
      return null;
    } catch {
      const match = trimmed.match(
        /(?:v=|\/embed\/|\/shorts\/|\/live\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&#/]|$)/
      );
      if (match && YOUTUBE_VIDEO_ID_REGEX.test(match[1])) {
        return match[1];
      }
    }
    return null;
  }
  function isYouTubeWatchUrl(urlOrStr) {
    if (!urlOrStr || typeof urlOrStr !== "string") {
      return false;
    }
    const trimmed = urlOrStr.trim();
    const videoId = parseYouTubeVideoId(trimmed);
    if (!videoId) {
      return false;
    }
    try {
      const parsed = new URL(trimmed, "https://www.youtube.com");
      const hostname = parsed.hostname.toLowerCase();
      const isYouTubeDomain = KNOWN_YOUTUBE_HOSTS.has(hostname) || hostname.endsWith(".youtube.com") || hostname.endsWith(".youtu.be");
      if (!isYouTubeDomain) {
        return false;
      }
      return parsed.pathname === "/watch" || parsed.pathname === "/watch_popup" || hostname === "youtu.be" || hostname.endsWith(".youtu.be") || parsed.pathname.startsWith("/shorts/");
    } catch {
      return false;
    }
  }
  function formatTimestamp(seconds) {
    if (typeof seconds !== "number" || isNaN(seconds) || seconds < 0) {
      return "00:00";
    }
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const secs = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    }
    return `${pad(minutes)}:${pad(secs)}`;
  }

  // src/claim-service.js
  var VALID_VERDICTS = Object.freeze(["misinformation", "verified", "unknown"]);
  function validateClaim(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Claim must be a non-null object");
    }
    if (typeof raw.timestamp !== "number" || isNaN(raw.timestamp) || !isFinite(raw.timestamp) || raw.timestamp < 0) {
      throw new Error("Claim timestamp must be a non-negative finite number");
    }
    if (typeof raw.sentence !== "string" || raw.sentence.trim().length === 0) {
      throw new Error("Claim sentence must be a non-empty string");
    }
    if (!raw.verdict || !VALID_VERDICTS.includes(raw.verdict)) {
      throw new Error(`Claim verdict must be one of: ${VALID_VERDICTS.join(", ")}`);
    }
    if (typeof raw.explanation !== "string") {
      throw new Error("Claim explanation must be a string");
    }
    if (!Array.isArray(raw.sources)) {
      throw new Error("Claim sources must be an array of strings");
    }
    for (const src of raw.sources) {
      if (typeof src !== "string") {
        throw new Error("Each source in claim sources must be a string URL");
      }
    }
    let duration = 4.5;
    if (typeof raw.duration === "number" && !isNaN(raw.duration) && isFinite(raw.duration) && raw.duration > 0) {
      duration = raw.duration;
    }
    return {
      timestamp: Number(raw.timestamp),
      sentence: String(raw.sentence).trim(),
      verdict: raw.verdict,
      explanation: String(raw.explanation).trim(),
      sources: raw.sources.map((s) => String(s).trim()).filter(Boolean),
      duration
    };
  }
  var SEEDED_CLAIMS = {
    // Rick Astley - Never Gonna Give You Up (Standard Demo ID)
    dQw4w9WgXcQ: [
      {
        timestamp: 12,
        sentence: "This song was completely improvised in a single take without prior rehearsal.",
        verdict: "misinformation",
        explanation: "The track was meticulously written, arranged, and produced by Stock Aitken Waterman over several weeks at PWL Studios in London.",
        sources: [
          "https://www.factcheck.org/2021/music-history-pwl",
          "https://en.wikipedia.org/wiki/Never_Gonna_Give_You_Up"
        ],
        duration: 4.5
      },
      {
        timestamp: 42.5,
        sentence: "Never Gonna Give You Up reached number one in 25 countries upon its release in 1987.",
        verdict: "verified",
        explanation: "Official international music record charts confirm the single topped charts in 25 countries worldwide including the UK, US, and Australia.",
        sources: ["https://www.billboard.com/charts/hot-100/1988-03-12"],
        duration: 5
      },
      {
        timestamp: 88,
        sentence: "The music video was shot on a multi-million dollar film soundstage in Hollywood.",
        verdict: "misinformation",
        explanation: "The video was directed by Simon West on a shoestring budget of under \xA33,000 near London Battersea District.",
        sources: ["https://apnews.com/article/fact-check-astley-video-production"],
        duration: 4.5
      },
      {
        timestamp: 135,
        sentence: "Rick Astley originally declined to record the vocal track until persuaded by Pete Waterman.",
        verdict: "unknown",
        explanation: "Historical accounts from studio engineers and producers differ on whether Astley was initially hesitant or eager to record.",
        sources: ["https://www.reuters.com/fact-check/pwl-studios-retrospective"],
        duration: 4
      }
    ],
    // Me at the zoo (First YouTube Video)
    jNQXAC9IVRw: [
      {
        timestamp: 3,
        sentence: "Elephants have the longest trunks of any terrestrial mammal on Earth.",
        verdict: "verified",
        explanation: "Biological taxonomies confirm that proboscideans possess the largest and longest muscular proboscis among all land mammals.",
        sources: ["https://nationalzoo.si.edu/animals/asian-elephant"],
        duration: 4
      },
      {
        timestamp: 9.5,
        sentence: "The San Diego Zoo currently houses over two million individual elephants.",
        verdict: "misinformation",
        explanation: "The total worldwide population of wild and captive elephants is under 500,000. The San Diego Zoo hosts a small herd of fewer than a dozen.",
        sources: ["https://sandiegozoowildlifealliance.org/animals/elephant"],
        duration: 4.5
      },
      {
        timestamp: 15,
        sentence: "Elephants communicate over long distances using low-frequency infrasound.",
        verdict: "verified",
        explanation: "Bioacoustic field studies demonstrate elephants emit infrasonic rumbles between 14-24 Hz that travel several kilometers.",
        sources: ["https://www.scientificamerican.com/article/how-elephants-communicate/"],
        duration: 4
      }
    ],
    // Dedicated Misinformation Demo ID
    "demo-misinfo-1": [
      {
        timestamp: 5,
        sentence: "Drinking distilled seawater can cure viral respiratory infections within 24 hours.",
        verdict: "misinformation",
        explanation: "World Health Organization and medical authorities explicitly warn that drinking saline seawater induces severe dehydration and exhibits zero antiviral properties.",
        sources: [
          "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters",
          "https://www.cdc.gov/healthywater/drinking/travel/desalination.html"
        ],
        duration: 5
      },
      {
        timestamp: 22,
        sentence: "Hand hygiene with regular soap and water significantly reduces viral pathogen transmission.",
        verdict: "verified",
        explanation: "Peer-reviewed epidemiological investigations show soap molecules disrupt viral lipid bilayer membranes and detach pathogens from skin.",
        sources: ["https://www.cdc.gov/handwashing/why-handwashing.html"],
        duration: 4.5
      },
      {
        timestamp: 48,
        sentence: "Certain rare herbs found only in high-altitude mountain caves provide complete lifelong immunity.",
        verdict: "unknown",
        explanation: "While isolated phytochemical compounds are studied for immunomodulation, there is insufficient clinical evidence to substantiate claims of complete lifelong immunity.",
        sources: ["https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7158392/"],
        duration: 5
      }
    ],
    // YouTube IFrame API Official Demo ID
    "M7lc1UVf-VE": [
      {
        timestamp: 10,
        sentence: "JavaScript was invented in 1995 in ten days by Brendan Eich at Netscape.",
        verdict: "verified",
        explanation: "Documented computing history confirms Mocha (subsequently renamed LiveScript and JavaScript) was created by Brendan Eich in May 1995.",
        sources: ["https://www.w3.org/community/webed/wiki/A_Short_History_of_JavaScript"],
        duration: 4.5
      },
      {
        timestamp: 35,
        sentence: "HTML is a Turing-complete functional programming language.",
        verdict: "misinformation",
        explanation: "HTML (HyperText Markup Language) is a declarative markup specification for document structuring, not a Turing-complete programming language.",
        sources: ["https://developer.mozilla.org/en-US/docs/Learn/HTML/Introduction_to_HTML"],
        duration: 4.5
      }
    ]
  };
  function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function createMulberry32(seed) {
    let s = seed >>> 0;
    return function() {
      s |= 0;
      s = s + 1831565813 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var FALLBACK_TOPICS = [
    {
      verdict: "misinformation",
      sentences: [
        "Global atmospheric carbon dioxide has no measurable greenhouse heat-trapping effect.",
        "Sunlight exposure to closed eyelids converts melanin directly into vitamin B12.",
        "Charging smartphones to 100% permanently damages lithium batteries within one week.",
        "The Great Wall of China is clearly visible from low Earth orbit with the unaided naked eye.",
        "Microwave ovens alter food molecular chemistry into radioactive carcinogens."
      ],
      explanations: [
        "Spectroscopic physics measurements consistently demonstrate CO2 absorbs and re-emits infrared radiation.",
        "Vitamin B12 is synthesized exclusively by bacteria; photoreceptors have no biochemical pathway to synthesize B-vitamins.",
        "Modern smartphones utilize battery management circuits that throttle voltage and prevent overcharging.",
        "NASA astronaut observations and satellite imagery confirm the Great Wall is indistinguishable from surrounding terrain without optical magnification.",
        "Microwaves utilize non-ionizing radiation that causes thermal excitation of water molecules without ionizing atomic nuclei."
      ],
      sources: [
        ["https://climate.nasa.gov/evidence/", "https://www.ipcc.ch/report/ar6/wg1/"],
        ["https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/"],
        ["https://batteryuniversity.com/article/bu-808-how-to-prolong-lithium-based-batteries"],
        ["https://www.nasa.gov/vision/space/workinginspace/great_wall.html"],
        ["https://www.fda.gov/radiation-emitting-products/resources-you-radiation-emitting-products/microwave-ovens"]
      ]
    },
    {
      verdict: "verified",
      sentences: [
        "The speed of light in a vacuum is approximately 299,792 kilometers per second.",
        "Water reaches its maximum density in liquid state at approximately 3.98 degrees Celsius.",
        "Photosynthesis in green plants converts water and carbon dioxide into glucose and oxygen.",
        "The human genome contains roughly three billion base pairs of DNA.",
        "Saturn has a lower average density than liquid water."
      ],
      explanations: [
        "Standard SI international metrology defines c = 299,792,458 m/s exactly.",
        "Thermal expansion and hydrogen-bonding lattice structure account for the density peak of liquid water at 4\xB0C.",
        "Biochemical analysis of chloroplast chlorophyll reactions validates the standard photosynthetic equation.",
        "The Human Genome Project confirmed the diploid human genome spans approximately 3.1 billion base pairs.",
        "Astrophysical density models show Saturn mean density is ~0.687 g/cm\xB3, lower than water at 1.0 g/cm\xB3."
      ],
      sources: [
        ["https://physics.nist.gov/cgi-bin/cuu/Value?c"],
        ["https://water.usgs.gov/edu/density.html"],
        ["https://www.khanacademy.org/science/biology/photosynthesis-in-plants"],
        ["https://www.genome.gov/human-genome-project"],
        ["https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html"]
      ]
    },
    {
      verdict: "unknown",
      sentences: [
        "Dark matter consists predominantly of primordial black holes formed during the Big Bang.",
        "The Phaistos Disc represents an ancient astronomical calendar rather than a written script.",
        "Certain deep-sea hydrothermal organisms possess a biological lifespan exceeding ten millennia."
      ],
      explanations: [
        "While primordial black holes remain an active candidate for dark matter, observational microlensing constraints leave the hypothesis unconfirmed.",
        "The script and pictograms on the Minoan Phaistos Disc remain undeciphered and subject to debate among epigraphers.",
        "Radiometric dating of deep benthic colonies suggests extreme longevity, but continuous generational cellular replacement is difficult to quantify."
      ],
      sources: [
        ["https://arxiv.org/abs/2002.12778"],
        ["https://en.wikipedia.org/wiki/Phaistos_Disc"],
        ["https://www.nature.com/articles/s41598-020-61868-3"]
      ]
    }
  ];
  function generateDeterministicClaims(videoId) {
    const safeId = typeof videoId === "string" && videoId.trim() ? videoId.trim() : "default-id";
    const seed = fnv1a(safeId);
    const rnd = createMulberry32(seed);
    const count = 3 + Math.floor(rnd() * 4);
    const claims = [];
    let currentTimestamp = 8 + Math.floor(rnd() * 10);
    const verdictSequence = ["misinformation", "verified", "unknown"];
    for (let i = 0; i < count; i++) {
      const categoryIndex = i < verdictSequence.length ? i : Math.floor(rnd() * FALLBACK_TOPICS.length);
      const category = FALLBACK_TOPICS[categoryIndex % FALLBACK_TOPICS.length];
      const itemIndex = Math.floor(rnd() * category.sentences.length);
      const sentence = category.sentences[itemIndex];
      const explanation = category.explanations[itemIndex];
      const sources = category.sources[itemIndex] || ["https://factcheck.org/"];
      const duration = 4 + Math.round(rnd() * 20) / 10;
      const rawClaim = {
        timestamp: Math.round(currentTimestamp * 10) / 10,
        sentence,
        verdict: category.verdict,
        explanation,
        sources,
        duration
      };
      claims.push(validateClaim(rawClaim));
      currentTimestamp += 20 + Math.floor(rnd() * 25);
    }
    claims.sort((a, b) => a.timestamp - b.timestamp);
    return claims;
  }
  var claimsCache = /* @__PURE__ */ new Map();
  async function getClaimsForVideo(videoId, options = {}) {
    if (!videoId || typeof videoId !== "string" || !videoId.trim()) {
      return [];
    }
    const cleanId = videoId.trim();
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
    claimsCache.set(cleanId, claims);
    return JSON.parse(JSON.stringify(claims));
  }

  // src/video-tracker.js
  function findActiveClaim(claims, currentTime, leadTolerance = 0.25, defaultDuration = 4.5) {
    if (!Array.isArray(claims) || claims.length === 0) {
      return null;
    }
    if (typeof currentTime !== "number" || isNaN(currentTime) || !isFinite(currentTime) || currentTime < 0) {
      return null;
    }
    const safeLead = Math.max(0, typeof leadTolerance === "number" && !isNaN(leadTolerance) ? leadTolerance : 0.25);
    const safeDuration = Math.max(0.1, typeof defaultDuration === "number" && !isNaN(defaultDuration) ? defaultDuration : 4.5);
    const activeCandidates = [];
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      if (!claim || typeof claim.timestamp !== "number") continue;
      const startTime = Math.max(0, claim.timestamp - safeLead);
      const duration = typeof claim.duration === "number" && claim.duration > 0 ? claim.duration : safeDuration;
      let endTime = claim.timestamp + duration;
      if (i < claims.length - 1 && typeof claims[i + 1]?.timestamp === "number") {
        const nextStartTime = claims[i + 1].timestamp;
        if (nextStartTime > claim.timestamp && endTime > nextStartTime) {
          endTime = nextStartTime;
        }
      }
      if (currentTime >= startTime && currentTime < endTime) {
        activeCandidates.push(claim);
      }
    }
    if (activeCandidates.length === 0) {
      return null;
    }
    const misinfoClaim = activeCandidates.find((c) => c.verdict === "misinformation");
    if (misinfoClaim) {
      return misinfoClaim;
    }
    return activeCandidates[activeCandidates.length - 1];
  }
  function seekToTimestamp(videoElement, targetSeconds, autoPlay = true) {
    if (!videoElement || typeof videoElement.currentTime === "undefined") {
      return false;
    }
    if (typeof targetSeconds !== "number" || isNaN(targetSeconds)) {
      return false;
    }
    const duration = typeof videoElement.duration === "number" && !isNaN(videoElement.duration) && videoElement.duration > 0 ? videoElement.duration : Infinity;
    const clamped = Math.max(0, Math.min(duration, targetSeconds));
    videoElement.currentTime = clamped;
    if (autoPlay && videoElement.paused && typeof videoElement.play === "function") {
      try {
        const playPromise = videoElement.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
          });
        }
      } catch {
      }
    }
    return true;
  }
  function isAdActive() {
    if (typeof document === "undefined") {
      return false;
    }
    const player = typeof document.getElementById === "function" && document.getElementById("movie_player") || typeof document.querySelector === "function" && document.querySelector(".html5-video-player");
    if (player && player.classList && typeof player.classList.contains === "function") {
      if (player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting")) {
        return true;
      }
    }
    if (typeof document.querySelector === "function") {
      const adOverlay = document.querySelector(
        ".ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-module, .video-ads"
      );
      if (adOverlay) {
        if (adOverlay.children) {
          if (adOverlay.children.length > 0) return true;
        } else {
          return true;
        }
      }
    }
    if (typeof document.querySelector === "function") {
      const video = document.querySelector("video.html5-main-video") || document.querySelector("video");
      if (video && typeof video.src === "string" && video.src) {
        if (video.src.includes("&adformat=") || video.src.includes("googlevideo.com/videoplayback?sparams=.*ad")) {
          return true;
        }
      }
    }
    return false;
  }
  function waitForVideoElement(timeoutMs = 5e3) {
    return new Promise((resolve) => {
      if (typeof document === "undefined") {
        return resolve(null);
      }
      const immediate = document.querySelector("video.html5-main-video") || document.querySelector("#movie_player video") || document.querySelector("video");
      if (immediate) {
        return resolve(immediate);
      }
      const startTime = Date.now();
      const interval = setInterval(() => {
        const el = document.querySelector("video.html5-main-video") || document.querySelector("#movie_player video") || document.querySelector("video");
        if (el) {
          clearInterval(interval);
          resolve(el);
        } else if (Date.now() - startTime >= timeoutMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
    });
  }

  // src/overlay-manager.js
  function createWarningOverlay(claim, options = {}) {
    const container = document.createElement("div");
    container.id = "yt-misinfo-overlay-root";
    container.className = "yt-misinfo-overlay-container yt-misinfo-overlay";
    container.style.pointerEvents = "none";
    const card = document.createElement("div");
    card.className = "yt-misinfo-card yt-misinfo-card--misinformation";
    card.setAttribute("role", "alert");
    card.setAttribute("aria-live", "polite");
    card.style.pointerEvents = "auto";
    if (claim && typeof claim.timestamp === "number") {
      card.dataset.timestamp = String(claim.timestamp);
    }
    const header = document.createElement("div");
    header.className = "yt-misinfo-card-header";
    const badge = document.createElement("div");
    badge.className = "yt-misinfo-card-badge";
    badge.innerHTML = `
    <svg class="yt-misinfo-icon" viewBox="0 0 24 24" width="16" height="16">
      <path d="M12 2L1 21h22L12 2zm0 3.5L20 19H4L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="currentColor"/>
    </svg>
    <span class="yt-misinfo-card-badge-text">Misinformation Alert</span>
  `;
    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "yt-misinfo-card-dismiss yt-misinfo-dismiss";
    dismissBtn.setAttribute("aria-label", "Dismiss alert");
    dismissBtn.innerHTML = "&times;";
    dismissBtn.addEventListener("click", (e) => {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      if (typeof options.onDismiss === "function") {
        options.onDismiss();
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
    header.appendChild(badge);
    header.appendChild(dismissBtn);
    const body = document.createElement("div");
    body.className = "yt-misinfo-card-body";
    const meta = document.createElement("div");
    meta.className = "yt-misinfo-card-meta";
    const timeSpan = document.createElement("span");
    timeSpan.className = "yt-misinfo-card-time";
    timeSpan.textContent = formatTimestamp(claim?.timestamp || 0);
    meta.appendChild(timeSpan);
    const quote = document.createElement("blockquote");
    quote.className = "yt-misinfo-card-sentence";
    quote.textContent = `\u201C${claim?.sentence || ""}\u201D`;
    const explanation = document.createElement("p");
    explanation.className = "yt-misinfo-card-explanation";
    explanation.textContent = claim?.explanation || "This statement has been flagged as inaccurate or misleading.";
    body.appendChild(meta);
    body.appendChild(quote);
    body.appendChild(explanation);
    const footer = document.createElement("div");
    footer.className = "yt-misinfo-card-footer";
    if (claim?.sources && Array.isArray(claim.sources) && claim.sources.length > 0) {
      claim.sources.forEach((sourceUrl) => {
        if (typeof sourceUrl === "string" && /^https?:\/\//i.test(sourceUrl.trim())) {
          const sourceLink = document.createElement("a");
          sourceLink.className = "yt-misinfo-card-source";
          sourceLink.href = sourceUrl.trim();
          sourceLink.setAttribute("href", sourceUrl.trim());
          sourceLink.target = "_blank";
          sourceLink.setAttribute("target", "_blank");
          sourceLink.rel = "noopener noreferrer";
          try {
            sourceLink.textContent = new URL(sourceUrl.trim()).hostname.replace(/^www\./, "");
          } catch {
            sourceLink.textContent = "source";
          }
          footer.appendChild(sourceLink);
        }
      });
    }
    const timelineBtn = document.createElement("button");
    timelineBtn.type = "button";
    timelineBtn.className = "yt-misinfo-card-btn-timeline";
    timelineBtn.textContent = "View in Timeline \u2192";
    timelineBtn.addEventListener("click", (e) => {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      if (typeof options.onViewTimeline === "function") {
        options.onViewTimeline(claim);
      }
    });
    footer.appendChild(timelineBtn);
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    container.appendChild(card);
    return container;
  }
  var OverlayManager = class {
    /**
     * @param {Object} [options]
     * @param {HTMLElement} [options.playerElement]
     * @param {(claim: Object) => void} [options.onViewTimeline]
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
      if (!this.playerElement && typeof document !== "undefined") {
        this.playerElement = typeof document.getElementById === "function" && document.getElementById("movie_player") || typeof document.querySelector === "function" && document.querySelector(".html5-video-player");
      }
      if (!this.playerElement) {
        return null;
      }
      let existing = this.playerElement.querySelector("#yt-misinfo-overlay-root");
      if (existing) {
        this.container = existing;
        return this.container;
      }
      this.container = document.createElement("div");
      this.container.id = "yt-misinfo-overlay-root";
      this.container.className = "yt-misinfo-overlay-container yt-misinfo-overlay";
      this.container.style.pointerEvents = "none";
      this.playerElement.appendChild(this.container);
      return this.container;
    }
    /**
     * Synchronizes the overlay state with current active claim and settings.
     * @param {Object|null} activeClaim
     * @param {{ enabled: boolean, showOverlays: boolean }} [settings]
     */
    update(activeClaim, settings = { enabled: true, showOverlays: true }) {
      if (!settings.enabled || !settings.showOverlays) {
        this.hide();
        return;
      }
      if (!activeClaim || activeClaim.verdict !== "misinformation") {
        this.hide();
        return;
      }
      const claimKey = `${activeClaim.timestamp}_${activeClaim.sentence}`;
      if (this.dismissedClaimKey === claimKey) {
        return;
      }
      if (this.activeClaim && `${this.activeClaim.timestamp}_${this.activeClaim.sentence}` === claimKey) {
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
      const overlayTree = createWarningOverlay(claim, {
        onDismiss: () => {
          this.dismiss();
        },
        onViewTimeline: (c) => {
          if (typeof this.onViewTimelineCallback === "function") {
            this.onViewTimelineCallback(c);
          }
        }
      });
      const card = overlayTree.querySelector(".yt-misinfo-card");
      if (card) {
        if (typeof this.container.replaceChildren === "function") {
          this.container.replaceChildren(card);
        } else {
          while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
          }
          this.container.appendChild(card);
        }
      }
    }
    /**
     * Hides the active warning overlay.
     * @param {boolean} [immediate=false]
     */
    hide(immediate = false) {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
      if (!this.container || !this.activeClaim) {
        this.activeClaim = null;
        return;
      }
      const card = this.container.querySelector(".yt-misinfo-card");
      if (immediate || !card) {
        if (typeof this.container.replaceChildren === "function") {
          this.container.replaceChildren();
        } else {
          while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
          }
        }
        this.activeClaim = null;
        return;
      }
      if (card && card.classList) {
        card.classList.add("yt-misinfo-card--hiding");
        this.hideTimeout = setTimeout(() => {
          if (this.container) {
            if (typeof this.container.replaceChildren === "function") {
              this.container.replaceChildren();
            } else {
              while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
              }
            }
          }
          this.activeClaim = null;
          this.hideTimeout = null;
        }, 180);
      }
    }
    /**
     * Dismisses the current claim instance on manual user action.
     */
    dismiss() {
      if (this.activeClaim) {
        this.dismissedClaimKey = `${this.activeClaim.timestamp}_${this.activeClaim.sentence}`;
      }
      this.hide(true);
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
  };

  // src/drawer-manager.js
  var DrawerManager = class {
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
      this.currentFilter = "all";
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
      if (!this.parent && typeof document !== "undefined") {
        this.parent = document.body;
      }
      if (!this.parent) return null;
      let existing = document.getElementById("yt-misinfo-drawer-root");
      if (existing) {
        this.root = existing;
        this._bindElements();
        return this.root;
      }
      this.root = document.createElement("div");
      this.root.id = "yt-misinfo-drawer-root";
      this.tabElement = document.createElement("button");
      this.tabElement.id = "yt-misinfo-drawer-tab";
      this.tabElement.className = "yt-misinfo-drawer-tab";
      this.tabElement.setAttribute("aria-label", "Toggle Fact Check Timeline");
      this.tabElement.setAttribute("title", "Toggle Fact Check Timeline");
      const tabLabel = document.createElement("span");
      tabLabel.className = "yt-misinfo-tab-label";
      tabLabel.textContent = "Claims";
      this.tabCount = document.createElement("span");
      this.tabCount.className = "yt-misinfo-tab-count";
      this.tabCount.textContent = "0";
      this.tabAlertDot = document.createElement("span");
      this.tabAlertDot.className = "yt-misinfo-tab-alert-dot yt-misinfo-hidden";
      this.tabElement.appendChild(tabLabel);
      this.tabElement.appendChild(this.tabCount);
      this.tabElement.appendChild(this.tabAlertDot);
      this.tabElement.addEventListener("click", () => this.toggle());
      this.panelElement = document.createElement("aside");
      this.panelElement.id = "yt-misinfo-drawer-panel";
      this.panelElement.className = "yt-misinfo-drawer-panel yt-misinfo-drawer-panel--collapsed is-collapsed";
      this.panelElement.setAttribute("role", "complementary");
      this.panelElement.setAttribute("aria-label", "Fact check claims timeline");
      this.panelElement.setAttribute("aria-expanded", "false");
      const header = document.createElement("header");
      header.className = "yt-misinfo-drawer-header";
      const titleGroup = document.createElement("div");
      titleGroup.className = "yt-misinfo-drawer-title-group";
      const title = document.createElement("h2");
      title.className = "yt-misinfo-drawer-title";
      title.textContent = "Claims Timeline";
      this.totalBadge = document.createElement("span");
      this.totalBadge.className = "yt-misinfo-drawer-total-badge";
      this.totalBadge.id = "yt-misinfo-drawer-total";
      this.totalBadge.textContent = "0";
      titleGroup.appendChild(title);
      titleGroup.appendChild(this.totalBadge);
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "yt-misinfo-drawer-close yt-misinfo-drawer-toggle";
      closeBtn.setAttribute("aria-label", "Close timeline drawer");
      closeBtn.textContent = "\xD7";
      closeBtn.addEventListener("click", () => this.close());
      header.appendChild(titleGroup);
      header.appendChild(closeBtn);
      const filters = document.createElement("nav");
      filters.className = "yt-misinfo-drawer-filters";
      filters.setAttribute("role", "tablist");
      const filterDefs = [
        { key: "all", label: "All", active: true },
        { key: "misinformation", label: "Misinformation", active: false },
        { key: "verified", label: "Verified", active: false },
        { key: "unknown", label: "Unverified", active: false }
      ];
      filterDefs.forEach((f) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `yt-misinfo-filter-chip${f.active ? " yt-misinfo-filter-chip--active" : ""}`;
        chip.dataset.filter = f.key;
        chip.textContent = f.label;
        filters.appendChild(chip);
      });
      filters.addEventListener("click", (e) => {
        const chip = e.target && typeof e.target.closest === "function" ? e.target.closest(".yt-misinfo-filter-chip") : null;
        if (chip && chip.dataset.filter) {
          this.setFilter(chip.dataset.filter);
        }
      });
      const body = document.createElement("div");
      body.className = "yt-misinfo-drawer-body";
      this.cardsListElement = document.createElement("div");
      this.cardsListElement.className = "yt-misinfo-cards-list";
      this.cardsListElement.setAttribute("role", "list");
      this._attachEventDelegation(this.cardsListElement);
      this.emptyStateElement = document.createElement("div");
      this.emptyStateElement.className = "yt-misinfo-empty-state yt-misinfo-hidden";
      this.emptyStateElement.textContent = "No claims match the selected filter.";
      body.appendChild(this.cardsListElement);
      body.appendChild(this.emptyStateElement);
      const footer = document.createElement("footer");
      footer.className = "yt-misinfo-drawer-footer";
      footer.textContent = "YouTube Misinformation Detector \u2022 Real-time";
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
      this.tabElement = this.root.querySelector("#yt-misinfo-drawer-tab");
      this.panelElement = this.root.querySelector("#yt-misinfo-drawer-panel");
      this.cardsListElement = this.root.querySelector(".yt-misinfo-cards-list");
      this.emptyStateElement = this.root.querySelector(".yt-misinfo-empty-state");
      this.totalBadge = this.root.querySelector("#yt-misinfo-drawer-total");
      this.tabCount = this.root.querySelector(".yt-misinfo-tab-count");
      this.tabAlertDot = this.root.querySelector(".yt-misinfo-tab-alert-dot");
    }
    _attachEventDelegation(container) {
      container.addEventListener("click", (e) => {
        if (e.target && typeof e.target.closest === "function" && e.target.closest("a")) return;
        const card = e.target && typeof e.target.closest === "function" ? e.target.closest(".yt-misinfo-timeline-card") : null;
        if (card && card.dataset.timestamp) {
          const timestamp = parseFloat(card.dataset.timestamp);
          if (!isNaN(timestamp) && typeof this.onSeekCallback === "function") {
            this.onSeekCallback(timestamp);
          }
        }
      });
      container.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          const card = e.target && typeof e.target.closest === "function" ? e.target.closest(".yt-misinfo-timeline-card") : null;
          if (card && card.dataset.timestamp) {
            e.preventDefault();
            const timestamp = parseFloat(card.dataset.timestamp);
            if (!isNaN(timestamp) && typeof this.onSeekCallback === "function") {
              this.onSeekCallback(timestamp);
            }
          }
        }
      });
    }
    /**
     * Sets the claims array and re-renders the chronological cards.
     * @param {Array<Object>} [claims=[]]
     */
    setClaims(claims = []) {
      this.claims = [...claims].sort((a, b) => a.timestamp - b.timestamp);
      this._updateCounters();
      this.render();
    }
    _updateCounters() {
      const total = this.claims.length;
      const misinfoCount = this.claims.filter((c) => c.verdict === "misinformation").length;
      if (this.totalBadge) this.totalBadge.textContent = String(total);
      if (this.tabCount) this.tabCount.textContent = String(total);
      if (this.tabAlertDot) {
        if (misinfoCount > 0) {
          this.tabAlertDot.classList.remove("yt-misinfo-hidden");
        } else {
          this.tabAlertDot.classList.add("yt-misinfo-hidden");
        }
      }
      if (this.root) {
        const chips = this.root.querySelectorAll(".yt-misinfo-filter-chip");
        chips.forEach((chip) => {
          const f = chip.dataset.filter;
          if (f === "all") chip.textContent = `All (${total})`;
          else if (f === "misinformation") chip.textContent = `Misinformation (${misinfoCount})`;
          else if (f === "verified") chip.textContent = `Verified (${this.claims.filter((c) => c.verdict === "verified").length})`;
          else if (f === "unknown") chip.textContent = `Unverified (${this.claims.filter((c) => c.verdict === "unknown").length})`;
        });
      }
    }
    /**
     * Renders the claim cards according to the active filter.
     */
    render() {
      if (!this.cardsListElement) return;
      const filtered = this.claims.filter((claim) => {
        if (this.currentFilter === "all") return true;
        return claim.verdict === this.currentFilter;
      });
      if (typeof this.cardsListElement.replaceChildren === "function") {
        this.cardsListElement.replaceChildren();
      } else {
        while (this.cardsListElement.firstChild) {
          this.cardsListElement.removeChild(this.cardsListElement.firstChild);
        }
      }
      if (filtered.length === 0) {
        if (this.emptyStateElement) this.emptyStateElement.classList.remove("yt-misinfo-hidden");
        return;
      }
      if (this.emptyStateElement) this.emptyStateElement.classList.add("yt-misinfo-hidden");
      filtered.forEach((claim) => {
        const card = document.createElement("article");
        card.className = `yt-misinfo-timeline-card yt-misinfo-card yt-misinfo-timeline-card--${claim.verdict}`;
        card.setAttribute("role", "listitem");
        card.setAttribute("tabindex", "0");
        card.dataset.timestamp = String(claim.timestamp);
        card.dataset.verdict = claim.verdict;
        if (this.activeClaim && this.activeClaim.timestamp === claim.timestamp) {
          card.classList.add("yt-misinfo-card--active", "is-active");
        }
        const topRow = document.createElement("div");
        topRow.className = "yt-misinfo-card-row-top";
        const tsPill = document.createElement("button");
        tsPill.type = "button";
        tsPill.className = "yt-misinfo-ts-pill";
        tsPill.title = `Jump to ${formatTimestamp(claim.timestamp)}`;
        tsPill.textContent = `\u25B6 ${formatTimestamp(claim.timestamp)}`;
        const badge = document.createElement("span");
        badge.className = `yt-misinfo-badge yt-misinfo-badge--${claim.verdict} badge-${claim.verdict}`;
        badge.textContent = claim.verdict === "misinformation" ? "Misinformation" : claim.verdict === "verified" ? "Verified" : "Unverified";
        topRow.appendChild(tsPill);
        topRow.appendChild(badge);
        const quote = document.createElement("p");
        quote.className = "yt-misinfo-card-quote";
        quote.textContent = `\u201C${claim.sentence}\u201D`;
        const desc = document.createElement("p");
        desc.className = "yt-misinfo-card-desc";
        desc.textContent = claim.explanation;
        card.appendChild(topRow);
        card.appendChild(quote);
        card.appendChild(desc);
        if (claim.sources && Array.isArray(claim.sources) && claim.sources.length > 0) {
          const sourcesDiv = document.createElement("div");
          sourcesDiv.className = "yt-misinfo-card-sources";
          const label = document.createElement("span");
          label.className = "yt-misinfo-sources-label";
          label.textContent = "Sources:";
          sourcesDiv.appendChild(label);
          claim.sources.forEach((src) => {
            if (typeof src === "string" && /^https?:\/\//i.test(src.trim())) {
              const link = document.createElement("a");
              link.className = "yt-misinfo-source-link";
              link.href = src.trim();
              link.setAttribute("href", src.trim());
              link.target = "_blank";
              link.setAttribute("target", "_blank");
              link.rel = "noopener noreferrer";
              try {
                link.textContent = new URL(src.trim()).hostname.replace(/^www\./, "");
              } catch {
                link.textContent = "source";
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
      const cards = this.cardsListElement.querySelectorAll(".yt-misinfo-timeline-card");
      cards.forEach((card) => {
        const ts = parseFloat(card.dataset.timestamp);
        if (activeClaim && ts === activeClaim.timestamp) {
          if (!card.classList.contains("yt-misinfo-card--active")) {
            card.classList.add("yt-misinfo-card--active", "is-active");
            if (this.isOpenState && typeof card.scrollIntoView === "function") {
              card.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }
        } else {
          card.classList.remove("yt-misinfo-card--active", "is-active");
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
        const chips = this.root.querySelectorAll(".yt-misinfo-filter-chip");
        chips.forEach((chip) => {
          if (chip.dataset.filter === filter) {
            chip.classList.add("yt-misinfo-filter-chip--active");
          } else {
            chip.classList.remove("yt-misinfo-filter-chip--active");
          }
        });
      }
      this.render();
    }
    open() {
      this.isOpenState = true;
      if (this.panelElement) {
        this.panelElement.classList.remove("yt-misinfo-drawer-panel--collapsed", "is-collapsed");
        this.panelElement.setAttribute("aria-expanded", "true");
      }
      if (this.activeClaim) {
        this.setActiveClaim(this.activeClaim);
      }
    }
    close() {
      this.isOpenState = false;
      if (this.panelElement) {
        this.panelElement.classList.add("yt-misinfo-drawer-panel--collapsed", "is-collapsed");
        this.panelElement.setAttribute("aria-expanded", "false");
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
  };

  // src/storage.js
  var STORAGE_KEYS = Object.freeze({
    SETTINGS: "yt_misinfo_settings"
  });
  var DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    showOverlays: true,
    filterVerdict: "all"
    // 'all' | 'misinformation' | 'verified' | 'unknown'
  });
  function hasChromeStorage() {
    return typeof chrome !== "undefined" && Boolean(chrome.storage) && Boolean(chrome.storage.local) && typeof chrome.storage.local.get === "function";
  }
  var memoryStore = {};
  var memoryListeners = /* @__PURE__ */ new Set();
  async function getSettings() {
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
          const saved2 = result && result[STORAGE_KEYS.SETTINGS];
          resolve({ ...DEFAULT_SETTINGS, ...saved2 || {} });
        });
      });
    }
    const saved = memoryStore[STORAGE_KEYS.SETTINGS];
    return { ...DEFAULT_SETTINGS, ...saved || {} };
  }
  function onSettingsChanged(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("onSettingsChanged callback must be a function.");
    }
    if (hasChromeStorage() && chrome.storage.onChanged) {
      const chromeListener = (changes, areaName) => {
        if (areaName === "local" && changes[STORAGE_KEYS.SETTINGS]) {
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

  // src/content.js
  var activeVideoId = null;
  var currentClaims = [];
  var currentSettings = { enabled: true, showOverlays: true, filterVerdict: "all" };
  var overlayManager = null;
  var drawerManager = null;
  var activeVideoElement = null;
  var isSeeking = false;
  var checkObserver = null;
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
    if (typeof document !== "undefined") {
      document.addEventListener("yt-navigate-finish", handleNavigation);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", handleNavigation);
      setInterval(handleNavigation, 1e3);
    }
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request && request.action === "GET_VIDEO_STATS") {
          const stats = computeVideoStats();
          sendResponse(stats);
        }
        return true;
      });
    }
    handleNavigation();
  }
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
      misinformation: currentClaims.filter((c) => c.verdict === "misinformation").length,
      verified: currentClaims.filter((c) => c.verdict === "verified").length,
      unknown: currentClaims.filter((c) => c.verdict === "unknown").length
    };
  }
  async function handleNavigation() {
    if (typeof window === "undefined") return;
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
  function teardownSession() {
    if (activeVideoElement) {
      activeVideoElement.removeEventListener("timeupdate", onTimeUpdate);
      activeVideoElement.removeEventListener("seeking", onSeeking);
      activeVideoElement.removeEventListener("seeked", onSeeked);
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
    const indicator = document.getElementById("yt-misinfo-status-badge");
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
    activeVideoId = null;
    currentClaims = [];
    isSeeking = false;
  }
  async function startVideoSession(videoId) {
    teardownSession();
    activeVideoId = videoId;
    try {
      currentClaims = await getClaimsForVideo(videoId);
    } catch (err) {
      console.error("[YouTube Misinformation Detector] Failed to load claims:", err);
      currentClaims = [];
    }
    const videoElement = await waitForVideoElement(5e3);
    if (!videoElement || activeVideoId !== videoId) return;
    activeVideoElement = videoElement;
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
    mountStatusIndicator(videoId, currentClaims.length);
    activeVideoElement.addEventListener("timeupdate", onTimeUpdate);
    activeVideoElement.addEventListener("seeking", onSeeking);
    activeVideoElement.addEventListener("seeked", onSeeked);
  }
  function mountStatusIndicator(videoId, count) {
    let indicator = document.getElementById("yt-misinfo-status-badge");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "yt-misinfo-status-badge";
      indicator.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 999999;
      background: #0f0f0f;
      color: #fff;
      border: 1px solid #ff4d4f;
      border-radius: 20px;
      padding: 8px 16px;
      font-family: Roboto, Arial, sans-serif;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      cursor: pointer;
    `;
      indicator.title = "Click to open claims timeline drawer";
      indicator.addEventListener("click", () => {
        if (drawerManager) drawerManager.open();
      });
      document.body.appendChild(indicator);
    }
    indicator.innerHTML = `
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff4d4f;box-shadow:0 0 8px #ff4d4f;animation:ytPulse 1.5s infinite;"></span>
    <span>\u{1F6E1}\uFE0F Misinfo Detector Active (${count} claims)</span>
  `;
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
  if (typeof window !== "undefined") {
    init().catch((err) => console.error("[YouTube Misinformation Detector] Init error:", err));
  }
})();
