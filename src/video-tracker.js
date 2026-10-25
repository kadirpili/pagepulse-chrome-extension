/**
 * Video Playback Tracker & Synchronizer Engine.
 * Evaluates active claims within configurable tolerance windows, executes seek jumps,
 * and detects active YouTube ad overlays.
 */

/**
 * Finds the currently active claim at a given video playback time.
 * Evaluates within [t - leadTolerance, t + duration].
 * If multiple claims overlap, prioritizes 'misinformation' verdict to ensure warning alerts fire,
 * and then prioritizes the most recently started claim.
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

  if (typeof currentTime !== 'number' || isNaN(currentTime) || !isFinite(currentTime) || currentTime < 0) {
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

    // If next claim exists, clamp end time so previous claim does not bleed indefinitely into next claim
    let endTime = claim.timestamp + duration;
    if (i < claims.length - 1 && typeof claims[i + 1]?.timestamp === 'number') {
      const nextStartTime = claims[i + 1].timestamp;
      if (nextStartTime > claim.timestamp && endTime > nextStartTime) {
        endTime = nextStartTime;
      }
    }

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

  // Otherwise, return the latest started claim
  return activeCandidates[activeCandidates.length - 1];
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

  if (autoPlay && videoElement.paused && typeof videoElement.play === 'function') {
    try {
      const playPromise = videoElement.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay policy or gesture constraint
        });
      }
    } catch {
      // Ignore autoplay errors
    }
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
    (typeof document.getElementById === 'function' && document.getElementById('movie_player')) ||
    (typeof document.querySelector === 'function' && document.querySelector('.html5-video-player'));

  if (player && player.classList && typeof player.classList.contains === 'function') {
    if (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting')
    ) {
      return true;
    }
  }

  // 2. Check for active YouTube ad overlay components
  if (typeof document.querySelector === 'function') {
    const adOverlay = document.querySelector(
      '.ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-module, .video-ads'
    );
    if (adOverlay) {
      if (adOverlay.children) {
        if (adOverlay.children.length > 0) return true;
      } else {
        return true;
      }
    }
  }

  // 3. Check video element attributes (some ad formats alter video source)
  if (typeof document.querySelector === 'function') {
    const video =
      document.querySelector('video.html5-main-video') ||
      document.querySelector('video');

    if (video && typeof video.src === 'string' && video.src) {
      if (
        video.src.includes('&adformat=') ||
        /googlevideo\.com\/videoplayback\?sparams=.*ad/.test(video.src)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Discovers the active YouTube HTML5 video element (supporting both standard Watch and Shorts pages).
 *
 * @returns {HTMLVideoElement|null}
 */
export function findActiveVideo() {
  if (typeof document === 'undefined') return null;

  const isShorts =
    typeof window !== 'undefined' &&
    window.location &&
    typeof window.location.pathname === 'string' &&
    window.location.pathname.startsWith('/shorts');

  if (isShorts) {
    // 1. Check for active reel renderer video
    const activeReel = document.querySelector('ytd-reel-video-renderer[is-active]');
    if (activeReel) {
      const v = activeReel.querySelector('video');
      if (v) return v;
    }

    // 2. Check for active shorts player
    const shortsVideo =
      document.querySelector('ytd-shorts-player[is-active] video') ||
      document.querySelector('#shorts-player video') ||
      document.querySelector('ytd-shorts-player video');
    if (shortsVideo) return shortsVideo;

    // 3. Find currently playing video on screen
    const allVideos = Array.from(document.querySelectorAll('video'));
    for (const v of allVideos) {
      if (!v.paused && v.currentTime > 0) return v;
    }
  }

  // Standard YouTube watch page selectors
  return (
    document.querySelector('ytd-reel-video-renderer[is-active] video') ||
    document.querySelector('ytd-shorts-player video') ||
    document.querySelector('video.html5-main-video') ||
    document.querySelector('#movie_player video') ||
    document.querySelector('video')
  );
}

/**
 * Discovers the active YouTube HTML5 video element with retry polling.
 *
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds.
 * @returns {Promise<HTMLVideoElement|null>} Resolves with the video element or null if timed out.
 */
export function waitForVideoElement(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      return resolve(null);
    }

    const immediate = findActiveVideo();
    if (immediate) {
      return resolve(immediate);
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const el = findActiveVideo();
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
