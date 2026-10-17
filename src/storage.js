/**
 * Storage manager for PagePulse notes and user settings.
 * Abstracted to support chrome.storage.local with an in-memory/localStorage fallback.
 */

const STORAGE_KEYS = {
  NOTES: 'pagepulse_notes',
  SETTINGS: 'pagepulse_settings'
};

const DEFAULT_SETTINGS = {
  readingWpm: 200,
  speakingWpm: 130,
  theme: 'system' // 'light' | 'dark' | 'system'
};

/**
 * Checks if the chrome.storage.local API is available in the current context.
 *
 * @returns {boolean} True if chrome storage is accessible.
 */
export function hasChromeStorage() {
  return (
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.local &&
    typeof chrome.storage.local.get === 'function'
  );
}

// In-memory fallback cache for non-extension environments (e.g. Node tests)
let memoryStore = {};

/**
 * Reset in-memory store (useful for testing).
 */
export function resetMemoryStore() {
  memoryStore = {};
}

/**
 * Generic getter from storage.
 *
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getStorageItem(key) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }
  return memoryStore[key];
}

/**
 * Generic setter to storage.
 *
 * @param {string} key
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function setStorageItem(key, value) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }
  memoryStore[key] = value;
}

/**
 * Retrieves all saved notes.
 *
 * @returns {Promise<Array<Object>>} Array of note objects.
 */
export async function getAllNotes() {
  const notes = await getStorageItem(STORAGE_KEYS.NOTES);
  return Array.isArray(notes) ? notes : [];
}

/**
 * Retrieves notes for a specific page URL.
 *
 * @param {string} url - Target URL to query.
 * @returns {Promise<Array<Object>>} Notes matching the URL.
 */
export async function getNotesForUrl(url) {
  const notes = await getAllNotes();
  if (!url) return notes;

  // Clean URL by stripping fragments and query parameters if needed, or exact match
  const cleanUrl = url.split('#')[0];
  return notes.filter((n) => n.url && n.url.split('#')[0] === cleanUrl);
}

/**
 * Saves a new note.
 *
 * @param {Object} noteData
 * @param {string} noteData.url - Page URL.
 * @param {string} noteData.title - Page title or note heading.
 * @param {string} noteData.content - Note text content.
 * @returns {Promise<Object>} Created note with id and timestamp.
 */
export async function saveNote({ url, title, content }) {
  if (!content || typeof content !== 'string' || content.trim() === '') {
    throw new Error('Note content cannot be empty.');
  }

  const notes = await getAllNotes();
  const newNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    url: url || '',
    title: (title || 'Untitled Note').trim(),
    content: content.trim(),
    createdAt: new Date().toISOString()
  };

  notes.unshift(newNote);
  await setStorageItem(STORAGE_KEYS.NOTES, notes);
  return newNote;
}

/**
 * Deletes a note by ID.
 *
 * @param {string} noteId - ID of the note to delete.
 * @returns {Promise<boolean>} True if deleted, false if not found.
 */
export async function deleteNote(noteId) {
  const notes = await getAllNotes();
  const filtered = notes.filter((n) => n.id !== noteId);

  if (filtered.length === notes.length) {
    return false;
  }

  await setStorageItem(STORAGE_KEYS.NOTES, filtered);
  return true;
}

/**
 * Retrieves user settings.
 *
 * @returns {Promise<Object>}
 */
export async function getSettings() {
  const saved = await getStorageItem(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}

/**
 * Saves user settings.
 *
 * @param {Object} newSettings
 * @returns {Promise<Object>}
 */
export async function saveSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await setStorageItem(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}
