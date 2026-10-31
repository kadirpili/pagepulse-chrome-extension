/**
 * Main content script coordinator for YouTube Misinformation Detector.
 * Runs on YouTube watch pages, handles SPA navigations, synchronizes playback with claims,
 * and mounts/unmounts overlay and drawer interfaces.
 */

import { parseYouTubeVideoId, isYouTubeWatchUrl } from './youtube-url.js';
import { getClaimsForVideo, getApiState } from './claim-service.js';
import { findActiveClaim, seekToTimestamp, isAdActive, waitForVideoElement } from './video-tracker.js';
import { OverlayManager } from './overlay-manager.js';
import { DrawerManager } from './drawer-manager.js';
import { getSettings, onSettingsChanged } from './storage.js';
import { trackEvent } from './analytics.js';

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

  onSettingsChanged(async (newSettings) => {
    const prevMode = currentSettings.mode;
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
    if (prevMode !== newSettings.mode && activeVideoId) {
      await reloadClaimsForActiveVideo();
    }
  });

  // Intercept history.pushState & history.replaceState for instantaneous Shorts transitions
  if (typeof window !== 'undefined' && window.history) {
    const origPushState = window.history.pushState;
    if (typeof origPushState === 'function') {
      window.history.pushState = function (...args) {
        const ret = origPushState.apply(this, args);
        handleNavigation();
        return ret;
      };
    }

    const origReplaceState = window.history.replaceState;
    if (typeof origReplaceState === 'function') {
      window.history.replaceState = function (...args) {
        const ret = origReplaceState.apply(this, args);
        handleNavigation();
        return ret;
      };
    }
  }

  // Listen to YouTube's SPA navigation lifecycle events
  if (typeof document !== 'undefined') {
    document.addEventListener('yt-navigate-finish', handleNavigation);
    document.addEventListener('yt-page-data-updated', handleNavigation);
    document.addEventListener('yt-action', (e) => {
      const name = e?.detail?.actionName;
      if (typeof name === 'string' && (name.includes('reel') || name.includes('navigate') || name.includes('shorts'))) {
        handleNavigation();
      }
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', handleNavigation);
    // Regular polling fallback for YouTube SPA & Shorts URL changes
    setInterval(handleNavigation, 400);
  }

  // Setup message listener for popup queries
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.action === 'GET_VIDEO_STATS') {
        const stats = computeVideoStats();
        sendResponse(stats);
      }
      return true;
    });
  }

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

let sessionStartingForVideoId = null;

/**
 * Handles YouTube navigation events and SPA client-side routing.
 */
async function handleNavigation() {
  if (typeof window === 'undefined') return;

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

  // Prevent redundant session triggers if session is already active or in-flight for this video ID
  if (videoId === activeVideoId && (activeSessionValid() || sessionStartingForVideoId === videoId)) {
    return;
  }

  await startVideoSession(videoId);
}

function activeSessionValid() {
  return Boolean(activeVideoElement && overlayManager);
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

  const indicator = document.getElementById('yt-misinfo-status-badge');
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
  }

  activeVideoId = null;
  currentClaims = [];
  isSeeking = false;
  sessionStartingForVideoId = null;
}

/**
 * Reloads claims for the active video when settings (such as TEST/PROD mode) change.
 */
