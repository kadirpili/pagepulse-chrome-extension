import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..');

test('Chrome Extension E2E in real Google Chrome', async (t) => {
  let browser;

  t.before(async () => {
    browser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--allow-file-access-from-files',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`
      ]
    });
  });

  t.after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  await t.test('Chrome launches with extension directory configured', async () => {
    // Assert browser is running with clean target session
    assert.ok(browser, 'Browser instance is running');
    const pages = await browser.pages();
    assert.ok(pages.length >= 1, 'Initial browser tab is open');
  });

  await t.test('Popup UI loads, renders, and handles user interactions without errors', async () => {
    const page = await browser.newPage();
    const errorLogs = [];
    page.on('pageerror', (err) => errorLogs.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text());
      }
    });

    // Navigate to popup HTML
    const popupUrl = `file://${path.join(EXTENSION_PATH, 'popup', 'popup.html')}`;
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

    // Verify title and main elements
    const title = await page.title();
    assert.equal(title, 'PagePulse - Reading Stats & Notes');

    // Verify metric elements exist
    const readingTimeEl = await page.$('#val-reading-time');
    assert.ok(readingTimeEl, 'Reading time element exists');

    const wordsEl = await page.$('#val-words');
    assert.ok(wordsEl, 'Words element exists');

    // Test tab navigation
    await page.click('button[data-tab="notes"]');
    const notesTabActive = await page.$eval('#tab-notes', (el) => el.classList.contains('active'));
    assert.equal(notesTabActive, true, 'Notes tab activated');

    // Test typing and saving a note in popup
    await page.type('#note-input', 'Test note from automated browser run');
    await page.click('#note-form button[type="submit"]');

    // Wait for note item to appear in list
    await page.waitForSelector('.note-item', { timeout: 3000 });
    const noteText = await page.$eval('.note-item-content', (el) => el.textContent.trim());
    assert.equal(noteText, 'Test note from automated browser run');

    // Test note deletion
    const deleteBtn = await page.$('.btn-delete-note');
    assert.ok(deleteBtn, 'Delete button exists on note');
    await deleteBtn.click();
    await page.waitForFunction(() => document.querySelectorAll('.note-item').length === 0);
    const emptyState = await page.$eval('.empty-state', (el) => el.textContent.trim());
    assert.ok(emptyState.includes('No notes'), 'Empty state displayed after deletion');

    // Test Stats copy button
    await page.click('button[data-tab="stats"]');
    await page.click('#btn-copy-stats');
    await page.waitForFunction(() => !document.getElementById('copy-toast').classList.contains('hidden'), { timeout: 2000 });
    const toastHidden = await page.$eval('#copy-toast', (el) => el.classList.contains('hidden'));
    assert.equal(toastHidden, false, 'Toast appears on copy');

    // Test Settings tab
    await page.click('button[data-tab="settings"]');
    const settingsTabActive = await page.$eval('#tab-settings', (el) => el.classList.contains('active'));
    assert.equal(settingsTabActive, true, 'Settings tab activated');

    // Test theme change
    await page.select('#setting-theme', 'dark');
    const dataTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert.equal(dataTheme, 'dark', 'Theme updated to dark');

    // Check for any JavaScript errors
    assert.deepEqual(errorLogs, [], `No uncaught console/page errors. Logs: ${JSON.stringify(errorLogs)}`);

    await page.close();
  });
});
