# PagePulse ⏱️ — Reading Stats & Quick Notes Chrome Extension

A clean, modern, and readable Manifest V3 Chrome Extension that calculates real-time reading times, word & character counts, and lets you capture instant notes for any webpage.

---

## Features

- **Accurate Reading Metrics**: Computes word counts, character counts (with/without spaces using `Intl.Segmenter` for accurate grapheme clusters and emojis), and estimated reading and speaking times.
- **Selection-Aware**: If you highlight text on any page, PagePulse automatically detects and analyzes the selection, with an instant toggle back to the full page.
- **Quick Notes & URL Pinning**: Save notes tied to the active page's URL using `chrome.storage.local`. Filter between "This Page" and "All Pages".
- **Customizable WPM Settings**: Adjust your personal reading speed (default 200 wpm) and speaking speed (default 130 wpm) with live recalculation.
- **System / Light / Dark Themes**: Clean styling adapting to OS preferences or explicit toggle.
- **Clean Architecture & Zero Bloat**: Built with vanilla ES modules, strictly separated concerns, high testability, and zero runtime dependencies.

---

## Project Structure

```
├── manifest.json            # Manifest V3 extension configuration
├── src/
│   ├── stats.js             # Pure text metric algorithms (WPM, words, unicode characters)
│   ├── storage.js           # chrome.storage.local wrapper with memory fallback
│   ├── content.js           # Content script for extracting page content & selection
│   └── background.js        # Service worker for extension lifecycle
├── popup/
│   ├── popup.html           # Accessible popup interface
│   ├── popup.css            # Modern CSS variables, card layout, dark mode
│   └── popup.js             # UI state controller & Chrome tab integration
├── icons/
│   ├── icon.svg             # Source vector icon
│   ├── icon16.png           # 16x16 icon
│   ├── icon48.png           # 48x48 icon
│   └── icon128.png          # 128x128 icon
├── tests/
│   ├── stats.test.js        # Unit tests for text calculations & edge cases
│   ├── storage.test.js      # Unit tests for storage operations & fallbacks
│   └── e2e.test.js          # End-to-end tests running in actual Google Chrome
└── package.json
```

---

### Quick Installation (One-time)

1. Open Google Chrome.
2. In the URL bar, go to `chrome://extensions`.
3. In the top-right corner, toggle **Developer mode** to ON.
4. Click the **Load unpacked** button in the top-left toolbar.
5. Select the extension directory:
   ```
   /Users/kadirpili/Documents/chrome-extension
   ```
6. The **PagePulse** extension icon (⏱️) is now active in your Chrome toolbar. Pin it to access it anytime!
*(Note: As of modern Chrome versions, Google Chrome restricts `--load-extension` via CLI for official branded builds unless Developer Mode is pre-enabled in the profile, so using the standard "Load unpacked" button in `chrome://extensions` is the official supported method).*

---

## Running the Unit & E2E Tests

### Unit Tests
Tests text analysis, unicode handling, and storage persistence using Node's native test runner:
```bash
npm test
```

### End-to-End Tests
Launches real Google Chrome via Puppeteer to verify extension loading, DOM rendering, tab switching, and interactions:
```bash
npm run test:e2e
```

### Run All Tests
```bash
npm run test:all
```