async function reloadClaimsForActiveVideo() {
  if (!activeVideoId) return;
  const isChinese = typeof document !== 'undefined' && /[\u4e00-\u9fa5]/.test(document.title || '');
  if (drawerManager) {
    drawerManager.setLoading('Reloading fact-checks from backend service...');
  }
  mountStatusIndicator(activeVideoId, 'loading');

  try {
    currentClaims = await getClaimsForVideo(activeVideoId, {
      isChinese,
      mode: currentSettings.mode || 'prod',
      apiEndpoint: currentSettings.apiEndpoint,
      authToken: currentSettings.apiKey
    });
  } catch (err) {
    console.error('[YouTube Misinformation Detector] Failed to reload claims:', err);
    currentClaims = [];
  }

  const apiState = getApiState(activeVideoId);
  if (apiState.status === 'error' && currentClaims.length === 0) {
    if (drawerManager) {
      drawerManager.destroy();
      drawerManager = null;
    }
    const existingDrawer = document.getElementById('yt-misinfo-drawer-root');
    if (existingDrawer) existingDrawer.remove();
    mountStatusIndicator(activeVideoId, 'error', apiState.error);
  } else if (currentClaims.length === 0) {
    if (drawerManager) {
      drawerManager.destroy();
      drawerManager = null;
    }
    const existingDrawer = document.getElementById('yt-misinfo-drawer-root');
    if (existingDrawer) existingDrawer.remove();
    mountStatusIndicator(activeVideoId, 0);
  } else {
    if (!drawerManager) {
      drawerManager = new DrawerManager();
      drawerManager.mount();
      drawerManager.onSeek((targetTime) => {
        trackEvent('timeline_seek_clicked', { videoId: activeVideoId, targetTime });
        if (activeVideoElement) {
          seekToTimestamp(activeVideoElement, targetTime);
          if (overlayManager) {
            overlayManager.resetDismissed();
          }
        }
      });
    }
    drawerManager.setClaims(currentClaims);
    mountStatusIndicator(activeVideoId, currentClaims.length);
  }
}

/**
 * Starts a new session for the given video ID.
 * Mounts the UI immediately to show active progress / loading state even before API call completes.
 * @param {string} videoId
 */
async function startVideoSession(videoId) {
  sessionStartingForVideoId = videoId;
  teardownSession();
  activeVideoId = videoId;

  // Mount UI components IMMEDIATELY so the user sees the extension is active and working
  overlayManager = new OverlayManager();
  overlayManager.mount();
  overlayManager.onViewTimeline(() => {
    trackEvent('timeline_opened_from_overlay', { videoId: activeVideoId });
    if (drawerManager && currentClaims && currentClaims.length > 0) {
      drawerManager.open();
    }
  });

  drawerManager = new DrawerManager();
  drawerManager.mount();
  drawerManager.onSeek((targetTime) => {
    trackEvent('timeline_seek_clicked', { videoId: activeVideoId, targetTime });
    if (activeVideoElement) {
      seekToTimestamp(activeVideoElement, targetTime);
      if (overlayManager) {
        overlayManager.resetDismissed();
      }
    }
  });

  // Display initial loading/working state immediately
  drawerManager.setLoading('Analyzing video transcript and screening claims with AI models...');
  mountStatusIndicator(videoId, 'loading');

  // Detect if active video is in Chinese from page title or DOM text
  const isChinese = typeof document !== 'undefined' && /[\u4e00-\u9fa5]/.test(document.title || '');

  try {
    currentClaims = await getClaimsForVideo(videoId, {
      isChinese,
      mode: currentSettings.mode || 'prod',
      apiEndpoint: currentSettings.apiEndpoint,
      authToken: currentSettings.apiKey
    });
  } catch (err) {
    console.error('[YouTube Misinformation Detector] Failed to load claims:', err);
    currentClaims = [];
  }

  // Abort if user navigated away while fetching claims
  if (activeVideoId !== videoId) return;

  const apiState = getApiState(videoId);
  if (apiState.status === 'error' && currentClaims.length === 0) {
    if (drawerManager) {
      drawerManager.destroy();
      drawerManager = null;
    }
    const existingDrawer = document.getElementById('yt-misinfo-drawer-root');
    if (existingDrawer) existingDrawer.remove();
    mountStatusIndicator(videoId, 'error', apiState.error);
  } else if (currentClaims.length === 0) {
    if (drawerManager) {
      drawerManager.destroy();
      drawerManager = null;
    }
    const existingDrawer = document.getElementById('yt-misinfo-drawer-root');
    if (existingDrawer) existingDrawer.remove();
    mountStatusIndicator(videoId, 0);
  } else {
    if (!drawerManager) {
      drawerManager = new DrawerManager();
      drawerManager.mount();
      drawerManager.onSeek((targetTime) => {
        trackEvent('timeline_seek_clicked', { videoId: activeVideoId, targetTime });
        if (activeVideoElement) {
          seekToTimestamp(activeVideoElement, targetTime);
          if (overlayManager) {
            overlayManager.resetDismissed();
          }
        }
      });
    }
    drawerManager.setClaims(currentClaims);
    if (currentSettings.filterVerdict) {
      drawerManager.setFilter(currentSettings.filterVerdict);
    }
    mountStatusIndicator(videoId, currentClaims.length);

    const isShorts =
      typeof window !== 'undefined' &&
      window.location &&
      typeof window.location.pathname === 'string' &&
      window.location.pathname.startsWith('/shorts');
    const misinfoCount = currentClaims.filter(
      (c) => c.verdict === 'misinformation' || (typeof c.score === 'number' && c.score >= 2)
    ).length;

    trackEvent('video_factchecked', {
      videoId,
      totalClaims: currentClaims.length,
      misinfoCount,
      isShorts: isShorts ? 'true' : 'false',
    });
  }

  const videoElement = await waitForVideoElement(5000);
  if (!videoElement || activeVideoId !== videoId) return;

  activeVideoElement = videoElement;
  sessionStartingForVideoId = null;

  // Attach video playback listeners
  activeVideoElement.addEventListener('timeupdate', onTimeUpdate);
  activeVideoElement.addEventListener('seeking', onSeeking);
  activeVideoElement.addEventListener('seeked', onSeeked);
}

