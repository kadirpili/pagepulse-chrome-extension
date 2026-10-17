import { analyzeText } from '../src/stats.js';
import {
  saveNote,
  getAllNotes,
  getNotesForUrl,
  deleteNote,
  getSettings,
  saveSettings
} from '../src/storage.js';

// State management
let currentTabInfo = { id: null, url: '', title: '', host: '' };
let pageData = { fullText: '', selection: '', hasSelection: false };
let userSettings = { readingWpm: 200, speakingWpm: 130, theme: 'system' };
let viewingSelection = false;
let notesFilter = 'current'; // 'current' | 'all'

// DOM Elements
const elements = {
  hostLabel: document.getElementById('page-host'),
  refreshBtn: document.getElementById('btn-refresh'),
  tabs: document.querySelectorAll('.tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  notesBadge: document.getElementById('notes-count'),
  selectionBanner: document.getElementById('selection-banner'),
  toggleScopeBtn: document.getElementById('btn-toggle-scope'),

  // Stats elements
  valReadingTime: document.getElementById('val-reading-time'),
  subReadingSpeed: document.getElementById('sub-reading-speed'),
  valWords: document.getElementById('val-words'),
  subParagraphs: document.getElementById('sub-paragraphs'),
  valCharacters: document.getElementById('val-characters'),
  subCharactersNoSpaces: document.getElementById('sub-characters-no-spaces'),
  valSpeakingTime: document.getElementById('val-speaking-time'),
  subSpeakingSpeed: document.getElementById('sub-speaking-speed'),
  copyStatsBtn: document.getElementById('btn-copy-stats'),
  copyToast: document.getElementById('copy-toast'),

  // Notes elements
  noteForm: document.getElementById('note-form'),
  noteInput: document.getElementById('note-input'),
  notesList: document.getElementById('notes-list'),
  filterCurrentBtn: document.getElementById('filter-current'),
  filterAllBtn: document.getElementById('filter-all'),

  // Settings elements
  readingWpmInput: document.getElementById('setting-reading-wpm'),
  readingWpmLabel: document.getElementById('lbl-reading-wpm'),
  speakingWpmInput: document.getElementById('setting-speaking-wpm'),
  speakingWpmLabel: document.getElementById('lbl-speaking-wpm'),
  themeSelect: document.getElementById('setting-theme')
};

/**
 * Initializes the popup: loads settings, identifies active tab, queries page content.
 */
async function initialize() {
  await loadAndApplySettings();
  setupEventListeners();
  await loadActiveTab();
  await refreshPageStats();
  await renderNotes();
}

/**
 * Loads user settings from storage and updates inputs.
 */
async function loadAndApplySettings() {
  userSettings = await getSettings();

  elements.readingWpmInput.value = userSettings.readingWpm;
  elements.readingWpmLabel.textContent = `${userSettings.readingWpm} wpm`;
  elements.speakingWpmInput.value = userSettings.speakingWpm;
  elements.speakingWpmLabel.textContent = `${userSettings.speakingWpm} wpm`;
  elements.themeSelect.value = userSettings.theme;

  applyTheme(userSettings.theme);
}

/**
 * Applies the selected theme to the popup.
 */
function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/**
 * Identifies the current active browser tab.
 */
async function loadActiveTab() {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    currentTabInfo = {
      id: 1,
      url: 'https://example.com/demo-article',
      title: 'Demo Article',
      host: 'example.com'
    };
    elements.hostLabel.textContent = currentTabInfo.host;
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentTabInfo.id = tab.id;
      currentTabInfo.url = tab.url || '';
      currentTabInfo.title = tab.title || 'Untitled';
      try {
        const parsed = new URL(tab.url);
        currentTabInfo.host = parsed.hostname;
      } catch {
        currentTabInfo.host = tab.url ? tab.url.slice(0, 30) : 'Local / Internal';
      }
      elements.hostLabel.textContent = currentTabInfo.host;
    }
  } catch (err) {
    console.error('Failed to get active tab:', err);
    elements.hostLabel.textContent = 'Active Page';
  }
}

/**
 * Requests page content from the content script or executes fallback script injection.
 */
