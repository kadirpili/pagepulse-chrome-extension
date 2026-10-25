import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..');

test('YouTube Misinformation Detector - Real Google Chrome E2E Suite', async (t) => {
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

  // =========================================================================
  // Suite 1: Extension Packaging & Manifest V3 Verification
  // =========================================================================
  await t.test('Suite 1: Extension packaging & Manifest V3 compliance', async () => {
    const manifestPath = path.join(EXTENSION_PATH, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.manifest_version, 3, 'Manifest version must be 3');
    assert.equal(manifest.name, 'YouTube Misinformation Detector', 'Extension name matches specification');
    assert.ok(manifest.version, 'Extension has version');

    // Permissions
    assert.ok(Array.isArray(manifest.permissions), 'Permissions array exists');
    assert.ok(manifest.permissions.includes('storage'), 'storage permission declared');
    assert.ok(manifest.permissions.includes('activeTab'), 'activeTab permission declared');
    assert.ok(Array.isArray(manifest.host_permissions), 'Host permissions array exists');
    assert.ok(manifest.host_permissions.some((p) => p.includes('youtube.com')), 'YouTube host permission declared');

    // Background Service Worker
    assert.ok(manifest.background, 'Background configuration present');
    assert.equal(manifest.background.service_worker, 'src/background.js', 'Service worker points to src/background.js');
    assert.ok(fs.existsSync(path.join(EXTENSION_PATH, manifest.background.service_worker)), 'Background file exists on disk');

    // Content Script & Bundled IIFE
    assert.ok(Array.isArray(manifest.content_scripts), 'content_scripts registered');
    const cs = manifest.content_scripts[0];
    assert.ok(cs.matches.some((m) => m.includes('youtube.com')), 'Content script matches YouTube URLs');
    assert.ok(cs.js.includes('src/content-bundle.js'), 'content_scripts specifies src/content-bundle.js');
    assert.ok(cs.css.includes('src/styles.css'), 'content_scripts specifies src/styles.css');

    const bundlePath = path.join(EXTENSION_PATH, 'src', 'content-bundle.js');
    assert.ok(fs.existsSync(bundlePath), 'src/content-bundle.js must exist on disk');
    const bundleStat = fs.statSync(bundlePath);
    assert.ok(bundleStat.size > 10000, 'src/content-bundle.js is a non-empty compiled bundle');

    // Icons
    ['icon16.png', 'icon48.png', 'icon128.png'].forEach((iconName) => {
      const iconPath = path.join(EXTENSION_PATH, 'icons', iconName);
      assert.ok(fs.existsSync(iconPath), `Icon ${iconName} exists on disk`);
      assert.ok(fs.statSync(iconPath).size > 0, `Icon ${iconName} is not empty`);
    });

    // Action / Popup
    assert.equal(manifest.action.default_popup, 'popup/popup.html', 'Default popup is popup/popup.html');
    assert.ok(fs.existsSync(path.join(EXTENSION_PATH, manifest.action.default_popup)), 'popup.html exists');
  });

  // =========================================================================
  // Suite 2: Extension Popup UI Verification
  // =========================================================================
  await t.test('Suite 2: Extension popup UI verification (title, switches, stats grid, styling)', async () => {
    const page = await browser.newPage();
    const errorLogs = [];
    page.on('pageerror', (err) => errorLogs.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text());
      }
    });

    const popupUrl = `file://${path.join(EXTENSION_PATH, 'popup', 'popup.html')}`;
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded' });

    // 1. Verify title and brand headers
    const title = await page.title();
    assert.equal(title, 'YouTube Misinformation Detector', 'Page title matches expected extension title');

    const brandTitle = await page.$eval('.popup-title', (el) => el.textContent.trim());
    assert.equal(brandTitle, 'Misinfo Detector', 'Brand title is Misinfo Detector');

    // 2. Verify toggle switches exist and handle interactions
    const toggleEnabled = await page.$('#toggle-enabled');
    assert.ok(toggleEnabled, 'Master enable toggle exists');
    const enabledInitial = await page.$eval('#toggle-enabled', (el) => el.checked);
    assert.equal(enabledInitial, true, 'Master enable toggle is checked by default');

    // Click master toggle slider to disable
    await page.click('#toggle-enabled + .slider');
    const enabledAfterClick = await page.$eval('#toggle-enabled', (el) => el.checked);
    assert.equal(enabledAfterClick, false, 'Master enable toggle switches to false');

    // Click master toggle slider back to enable
    await page.click('#toggle-enabled + .slider');
    assert.equal(await page.$eval('#toggle-enabled', (el) => el.checked), true, 'Master enable toggle restores to true');

    // Overlays toggle
    const toggleOverlays = await page.$('#toggle-overlays');
    assert.ok(toggleOverlays, 'Overlays toggle exists');
    assert.equal(await page.$eval('#toggle-overlays', (el) => el.checked), true, 'Overlays toggle is checked by default');
    await page.click('#toggle-overlays + .slider');
    assert.equal(await page.$eval('#toggle-overlays', (el) => el.checked), false, 'Overlays toggle switches to false');
    await page.click('#toggle-overlays + .slider');
    assert.equal(await page.$eval('#toggle-overlays', (el) => el.checked), true, 'Overlays toggle restores to true');

    // 3. Filter dropdown
    const selectFilter = await page.$('#select-filter');
    assert.ok(selectFilter, 'Timeline filter dropdown exists');
    const filterOptions = await page.$$eval('#select-filter option', (options) => options.map((o) => o.value));
    assert.deepEqual(filterOptions, ['all', 'misinformation', 'verified', 'unknown'], 'Dropdown contains all expected filter categories');

    await page.select('#select-filter', 'misinformation');
    assert.equal(await page.$eval('#select-filter', (el) => el.value), 'misinformation', 'Filter selected to misinformation');
    await page.select('#select-filter', 'all');
    assert.equal(await page.$eval('#select-filter', (el) => el.value), 'all', 'Filter restored to all');

    // 4. Stats grid structure
    const statCards = await page.$$('.stat-card');
    assert.equal(statCards.length, 4, 'Stats grid contains 4 metric cards');

    const totalEl = await page.$('#stat-total');
    const misinfoEl = await page.$('#stat-misinfo');
    const verifiedEl = await page.$('#stat-verified');
    const unknownEl = await page.$('#stat-unknown');
    assert.ok(totalEl && misinfoEl && verifiedEl && unknownEl, 'All 4 stat value elements exist');

    // 5. Non-YouTube fallback view state
    const subtitle = await page.$eval('#status-subtitle', (el) => el.textContent.trim());
    assert.ok(
      subtitle.includes('preview') || subtitle.includes('Not a YouTube') || subtitle.includes('Checking'),
      `Subtitle indicates non-active tab status: "${subtitle}"`
    );

    // 6. Verify zero console/page runtime errors
    assert.deepEqual(errorLogs, [], `No uncaught console/page errors. Logs: ${JSON.stringify(errorLogs)}`);

    await page.close();
  });

  // =========================================================================
  // Suite 3: Simulated YouTube Watch Page DOM Verification
  // =========================================================================
  await t.test('Suite 3: Simulated YouTube watch page DOM verification', async () => {
    const page = await browser.newPage();
    const errorLogs = [];
    page.on('pageerror', (err) => errorLogs.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text());
      }
    });

    // Mock YouTube request to provide simulated watch page DOM
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const reqUrl = req.url();
      if (reqUrl.includes('youtube.com/watch')) {
        req.respond({
          status: 200,
          contentType: 'text/html',
          body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Simulated YouTube Watch Page</title>
</head>
<body>
  <div id="movie_player" class="html5-video-player" style="position:relative; width:800px; height:450px; background:#000;">
    <video class="html5-main-video" style="width:100%; height:100%;"></video>
  </div>
</body>
</html>`
        });
      } else if (reqUrl.includes('vercel.app') || reqUrl.includes('cloudfront.net') || reqUrl.includes(':3000/check')) {
        req.respond({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*'
          },
          contentType: 'application/json',
          body: JSON.stringify([
            {
              timestamp: 12.0,
              sentence: 'This song was completely improvised in a single take without prior rehearsal.',
              verdict: 'misinformation',
              explanation: 'The track was meticulously written, arranged, and produced by Stock Aitken Waterman over several weeks at PWL Studios in London.',
              sources: ['https://factcheck.org/1']
            },
            {
              timestamp: 42.5,
              sentence: 'Never Gonna Give You Up reached number one in 25 countries upon its release in 1987.',
              verdict: 'verified',
              explanation: 'Official international music record charts confirm the single topped charts in 25 countries worldwide.',
              sources: ['https://billboard.com']
            },
            {
              timestamp: 88.0,
              sentence: 'The music video was shot on a multi-million dollar film soundstage in Hollywood.',
              verdict: 'misinformation',
              explanation: 'The video was directed by Simon West on a shoestring budget near London Battersea District.',
              sources: ['https://apnews.com']
            },
            {
              timestamp: 135.0,
              sentence: 'Rick Astley originally declined to record the vocal track until persuaded by Pete Waterman.',
              verdict: 'unknown',
              explanation: 'Historical accounts differ on Astleys initial reaction.',
              sources: ['https://reuters.com']
            }
          ])
        });
      } else {
        req.respond({ status: 204, body: '' });
      }
    });

    // 1. Navigate to simulated YouTube watch URL with seeded video ID dQw4w9WgXcQ
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { waitUntil: 'domcontentloaded' });

    // 2. Inject styles and content script bundle
    const stylesPath = path.join(EXTENSION_PATH, 'src', 'styles.css');
    const bundlePath = path.join(EXTENSION_PATH, 'src', 'content-bundle.js');
    await page.addStyleTag({ path: stylesPath });
    await page.addScriptTag({ path: bundlePath });

    // Wait for content script to mount UI components and load claims
    await page.waitForSelector('#yt-misinfo-status-badge', { timeout: 4000 });
    await page.waitForFunction(
      () => {
        const badge = document.getElementById('yt-misinfo-status-badge');
        return badge && !badge.textContent.includes('Loading') && badge.textContent.includes('claims');
      },
      { timeout: 4000 }
    );

    // 3. Verify persistent visual indicator badge renders and pulses at bottom-left
    const badgeText = await page.$eval('#yt-misinfo-status-badge', (el) => el.textContent.trim());
    assert.match(badgeText, /🛡️ Misinfo Detector Active.*\(4 claims\)/, 'Indicator badge displays active status and 4 claims');

    const badgeStyle = await page.$eval('#yt-misinfo-status-badge', (el) => ({
      position: el.style.position,
      bottom: el.style.bottom,
      left: el.style.left,
      cursor: el.style.cursor
    }));
    assert.equal(badgeStyle.position, 'fixed', 'Badge position is fixed');
    assert.equal(badgeStyle.bottom, '24px', 'Badge placed at bottom: 24px');
    assert.equal(badgeStyle.left, '24px', 'Badge placed at left: 24px');
    assert.equal(badgeStyle.cursor, 'pointer', 'Badge is clickable');

    // Verify pulsing dot element exists inside badge
    const pulseDot = await page.$('#yt-misinfo-status-badge span');
    assert.ok(pulseDot, 'Pulsing indicator dot element exists inside badge');

    // 4. Verify clicking indicator opens the claims drawer
    const isDrawerCollapsedBefore = await page.$eval('#yt-misinfo-drawer-panel', (el) =>
      el.classList.contains('is-collapsed')
    );
    assert.equal(isDrawerCollapsedBefore, true, 'Drawer is collapsed initially');

    await page.click('#yt-misinfo-status-badge');
    // Wait for drawer slide-in transition (0.26s) to complete
    await new Promise((r) => setTimeout(r, 350));

    const isDrawerCollapsedAfter = await page.$eval('#yt-misinfo-drawer-panel', (el) =>
      el.classList.contains('is-collapsed')
    );
    assert.equal(isDrawerCollapsedAfter, false, 'Clicking badge opened drawer panel');
    const ariaExpanded = await page.$eval('#yt-misinfo-drawer-panel', (el) => el.getAttribute('aria-expanded'));
    assert.equal(ariaExpanded, 'true', 'Drawer aria-expanded is set to true');

    // 5. Verify timeline drawer lists claims chronologically with color-coded badges (red, green, gray)
    const cards = await page.$$('.yt-misinfo-timeline-card');
    assert.equal(cards.length, 4, 'Timeline drawer renders all 4 claims');

    const cardData = await page.$$eval('.yt-misinfo-timeline-card', (elements) =>
      elements.map((el) => {
        const badgeEl = el.querySelector('.yt-misinfo-badge');
        return {
          timestamp: parseFloat(el.dataset.timestamp),
          verdict: el.dataset.verdict,
          badgeText: badgeEl ? badgeEl.textContent.trim() : '',
          badgeClass: badgeEl ? badgeEl.className : '',
          borderClass: el.className
        };
      })
    );

    // Verify chronological order: [12, 42.5, 88, 135]
    assert.deepEqual(
      cardData.map((c) => c.timestamp),
      [12, 42.5, 88, 135],
      'Claims are ordered chronologically'
    );

    // Verify color-coded badges and border indicators
    // Card 1: misinformation (red/amber)
    assert.equal(cardData[0].verdict, 'misinformation');
    assert.ok(
      cardData[0].badgeText === 'Misinformation' || cardData[0].badgeText.includes('Score:'),
      'Card 1 has misinformation or score badge'
    );
    assert.ok(
      cardData[0].badgeClass.includes('yt-misinfo-badge--misinformation') ||
        cardData[0].badgeClass.includes('yt-misinfo-badge--warning') ||
        cardData[0].badgeClass.includes('yt-misinfo-badge--danger'),
      'Card 1 has warning or misinformation badge class'
    );

    // Card 2: verified (green)
    assert.equal(cardData[1].verdict, 'verified');
    assert.ok(
      cardData[1].badgeText === 'Verified' || cardData[1].badgeText.includes('Score:'),
      'Card 2 has verified or score badge'
    );

    // Card 3: misinformation (red/amber)
    assert.equal(cardData[2].verdict, 'misinformation');
    assert.ok(
      cardData[2].badgeText === 'Misinformation' || cardData[2].badgeText.includes('Score:'),
      'Card 3 has misinformation or score badge'
    );

    // Card 4: unknown (gray)
    assert.equal(cardData[3].verdict, 'unknown');
    assert.ok(
      cardData[3].badgeText === 'Unverified' || cardData[3].badgeText.includes('Score:'),
      'Card 4 has unverified badge'
    );
    assert.ok(cardData[3].badgeClass.includes('yt-misinfo-badge--unknown'), 'Card 4 has gray unverified badge class');

    // 6. Verify filter chips in drawer filter claims
    // Click "Misinformation" filter chip
    await page.click('button[data-filter="misinformation"]');
    const misinfoOnlyVerdicts = await page.$$eval('.yt-misinfo-timeline-card', (els) => els.map((e) => e.dataset.verdict));
    assert.equal(misinfoOnlyVerdicts.length, 2, '2 misinformation claims shown');
    assert.deepEqual(misinfoOnlyVerdicts, ['misinformation', 'misinformation'], 'Only misinformation cards visible');

    // Click "Verified" filter chip
    await page.click('button[data-filter="verified"]');
    const verifiedOnlyVerdicts = await page.$$eval('.yt-misinfo-timeline-card', (els) => els.map((e) => e.dataset.verdict));
    assert.equal(verifiedOnlyVerdicts.length, 1, '1 verified claim shown');
    assert.deepEqual(verifiedOnlyVerdicts, ['verified'], 'Only verified card visible');

    // Click "All" filter chip to reset
    await page.click('button[data-filter="all"]');
    const allVerdicts = await page.$$eval('.yt-misinfo-timeline-card', (els) => els.map((e) => e.dataset.verdict));
    assert.equal(allVerdicts.length, 4, 'All 4 claims visible again');

    // 7. Verify in-video warning overlay appears inside #movie_player when currentTime hits a misinformation claim
    // Trigger playback at t = 12.0s (matches claim 1: misinformation)
    await page.evaluate(() => {
      const video = document.querySelector('video.html5-main-video');
      video.currentTime = 12.0;
      video.dispatchEvent(new Event('timeupdate'));
    });

    await page.waitForSelector('#yt-misinfo-overlay-root .yt-misinfo-card', { timeout: 2000 });
    const overlayParentId = await page.$eval('#yt-misinfo-overlay-root', (el) => el.parentElement.id);
    assert.equal(overlayParentId, 'movie_player', 'Overlay container is mounted inside #movie_player');

    const overlaySentence = await page.$eval('.yt-misinfo-card-sentence', (el) => el.textContent.trim());
    assert.equal(
      overlaySentence,
      '“This song was completely improvised in a single take without prior rehearsal.”',
      'Warning overlay shows quoted misinformation sentence'
    );

    const overlayExplanation = await page.$eval('.yt-misinfo-card-explanation', (el) => el.textContent.trim());
    assert.ok(overlayExplanation.includes('Stock Aitken Waterman'), 'Explanation provides fact-check context');

    // 8. Verify click-to-seek updates video.currentTime
    // Click on Card 2 (timestamp 42.5s)
    const cardElements = await page.$$('.yt-misinfo-timeline-card');
    await cardElements[1].click();

    const updatedCurrentTime = await page.evaluate(() => document.querySelector('video.html5-main-video').currentTime);
    assert.equal(updatedCurrentTime, 42.5, 'Click-to-seek updated video.currentTime to 42.5');

    // Check overlay hides when seeking to verified claim (not misinformation)
    await page.evaluate(() => {
      const video = document.querySelector('video.html5-main-video');
      video.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForFunction(
      () => !document.querySelector('#yt-misinfo-overlay-root .yt-misinfo-card'),
      { timeout: 2000 }
    );
    const overlayCardAfterSeek = await page.$('#yt-misinfo-overlay-root .yt-misinfo-card');
    assert.equal(overlayCardAfterSeek, null, 'Warning overlay hides when active claim is verified');

    // 9. Verify zero uncaught errors
    assert.deepEqual(errorLogs, [], `No uncaught console/page errors in simulated watch page run: ${JSON.stringify(errorLogs)}`);

    await page.close();
  });
});
