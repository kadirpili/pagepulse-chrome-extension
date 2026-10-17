/**
 * Main content script coordinator for YouTube Misinformation Detector.
 * Runs on YouTube watch pages, handles SPA navigations, synchronizes playback with claims,
 * and mounts/unmounts overlay and drawer interfaces.
 */

import { parseYouTubeVideoId, isYouTubeWatchUrl } from './youtube-url.js';
import { getClaimsForVideo } from './claim-service.js';
import { findActiveClaim, seekToTimestamp, isAdActive, waitForVideoElement } from './video-tracker.js';
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

  // Listen to YouTube's SPA navigation lifecycle events
  if (typeof document !== 'undefined') {
    document.addEventListener('yt-navigate-finish', handleNavigation);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', handleNavigation);
    // Regular polling fallback for YouTube SPA URL changes
    setInterval(handleNavigation, 1000);
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

  if (drawerManager) {
    drawerManager.setClaims(currentClaims);
  }
  mountStatusIndicator(activeVideoId, currentClaims.length);
}

/**
 * Starts a new session for the given video ID.
 * @param {string} videoId
 */
async function startVideoSession(videoId) {
  sessionStartingForVideoId = videoId;
  teardownSession();
  activeVideoId = videoId;

  // Mount persistent status indicator immediately to show status/loading
  const isProd = currentSettings.mode === 'prod';
  mountStatusIndicator(videoId, isProd ? 'loading' : '...');

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

  // Mount persistent status indicator on page with final claims count
  mountStatusIndicator(videoId, currentClaims.length);
  sessionStartingForVideoId = null;

  // Attach video playback listeners
  activeVideoElement.addEventListener('timeupdate', onTimeUpdate);
  activeVideoElement.addEventListener('seeking', onSeeking);
  activeVideoElement.addEventListener('seeked', onSeeked);
}

/**
 * Mounts a floating indicator on YouTube to show the detector is running and processing.
 * @param {string} videoId
 * @param {number|string} countOrStatus
 */
function mountStatusIndicator(videoId, countOrStatus) {
  let indicator = document.getElementById('yt-misinfo-status-badge');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'yt-misinfo-status-badge';
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
    indicator.title = 'Click to open claims timeline drawer';
    indicator.addEventListener('click', () => {
      if (drawerManager) drawerManager.open();
    });
    document.body.appendChild(indicator);
  }

  const isProd = currentSettings.mode === 'prod';
  const modeTag = isProd ? 'PROD' : 'TEST';
  const badgeColor = isProd ? '#52c41a' : '#ff4d4f';
  indicator.style.borderColor = badgeColor;

  const countDisplay = countOrStatus === 'loading'
    ? 'Loading...'
    : typeof countOrStatus === 'number'
      ? `${countOrStatus} claims`
      : `${countOrStatus || 0} claims`;

  indicator.innerHTML = `
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${badgeColor};box-shadow:0 0 8px ${badgeColor};animation:ytPulse 1.5s infinite;"></span>
    <span>🛡️ Misinfo Detector Active [${modeTag}] (${countDisplay})</span>
  `;
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
