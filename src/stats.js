/**
 * Pure utility functions for text statistics and reading metrics.
 * Designed to be modular, predictable, and easily testable.
 */

/**
 * Standard reading and speaking speeds in words per minute.
 */
export const DEFAULT_READING_WPM = 200;
export const DEFAULT_SPEAKING_WPM = 130;

/**
 * Counts the number of words in a given string.
 * Accurately handles multiple spaces, newlines, tabs, and punctuation.
 *
 * @param {string} text - Input text.
 * @returns {number} Number of words.
 */
export function countWords(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return 0;
  }

  // If text contains CJK characters, use Intl.Segmenter with word granularity for linguistic accuracy
  const hasCJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
  if (hasCJK && typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    return [...segmenter.segment(text)].filter((s) => s.isWordLike).length;
  }

  // Match sequences of non-whitespace characters, filtering out lone punctuation
  const matches = text.match(/[\p{L}\p{N}\p{M}]+(?:[-'’][\p{L}\p{N}\p{M}]+)*/gu);
  return matches ? matches.length : 0;
}

/**
 * Counts the number of characters in a string.
 *
 * @param {string} text - Input text.
 * @param {Object} [options] - Configuration options.
 * @param {boolean} [options.includeSpaces=true] - Whether to count whitespace characters.
 * @returns {number} Character count.
 */
export function countCharacters(text, options = { includeSpaces: true }) {
  if (typeof text !== 'string') {
    return 0;
  }

  const targetText = options.includeSpaces ? text : text.replace(/\s+/g, '');
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...segmenter.segment(targetText)].length;
  }

  return Array.from(targetText).length;
}

/**
 * Counts the number of paragraphs in a given string.
 *
 * @param {string} text - Input text.
 * @returns {number} Paragraph count.
 */
export function countParagraphs(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return 0;
  }

  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0).length;
}

/**
 * Calculates estimated reading time.
 *
 * @param {number} wordCount - Total number of words.
 * @param {number} [wpm=DEFAULT_READING_WPM] - Words per minute speed.
 * @returns {{ minutes: number, seconds: number, text: string }} Formatted reading time.
 */
export function calculateReadingTime(wordCount, wpm = DEFAULT_READING_WPM) {
  const safeWordCount = Math.max(0, Number(wordCount) || 0);
  const safeWpm = Math.max(1, Number(wpm) || DEFAULT_READING_WPM);

  const totalSeconds = Math.round((safeWordCount / safeWpm) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  let text;
  if (totalSeconds < 30 && safeWordCount > 0) {
    text = '< 1 min';
  } else if (minutes === 0) {
    text = `${seconds}s`;
  } else if (seconds === 0) {
    text = `${minutes} min`;
  } else {
    text = `${minutes}m ${seconds}s`;
  }

  return { minutes, seconds, totalSeconds, text };
}

/**
 * Calculates estimated speaking time.
 *
 * @param {number} wordCount - Total number of words.
 * @param {number} [wpm=DEFAULT_SPEAKING_WPM] - Words per minute speaking rate.
 * @returns {{ minutes: number, seconds: number, text: string }} Formatted speaking time.
 */
export function calculateSpeakingTime(wordCount, wpm = DEFAULT_SPEAKING_WPM) {
  return calculateReadingTime(wordCount, wpm);
}

/**
 * Generates an excerpt of the text up to a maximum length.
 *
 * @param {string} text - Input text.
 * @param {number} [maxLength=140] - Maximum character length.
 * @returns {string} Truncated text with ellipsis if needed.
 */
export function extractTextSummary(text, maxLength = 140) {
  if (typeof text !== 'string') {
    return '';
  }

  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxLength) {
    return clean;
  }

  return clean.slice(0, maxLength).trimEnd() + '...';
}

/**
 * Computes all text metrics in a single aggregated object.
 *
 * @param {string} text - Input text.
 * @param {Object} [options] - Options like custom reading WPM.
 * @returns {Object} Comprehensive metrics.
 */
export function analyzeText(text, options = {}) {
  const words = countWords(text);
  const charactersWithSpaces = countCharacters(text, { includeSpaces: true });
  const charactersWithoutSpaces = countCharacters(text, { includeSpaces: false });
  const paragraphs = countParagraphs(text);
  const reading = calculateReadingTime(words, options.readingWpm);
  const speaking = calculateSpeakingTime(words, options.speakingWpm);

  return {
    words,
    characters: charactersWithSpaces,
    charactersNoSpaces: charactersWithoutSpaces,
    paragraphs,
    readingTime: reading.text,
    readingSeconds: reading.totalSeconds,
    speakingTime: speaking.text,
    speakingSeconds: speaking.totalSeconds
  };
}