async function refreshPageStats() {
  if (!currentTabInfo.id || !currentTabInfo.url.startsWith('http')) {
    // If not a valid web page (e.g. chrome:// or internal page or mock environment)
    if (!pageData.fullText) {
      pageData.fullText = document.body ? document.body.innerText : '';
    }
    updateStatsDisplay();
    return;
  }

  try {
    // Try sending message to existing content script
    const response = await chrome.tabs.sendMessage(currentTabInfo.id, { action: 'GET_PAGE_DATA' });
    if (response) {
      handlePageDataResponse(response);
      return;
    }
  } catch {
    // Content script might not be injected yet, attempt dynamic execution
    try {
      if (typeof chrome !== 'undefined' && chrome.scripting && typeof chrome.scripting.executeScript === 'function') {
        const results = await chrome.scripting.executeScript({
          target: { tabId: currentTabInfo.id },
          func: () => {
            const selection = window.getSelection ? window.getSelection().toString().trim() : '';
            const root = document.body || document.documentElement;
            if (!root) {
              return { url: window.location.href, title: document.title, selection, hasSelection: selection.length > 0, fullText: '' };
            }
            const clone = root.cloneNode(true);
            const removeSelectors = 'script, style, noscript, svg, canvas, iframe, audio, video, nav, footer, template, [aria-hidden="true"]';
            clone.querySelectorAll(removeSelectors).forEach((el) => el.remove());
            return {
              url: window.location.href,
              title: document.title,
              selection: selection,
              hasSelection: selection.length > 0,
              fullText: clone.innerText || clone.textContent || ''
            };
          }
        });

        if (results && results[0] && results[0].result) {
          handlePageDataResponse(results[0].result);
          return;
        }
      }
      updateStatsDisplay();
    } catch (injectErr) {
      console.warn('Unable to extract page text:', injectErr);
      elements.hostLabel.textContent = 'Limited page access';
      updateStatsDisplay();
    }
  }
}

/**
 * Handles extracted page content data.
 */
function handlePageDataResponse(data) {
  pageData = data;
  if (data.title) {
    currentTabInfo.title = data.title;
  }

  if (pageData.hasSelection) {
    viewingSelection = true;
    elements.selectionBanner.classList.remove('hidden');
    elements.selectionBanner.querySelector('span').textContent = 'Analyzing selected text';
    elements.toggleScopeBtn.textContent = 'Switch to full page';
  } else {
    viewingSelection = false;
    elements.selectionBanner.classList.add('hidden');
  }

  updateStatsDisplay();
}

/**
 * Computes and renders stats on the UI.
 */
function updateStatsDisplay() {
  const textToAnalyze = viewingSelection ? pageData.selection : pageData.fullText;
  const metrics = analyzeText(textToAnalyze || '', {
    readingWpm: userSettings.readingWpm,
    speakingWpm: userSettings.speakingWpm
  });

  elements.valReadingTime.textContent = metrics.readingTime;
  elements.subReadingSpeed.textContent = `at ${userSettings.readingWpm} wpm`;

  elements.valWords.textContent = metrics.words.toLocaleString();
  elements.subParagraphs.textContent = `${metrics.paragraphs} paragraph${metrics.paragraphs === 1 ? '' : 's'}`;

  elements.valCharacters.textContent = metrics.characters.toLocaleString();
  elements.subCharactersNoSpaces.textContent = `${metrics.charactersNoSpaces.toLocaleString()} no spaces`;

  elements.valSpeakingTime.textContent = metrics.speakingTime;
  elements.subSpeakingSpeed.textContent = `at ${userSettings.speakingWpm} wpm`;
}

/**
 * Renders notes list based on the active filter.
 */
