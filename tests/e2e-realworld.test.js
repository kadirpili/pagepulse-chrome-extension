import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..');

test('YouTube Misinformation Detector - Real-World Scenarios (Tier 4)', async (t) => {
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

  const setupPageForTestMode = async (page) => {
    await page.evaluateOnNewDocument(() => {
      window.chrome = window.chrome || {};
      window.chrome.storage = {
        local: {
          get: (keys, cb) => cb({ yt_misinfo_settings: { mode: 'test', enabled: true, showOverlays: true } }),
          set: (data, cb) => cb && cb()
        }
      };
    });
  };

  // =========================================================================
  // Scenario 1: Client-Side SPA Navigation Without Page Reload
  // =========================================================================
  await t.test('Scenario 1: Client-side SPA navigation updates session without reload', async () => {
    const page = await browser.newPage();
    await setupPageForTestMode(page);
    const errorLogs = [];
    page.on('pageerror', (err) => errorLogs.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errorLogs.push(msg.text());
    });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('youtube.com/watch')) {
        req.respond({
          status: 200,
          contentType: 'text/html',
          body: `<!DOCTYPE html>
<html>
<head><title>Simulated YouTube SPA</title></head>
<body>
  <div id="movie_player" class="html5-video-player" style="position:relative; width:800px; height:450px;">
    <video class="html5-main-video"></video>
  </div>
</body>
</html>`
        });
      } else {
        req.respond({ status: 204, body: '' });
      }
    });

    // Start on Video A (dQw4w9WgXcQ - 4 seeded claims)
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ path: path.join(EXTENSION_PATH, 'src', 'styles.css') });
    await page.addScriptTag({ path: path.join(EXTENSION_PATH, 'src', 'content-bundle.js') });

    await page.waitForSelector('#yt-misinfo-status-badge', { timeout: 4000 });
    const badgeTextVideoA = await page.$eval('#yt-misinfo-status-badge', (el) => el.textContent.trim());
    assert.match(badgeTextVideoA, /🛡️ Misinfo Detector Active.*\(4 claims\)/, 'Initial Video A has 4 claims');

    // 1A. Trigger YouTube client-side SPA navigation via yt-navigate-finish to Video B (M7lc1UVf-VE - 2 seeded claims)
    await page.evaluate(() => {
      window.history.pushState({}, '', 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
      document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
    });

    await page.waitForFunction(
      () => {
        const badge = document.getElementById('yt-misinfo-status-badge');
        return badge && badge.textContent.includes('(2 claims)');
      },
      { timeout: 4000 }
    );

    const badgeTextVideoB = await page.$eval('#yt-misinfo-status-badge', (el) => el.textContent.trim());
    assert.match(badgeTextVideoB, /🛡️ Misinfo Detector Active.*\(2 claims\)/, 'SPA transition updated claims to 2');

    const drawerCardsCountB = await page.$$eval('.yt-misinfo-timeline-card', (cards) => cards.length);
    assert.equal(drawerCardsCountB, 2, 'Drawer now contains exactly 2 cards for Video B');

    // 1B. Test 1-second interval SPA navigation fallback without yt-navigate-finish event
    // Navigate to arbitrary video ID using history.pushState only
    const fallbackVideoId = 'xyz98765432';
    await page.evaluate((id) => {
      window.history.pushState({}, '', `https://www.youtube.com/watch?v=${id}`);
    }, fallbackVideoId);

    // Wait for the 1-second polling fallback in content.js to detect the URL change
    await page.waitForFunction(
      () => {
        const badge = document.getElementById('yt-misinfo-status-badge');
        // Fallback generator creates 3 to 6 claims for arbitrary video IDs
        return badge && !badge.textContent.includes('(2 claims)');
      },
      { timeout: 3500 }
    );

    const badgeTextFallback = await page.$eval('#yt-misinfo-status-badge', (el) => el.textContent.trim());
    assert.ok(
      badgeTextFallback.includes('🛡️ Misinfo Detector Active'),
      `Fallback interval detected SPA change and generated claims: ${badgeTextFallback}`
    );

    const fallbackCards = await page.$$('.yt-misinfo-timeline-card');
    assert.ok(fallbackCards.length >= 3 && fallbackCards.length <= 6, 'Deterministic fallback claims rendered in drawer');

    assert.deepEqual(errorLogs, [], 'No uncaught errors during SPA navigation');
    await page.close();
  });

  // =========================================================================
  // Scenario 2: Playback Progression Across Consecutive Claims
  // =========================================================================
  await t.test('Scenario 2: Playback progress through multiple claims & active card highlighting', async () => {
    const page = await browser.newPage();
    await setupPageForTestMode(page);
    const errorLogs = [];
    page.on('pageerror', (err) => errorLogs.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errorLogs.push(msg.text());
    });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('youtube.com/watch')) {
        req.respond({
          status: 200,
          contentType: 'text/html',
          body: `<!DOCTYPE html>
<html>
<body>
  <div id="movie_player" class="html5-video-player" style="position:relative; width:800px; height:450px;">
    <video class="html5-main-video"></video>
  </div>
</body>
</html>`
        });
      } else {
        req.respond({ status: 204, body: '' });
      }
    });

    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ path: path.join(EXTENSION_PATH, 'src', 'styles.css') });
    await page.addScriptTag({ path: path.join(EXTENSION_PATH, 'src', 'content-bundle.js') });

    await page.waitForSelector('#yt-misinfo-status-badge', { timeout: 4000 });

    // Open drawer to inspect active card highlights
    await page.click('#yt-misinfo-status-badge');
    await new Promise((r) => setTimeout(r, 350));

    // Step 1: t = 0.0s (no claim active)
    await page.evaluate(() => {
      const v = document.querySelector('video.html5-main-video');
      v.currentTime = 0.0;
      v.dispatchEvent(new Event('timeupdate'));
    });
    const overlayAt0 = await page.$('#yt-misinfo-overlay-root .yt-misinfo-card');
    assert.equal(overlayAt0, null, 'No overlay at t=0');
    const activeCardsAt0 = await page.$$('.yt-misinfo-timeline-card.is-active');
    assert.equal(activeCardsAt0.length, 0, 'No active card at t=0');

    // Step 2: t = 12.0s (Claim 1 active: misinformation)
    await page.evaluate(() => {
      const v = document.querySelector('video.html5-main-video');
      v.currentTime = 12.0;
      v.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForSelector('#yt-misinfo-overlay-root .yt-misinfo-card', { timeout: 2000 });
    const isCard1Active = await page.$eval('.yt-misinfo-timeline-card[data-timestamp="12"]', (el) =>
      el.classList.contains('is-active')
    );
    assert.equal(isCard1Active, true, 'Drawer card 1 is highlighted as active at t=12');

    // Step 3: t = 25.0s (Gap between claim 1 [12, 16.5] and claim 2 [42.5, 47.5])
    await page.evaluate(() => {
      const v = document.querySelector('video.html5-main-video');
      v.currentTime = 25.0;
      v.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForFunction(
      () => !document.querySelector('#yt-misinfo-overlay-root .yt-misinfo-card'),
      { timeout: 2000 }
    );
    const activeCardsAt25 = await page.$$('.yt-misinfo-timeline-card.is-active');
    assert.equal(activeCardsAt25.length, 0, 'Highlight cleared during gap at t=25');

    // Step 4: t = 42.5s (Claim 2 active: verified)
    await page.evaluate(() => {
      const v = document.querySelector('video.html5-main-video');
      v.currentTime = 42.5;
      v.dispatchEvent(new Event('timeupdate'));
    });
    const isCard2Active = await page.$eval('.yt-misinfo-timeline-card[data-timestamp="42.5"]', (el) =>
      el.classList.contains('is-active')
    );
    assert.equal(isCard2Active, true, 'Drawer card 2 is highlighted as active at t=42.5');
    // Verified claims do not trigger misinformation warning overlay
    const overlayAt42 = await page.$('#yt-misinfo-overlay-root .yt-misinfo-card');
    assert.equal(overlayAt42, null, 'No misinformation warning overlay for verified claim');

    // Step 5: t = 88.0s (Claim 3 active: misinformation)
    await page.evaluate(() => {
      const v = document.querySelector('video.html5-main-video');
      v.currentTime = 88.0;
      v.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForSelector('#yt-misinfo-overlay-root .yt-misinfo-card', { timeout: 2000 });
    const claim3Sentence = await page.$eval('.yt-misinfo-card-sentence', (el) => el.textContent.trim());
    assert.ok(claim3Sentence.includes('multi-million dollar film soundstage'), 'Overlay displays claim 3');
    const isCard3Active = await page.$eval('.yt-misinfo-timeline-card[data-timestamp="88"]', (el) =>
      el.classList.contains('is-active')
    );
    assert.equal(isCard3Active, true, 'Drawer card 3 is highlighted as active at t=88');

    assert.deepEqual(errorLogs, [], 'No uncaught errors during playback progression');
    await page.close();
  });

  // =========================================================================
  // Scenario 3: Auto-Dismissal When Claim Window Expires
  // =========================================================================
  await t.test('Scenario 3: Overlay auto-dismisses when claim window expires', async () => {
    const page = await browser.newPage();
    await setupPageForTestMode(page);
    const errorLogs = [];
    page.on('pageerror', (err) => errorLogs.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errorLogs.push(msg.text());
    });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('youtube.com/watch')) {
        req.respond({
          status: 200,
          contentType: 'text/html',
          body: `<!DOCTYPE html><html><body><div id="movie_player"><video class="html5-main-video"></video></div></body></html>`
        });
      } else {
        req.respond({ status: 204, body: '' });
      }
    });

    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ path: path.join(EXTENSION_PATH, 'src', 'styles.css') });
    await page.addScriptTag({ path: path.join(EXTENSION_PATH, 'src', 'content-bundle.js') });

    await page.waitForSelector('#yt-misinfo-status-badge', { timeout: 4000 });

    // Trigger Claim 1 (timestamp = 12.0s, duration = 4.5s -> window [11.75, 16.5])
    await page.evaluate(() => {
      const v = document.querySelector('video.html5-main-video');
      v.currentTime = 13.0;
      v.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForSelector('#yt-misinfo-overlay-root .yt-misinfo-card', { timeout: 2000 });
    assert.ok(await page.$('#yt-misinfo-overlay-root .yt-misinfo-card'), 'Overlay visible inside window');

    // Advance playback beyond expiration boundary (17.0s > 16.5s)
    await page.evaluate(() => {
      const v = document.querySelector('video.html5-main-video');
      v.currentTime = 17.0;
      v.dispatchEvent(new Event('timeupdate'));
    });

    // Wait for auto-hide animation and removal
    await page.waitForFunction(
      () => !document.querySelector('#yt-misinfo-overlay-root .yt-misinfo-card'),
      { timeout: 2000 }
    );
    const overlayExpired = await page.$('#yt-misinfo-overlay-root .yt-misinfo-card');
    assert.equal(overlayExpired, null, 'Overlay cleanly unmounted after window expiry');

    assert.deepEqual(errorLogs, [], 'No uncaught errors during auto-dismissal test');
    await page.close();
  });

  // =========================================================================
  // Scenario 4: Manual Dismissal Persistence and Reset on Seek
  // =========================================================================
  await t.test('Scenario 4: Manual dismissal persistence across window and reset on seek', async () => {
    const page = await browser.newPage();
    await setupPageForTestMode(page);
    const errorLogs = [];
    page.on('pageerror', (err) => errorLogs.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errorLogs.push(msg.text());
    });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('youtube.com/watch')) {
        req.respond({
          status: 200,
          contentType: 'text/html',
          body: `<!DOCTYPE html><html><body><div id="movie_player"><video class="html5-main-video"></video></div></body></html>`
        });
      } else {
        req.respond({ status: 204, body: '' });
      }
    });

    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ path: path.join(EXTENSION_PATH, 'src', 'styles.css') });
    await page.addScriptTag({ path: path.join(EXTENSION_PATH, 'src', 'content-bundle.js') });

    await page.waitForSelector('#yt-misinfo-status-badge', { timeout: 4000 });

    // Trigger overlay at t = 12.0s
    await page.evaluate(() => {
      const v = document.querySelector('video.html5-main-video');
      v.currentTime = 12.0;
      v.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForSelector('.yt-misinfo-card-dismiss', { timeout: 2000 });

    // Manually click the dismiss button
    await page.click('.yt-misinfo-card-dismiss');
    const overlayAfterDismiss = await page.$('#yt-misinfo-overlay-root .yt-misinfo-card');
    assert.equal(overlayAfterDismiss, null, 'Warning card removed immediately upon manual dismiss');

    // Simulate continued playback within the same claim window (t = 13.0, 14.0, 15.0)
    for (const time of [13.0, 14.0, 15.0]) {
      await page.evaluate((t) => {
        const v = document.querySelector('video.html5-main-video');
        v.currentTime = t;
        v.dispatchEvent(new Event('timeupdate'));
      }, time);
      const cardStillDismissed = await page.$('#yt-misinfo-overlay-root .yt-misinfo-card');
      assert.equal(cardStillDismissed, null, `Card remains dismissed at t=${time}`);
    }

    // Now seek video (seeking + seeked) back to 12.0s to simulate re-seeking
    await page.evaluate(() => {
      const v = document.querySelector('video.html5-main-video');
      v.dispatchEvent(new Event('seeking'));
      v.currentTime = 12.0;
      v.dispatchEvent(new Event('seeked'));
      v.dispatchEvent(new Event('timeupdate'));
    });

    // Verify dismissed state was reset by seeking and card appears again
    await page.waitForSelector('#yt-misinfo-overlay-root .yt-misinfo-card', { timeout: 2000 });
    const cardReappeared = await page.$('#yt-misinfo-overlay-root .yt-misinfo-card');
    assert.ok(cardReappeared, 'Warning card reappears after seeking back to claim');

    assert.deepEqual(errorLogs, [], 'No uncaught errors during manual dismissal persistence test');
    await page.close();
  });
});
