/**
 * Content script to extract clean readable text and user selection from the active web page.
 */

/**
 * Extracts visible, readable text content from the document body,
 * omitting non-visible elements like script, style, svg, etc.
 *
 * @returns {string} Clean visible text.
 */
function getVisiblePageText() {
  const root = document.body || document.documentElement;
  if (!root) return '';

  const clone = root.cloneNode(true);

  // Remove elements that don't contribute to readable content
  const elementsToRemove = clone.querySelectorAll(
    'script, style, noscript, svg, canvas, iframe, audio, video, nav, footer, template, [aria-hidden="true"]'
  );
  elementsToRemove.forEach((el) => el.remove());

  return clone.innerText || clone.textContent || '';
}

/**
 * Gathers page metadata and content.
 *
 * @returns {Object} Extracted data.
 */
function extractPageData() {
  const selection = window.getSelection ? window.getSelection().toString().trim() : '';
  const fullText = getVisiblePageText();

  return {
    url: window.location.href,
    title: document.title || 'Untitled Page',
    selection: selection,
    hasSelection: selection.length > 0,
    fullText: fullText
  };
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PAGE_DATA') {
    const data = extractPageData();
    sendResponse(data);
  }
  return true;
});