/**
 * Mounts a floating indicator on YouTube to show the detector status (working, claims count, or error).
 * @param {string} videoId
 * @param {number|string} countOrStatus - Number of claims, 'loading', or 'error'
 * @param {string} [errorMessage] - Optional error details
 */
function mountStatusIndicator(videoId, countOrStatus, errorMessage = '') {
  const isShorts =
    typeof window !== 'undefined' &&
    window.location &&
    typeof window.location.pathname === 'string' &&
    window.location.pathname.startsWith('/shorts');

  let indicator = document.getElementById('yt-misinfo-status-badge');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'yt-misinfo-status-badge';
    indicator.style.cssText = `
      position: fixed;
      bottom: ${isShorts ? '90px' : '24px'};
      left: ${isShorts ? '16px' : '24px'};
      z-index: 999999;
      background: #0f0f0f;
      color: #fff;
      border: 1px solid #3ea6ff;
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
      transition: all 0.2s ease;
    `;
    indicator.title = 'Click to open claims timeline drawer';
    indicator.addEventListener('click', () => {
      if (drawerManager && currentClaims && currentClaims.length > 0) {
        drawerManager.open();
      }
    });
    document.body.appendChild(indicator);
  } else {
    indicator.style.bottom = isShorts ? '90px' : '24px';
    indicator.style.left = isShorts ? '16px' : '24px';
  }

  const isProd = currentSettings.mode === 'prod';
  const modeTag = isProd ? 'PROD' : 'TEST';

  if (countOrStatus === 'loading') {
    indicator.style.borderColor = '#faad14';
    indicator.innerHTML = `
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#faad14;box-shadow:0 0 8px #faad14;animation:ytPulse 1.2s infinite;"></span>
      <span>⏳ Misinfo Detector [${modeTag}]: Analyzing Video...</span>
    `;
  } else if (countOrStatus === 'error') {
    indicator.style.borderColor = '#ff4d4f';
    const shortErr = errorMessage ? `: ${errorMessage.slice(0, 32)}...` : '';
    indicator.innerHTML = `
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff4d4f;box-shadow:0 0 8px #ff4d4f;"></span>
      <span>⚠️ Misinfo Detector [${modeTag}] Error${shortErr} (click to view)</span>
    `;
  } else {
    const badgeColor = isProd ? '#52c41a' : '#3ea6ff';
    indicator.style.borderColor = badgeColor;
    const num = typeof countOrStatus === 'number' ? countOrStatus : 0;
    indicator.innerHTML = `
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${badgeColor};box-shadow:0 0 8px ${badgeColor};"></span>
      <span>🛡️ Misinfo Detector Active [${modeTag}] (${num} claims)</span>
    `;
  }
}

function onSeeking() {
  isSeeking = true;
  if (overlayManager) {
    overlayManager.hide(true);
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

// Start content script
if (typeof window !== 'undefined') {
  init().catch((err) => console.error('[YouTube Misinformation Detector] Init error:', err));
}