async function renderNotes() {
  const allNotes = await getAllNotes();
  const pageNotes = currentTabInfo.url ? await getNotesForUrl(currentTabInfo.url) : [];

  elements.notesBadge.textContent = pageNotes.length.toString();

  const notesToDisplay = notesFilter === 'current' ? pageNotes : allNotes;

  if (notesToDisplay.length === 0) {
    elements.notesList.innerHTML = `
      <div class="empty-state">
        ${notesFilter === 'current' ? 'No notes for this page yet.' : 'No notes saved yet.'}
      </div>
    `;
    return;
  }

  elements.notesList.innerHTML = notesToDisplay
    .map((note) => {
      const date = new Date(note.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="note-item" data-id="${escapeHtml(note.id)}">
          <div class="note-item-meta">
            <span class="note-date">${escapeHtml(date)}</span>
            ${notesFilter === 'all' && note.title ? `<span class="note-title">${escapeHtml(note.title.slice(0, 25))}</span>` : ''}
          </div>
          <div class="note-item-content">${escapeHtml(note.content)}</div>
          <div class="note-item-actions">
            <button class="note-action-btn btn-copy-note" data-id="${escapeHtml(note.id)}">Copy</button>
            <button class="note-action-btn delete btn-delete-note" data-id="${escapeHtml(note.id)}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Escapes HTML characters for safety.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sets up all DOM interactions and event listeners.
 */
function setupEventListeners() {
  // Tab switching
  elements.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      elements.tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      elements.tabPanes.forEach((p) => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const paneId = `tab-${tab.dataset.tab}`;
      const targetPane = document.getElementById(paneId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // Refresh stats
  elements.refreshBtn.addEventListener('click', async () => {
    await refreshPageStats();
  });

  // Scope toggle (Selection vs Page)
  elements.toggleScopeBtn.addEventListener('click', () => {
    viewingSelection = !viewingSelection;
    if (viewingSelection) {
      elements.selectionBanner.querySelector('span').textContent = 'Analyzing selected text';
      elements.toggleScopeBtn.textContent = 'Switch to full page';
    } else {
      elements.selectionBanner.querySelector('span').textContent = 'Analyzing full page';
      elements.toggleScopeBtn.textContent = 'Switch to selection';
    }
    updateStatsDisplay();
  });

  // Copy stats
  elements.copyStatsBtn.addEventListener('click', async () => {
    const textToAnalyze = viewingSelection ? pageData.selection : pageData.fullText;
    const metrics = analyzeText(textToAnalyze || '', {
      readingWpm: userSettings.readingWpm,
      speakingWpm: userSettings.speakingWpm
    });

    const summary = [
      `PagePulse Analysis: ${currentTabInfo.title || 'Page'}`,
      `Reading Time: ${metrics.readingTime} (@ ${userSettings.readingWpm} wpm)`,
      `Words: ${metrics.words.toLocaleString()}`,
      `Characters: ${metrics.characters.toLocaleString()}`,
      `Speaking Time: ${metrics.speakingTime} (@ ${userSettings.speakingWpm} wpm)`,
      `Scope: ${viewingSelection ? 'Selected Text' : 'Full Page'}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      showToast();
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = summary;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast();
    }
  });

  // Save note
  elements.noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = elements.noteInput.value.trim();
    if (!content) return;

    await saveNote({
      url: currentTabInfo.url || 'general',
      title: currentTabInfo.title || 'Note',
      content: content
    });

    elements.noteInput.value = '';
    await renderNotes();
  });

  // Note list actions (Copy / Delete delegation)
  elements.notesList.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('.btn-copy-note');
    if (copyBtn) {
      const noteId = copyBtn.dataset.id;
      const notes = await getAllNotes();
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        await navigator.clipboard.writeText(note.content);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 1200);
      }
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete-note');
    if (deleteBtn) {
      const noteId = deleteBtn.dataset.id;
      await deleteNote(noteId);
      await renderNotes();
    }
  });

  // Notes filters
  elements.filterCurrentBtn.addEventListener('click', () => {
    notesFilter = 'current';
    elements.filterCurrentBtn.classList.add('active');
    elements.filterAllBtn.classList.remove('active');
    renderNotes();
  });

  elements.filterAllBtn.addEventListener('click', () => {
    notesFilter = 'all';
    elements.filterAllBtn.classList.add('active');
    elements.filterCurrentBtn.classList.remove('active');
    renderNotes();
  });

  // Settings inputs
  elements.readingWpmInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    elements.readingWpmLabel.textContent = `${val} wpm`;
    userSettings.readingWpm = val;
    updateStatsDisplay();
  });

  elements.readingWpmInput.addEventListener('change', async (e) => {
    await saveSettings({ readingWpm: parseInt(e.target.value, 10) });
  });

  elements.speakingWpmInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    elements.speakingWpmLabel.textContent = `${val} wpm`;
    userSettings.speakingWpm = val;
    updateStatsDisplay();
  });

  elements.speakingWpmInput.addEventListener('change', async (e) => {
    await saveSettings({ speakingWpm: parseInt(e.target.value, 10) });
  });

  elements.themeSelect.addEventListener('change', async (e) => {
    const theme = e.target.value;
    userSettings.theme = theme;
    applyTheme(theme);
    await saveSettings({ theme });
  });
}

function showToast() {
  elements.copyToast.classList.remove('hidden');
  setTimeout(() => {
    elements.copyToast.classList.add('hidden');
  }, 1600);
}

// Start popup logic on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
