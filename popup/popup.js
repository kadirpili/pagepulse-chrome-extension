import { getSettings, saveSettings } from '../src/storage.js';
import { parseYouTubeVideoId, isYouTubeWatchUrl } from '../src/youtube-url.js';

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
  if (dom.toggleEnabled) dom.toggleEnabled.checked = settings.enabled;
  if (dom.toggleOverlays) dom.toggleOverlays.checked = settings.showOverlays;
  if (dom.selectFilter) dom.selectFilter.value = settings.filterVerdict || 'all';

  setupEventListeners();
  await queryCurrentTab();
}

function setupEventListeners() {
  if (dom.toggleEnabled) {
    dom.toggleEnabled.addEventListener('change', async () => {
      await saveSettings({ enabled: dom.toggleEnabled.checked });
    });
  }

  if (dom.toggleOverlays) {
    dom.toggleOverlays.addEventListener('change', async () => {
      await saveSettings({ showOverlays: dom.toggleOverlays.checked });
    });
  }

  if (dom.selectFilter) {
    dom.selectFilter.addEventListener('change', async () => {
      await saveSettings({ filterVerdict: dom.selectFilter.value });
    });
  }
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
