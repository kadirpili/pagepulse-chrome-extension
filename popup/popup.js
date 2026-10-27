import { getSettings, saveSettings } from '../src/storage.js';
import { parseYouTubeVideoId, isYouTubeWatchUrl } from '../src/youtube-url.js';
import { trackEvent } from '../src/analytics.js';

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
  selectFilter: document.getElementById('select-filter'),
  selectMode: document.getElementById('select-mode')
};

async function initPopup() {
  const settings = await getSettings();
  if (dom.toggleEnabled) dom.toggleEnabled.checked = settings.enabled;
  if (dom.toggleOverlays) dom.toggleOverlays.checked = settings.showOverlays;
  if (dom.selectFilter) dom.selectFilter.value = settings.filterVerdict || 'all';
  if (dom.selectMode) dom.selectMode.value = settings.mode || 'test';

  setupEventListeners();
  await queryCurrentTab();
}

function setupEventListeners() {
  if (dom.toggleEnabled) {
    dom.toggleEnabled.addEventListener('change', async () => {
      const enabled = dom.toggleEnabled.checked;
      await saveSettings({ enabled });
      trackEvent('detector_toggled', { enabled });
    });
  }

  if (dom.toggleOverlays) {
    dom.toggleOverlays.addEventListener('change', async () => {
      const showOverlays = dom.toggleOverlays.checked;
      await saveSettings({ showOverlays });
      trackEvent('overlays_toggled', { showOverlays });
    });
  }

  if (dom.selectFilter) {
    dom.selectFilter.addEventListener('change', async () => {
      const filterVerdict = dom.selectFilter.value;
      await saveSettings({ filterVerdict });
      trackEvent('filter_changed', { filterVerdict });
    });
  }

  if (dom.selectMode) {
    dom.selectMode.addEventListener('change', async () => {
      const mode = dom.selectMode.value;
      await saveSettings({ mode });
      trackEvent('mode_toggled', { mode });
    });
  }
}

async function queryCurrentTab() {
  trackEvent('popup_opened');

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

    if (!isYouTubeWatchUrl(url)) {
      showNonYouTubeView('Not a YouTube watch page');
      return;
    }

    const videoId = parseYouTubeVideoId(url);

    if (tab.id && chrome.tabs.sendMessage) {
      chrome.tabs.sendMessage(tab.id, { action: 'GET_VIDEO_STATS' }, (response) => {
        if (chrome.runtime?.lastError || !response || !response.active) {
          showActiveYouTubeView({
            videoId: videoId || 'Active',
            total: 0,
            misinformation: 0,
            verified: 0,
            unknown: 0
          });
          return;
        }

        showActiveYouTubeView(response);
      });
    } else {
      showActiveYouTubeView({
        videoId: videoId || 'Active',
        total: 0,
        misinformation: 0,
        verified: 0,
        unknown: 0
      });
    }
  } catch (err) {
    console.error('Error querying active tab:', err);
    showNonYouTubeView('Error reading tab');
  }
}

function showActiveYouTubeView(stats) {
  if (dom.statusSubtitle) dom.statusSubtitle.textContent = 'Active on video';
  if (dom.statusIndicator) dom.statusIndicator.classList.add('active');

  if (dom.emptySection) dom.emptySection.classList.add('yt-misinfo-hidden');
  if (dom.statsSection) dom.statsSection.classList.remove('yt-misinfo-hidden');

  if (dom.videoIdBadge) dom.videoIdBadge.textContent = stats.videoId || 'Active';
  if (dom.statTotal) dom.statTotal.textContent = String(stats.total || 0);
  if (dom.statMisinfo) dom.statMisinfo.textContent = String(stats.misinformation || 0);
  if (dom.statVerified) dom.statVerified.textContent = String(stats.verified || 0);
  if (dom.statUnknown) dom.statUnknown.textContent = String(stats.unknown || 0);
}

function showNonYouTubeView(reason) {
  if (dom.statusSubtitle) dom.statusSubtitle.textContent = reason;
  if (dom.statusIndicator) dom.statusIndicator.classList.remove('active');

  if (dom.statsSection) dom.statsSection.classList.add('yt-misinfo-hidden');
  if (dom.emptySection) dom.emptySection.classList.remove('yt-misinfo-hidden');
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initPopup);
}
