import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

import {
  hasChromeStorage,
  getSettings,
  saveSettings,
  onSettingsChanged,
  resetMemoryStore,
  setMemoryStore,
  DEFAULT_SETTINGS
} from '../src/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..');
const POPUP_URL = `file://${path.join(EXTENSION_PATH, 'popup', 'popup.html')}`;

// =============================================================================
// ADVERSARIAL VERIFICATION SUITE (Real Google Chrome & Node.js)
// =============================================================================
test('Adversarial Test Suite: UI, DOM, Security, & Storage Fallback', async (suite) => {
  let browser;
  let page;

  suite.before(async () => {
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
    page = await browser.newPage();
  });

  suite.after(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
  });

  // ---------------------------------------------------------------------------
  // 1. SECURITY & XSS PROBING
  // ---------------------------------------------------------------------------
  await suite.test('Security: XSS Injection into Warning Overlay (sentence, explanation, sources)', async () => {
    const maliciousClaim = {
      timestamp: 42.5,
      sentence: '<script>window.__xss_sentence__ = true;</script><img src="invalid-url" onerror="window.__xss_img__ = true;"><b>Malicious Bold</b>',
      verdict: 'misinformation',
      explanation: '<svg onload="window.__xss_svg__ = true;"><script>window.__xss_expl__ = true;</script><iframe src="javascript:window.__xss_iframe__=true"></iframe>',
      sources: [
        'javascript:window.__xss_js_link__ = true;',
        'data:text/html,<script>window.__xss_data__ = true;</script>',
        'vbscript:window.__xss_vb__ = true;',
        '//protocol-relative-exploit.com',
        'https://safe-verifier.org/evidence'
      ]
    };

    await page.goto(POPUP_URL);
    await page.evaluate(() => {
      document.body.innerHTML = '<div id="movie_player" style="position: relative; width: 640px; height: 360px;"></div>';
    });

    const result = await page.evaluate(async (claim, extPath) => {
      const { OverlayManager } = await import(`file://${extPath}/src/overlay-manager.js`);

      const player = document.getElementById('movie_player');
      const manager = new OverlayManager({ playerElement: player });
      manager.mount();
      manager.update(claim, { enabled: true, showOverlays: true });

      // Allow microtasks & macro-tasks for any injected script/onerror execution
      await new Promise((resolve) => setTimeout(resolve, 200));

      const card = player.querySelector('.yt-misinfo-card');
      const scripts = player.querySelectorAll('script');
      const iframes = player.querySelectorAll('iframe');
      const images = player.querySelectorAll('img');
      const svgs = player.querySelectorAll('svg'); // Only the legitimate icon svg
      const links = Array.from(player.querySelectorAll('a')).map((a) => ({
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
        text: a.textContent
      }));

      return {
        cardRendered: Boolean(card),
        cardText: card ? card.textContent : '',
        scriptsCount: scripts.length,
        iframesCount: iframes.length,
        imagesCount: images.length,
        svgsCount: svgs.length,
        links,
        xssSentence: window.__xss_sentence__,
        xssImg: window.__xss_img__,
        xssSvg: window.__xss_svg__,
        xssExpl: window.__xss_expl__,
        xssIframe: window.__xss_iframe__,
        xssJsLink: window.__xss_js_link__,
        xssData: window.__xss_data__
      };
    }, maliciousClaim, EXTENSION_PATH);

    // Verify ZERO script execution in Chrome
    assert.equal(result.cardRendered, true, 'Warning card must be rendered');
    assert.equal(result.xssSentence, undefined, 'Script in sentence MUST NOT execute');
    assert.equal(result.xssImg, undefined, 'Img onerror in sentence MUST NOT execute');
    assert.equal(result.xssSvg, undefined, 'Svg onload in explanation MUST NOT execute');
    assert.equal(result.xssExpl, undefined, 'Script in explanation MUST NOT execute');
    assert.equal(result.xssIframe, undefined, 'Iframe in explanation MUST NOT execute');
    assert.equal(result.xssJsLink, undefined, 'javascript: link MUST NOT execute');
    assert.equal(result.xssData, undefined, 'data: link MUST NOT execute');

    // Structural DOM guarantees
    assert.equal(result.scriptsCount, 0, 'No script elements injected');
    assert.equal(result.iframesCount, 0, 'No iframe elements injected');
    assert.equal(result.imagesCount, 0, 'No img elements injected');
    assert.equal(result.svgsCount, 1, 'Only built-in SVG icon should exist');

    // Source link sanitization: only https:// allowed, target="_blank", rel="noopener noreferrer"
    assert.equal(result.links.length, 1, 'Only safe https link should be rendered');
    assert.equal(result.links[0].href, 'https://safe-verifier.org/evidence');
    assert.equal(result.links[0].target, '_blank');
    assert.equal(result.links[0].rel, 'noopener noreferrer');
    assert.equal(result.links[0].text, 'safe-verifier.org');

    // Quoted text rendered safely as text
    assert.ok(result.cardText.includes('<script>window.__xss_sentence__ = true;</script>'));
    assert.ok(result.cardText.includes('<svg onload="window.__xss_svg__ = true;">'));
  });

  await suite.test('Security: XSS Injection into Timeline Drawer', async () => {
    const maliciousClaims = [
      {
        timestamp: 12.0,
        sentence: '<script>window.__xss_drawer_script__ = true;</script><img src="invalid" onerror="window.__xss_drawer_img__=true;">',
        verdict: 'misinformation',
        explanation: '<a href="javascript:window.__xss_drawer_link__=true">Click me</a>',
        sources: [
          'JAVASCRIPT:window.__xss_drawer_upper__=true',
          '  javascript:window.__xss_drawer_space__=true',
          'data:text/html,malicious',
          'https://valid-factcheck.org/article'
        ]
      }
    ];

    await page.goto(POPUP_URL);
    await page.evaluate(() => {
      document.body.innerHTML = '<div id="drawer-container"></div>';
    });

    const result = await page.evaluate(async (claims, extPath) => {
      const { DrawerManager } = await import(`file://${extPath}/src/drawer-manager.js`);

      const container = document.getElementById('drawer-container');
      const drawer = new DrawerManager({ parent: container });
      drawer.mount();
      drawer.setClaims(claims);
      drawer.open();

      await new Promise((resolve) => setTimeout(resolve, 200));

      const scripts = container.querySelectorAll('script');
      const iframes = container.querySelectorAll('iframe');
      const images = container.querySelectorAll('img');
      const links = Array.from(container.querySelectorAll('a.yt-misinfo-source-link')).map((a) => ({
        href: a.getAttribute('href'),
        text: a.textContent
      }));

      return {
        scriptsCount: scripts.length,
        iframesCount: iframes.length,
        imagesCount: images.length,
        links,
        xssDrawerScript: window.__xss_drawer_script__,
        xssDrawerImg: window.__xss_drawer_img__,
        xssDrawerLink: window.__xss_drawer_link__,
        xssDrawerUpper: window.__xss_drawer_upper__,
        xssDrawerSpace: window.__xss_drawer_space__
      };
    }, maliciousClaims, EXTENSION_PATH);

    assert.equal(result.xssDrawerScript, undefined, 'Drawer script must not execute');
    assert.equal(result.xssDrawerImg, undefined, 'Drawer img onerror must not execute');
    assert.equal(result.xssDrawerLink, undefined, 'Drawer inline link must not execute');
    assert.equal(result.xssDrawerUpper, undefined, 'Uppercase JAVASCRIPT: must be blocked');
    assert.equal(result.xssDrawerSpace, undefined, 'Whitespace padded javascript: must be blocked');

    assert.equal(result.scriptsCount, 0, 'No script elements in drawer');
    assert.equal(result.iframesCount, 0, 'No iframe elements in drawer');
    assert.equal(result.imagesCount, 0, 'No img elements in drawer');

    assert.equal(result.links.length, 1, 'Only legitimate https link is rendered');
    assert.equal(result.links[0].href, 'https://valid-factcheck.org/article');
  });

  // ---------------------------------------------------------------------------
  // 2. OVERLAY LIFECYCLE & DISMISSAL PERSISTENCE
  // ---------------------------------------------------------------------------
  await suite.test('Overlay: Manual dismissal persistence across playback tolerance window', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => {
      document.body.innerHTML = '<div id="movie_player"></div>';
    });

    const result = await page.evaluate(async (extPath) => {
      const { OverlayManager } = await import(`file://${extPath}/src/overlay-manager.js`);

      const player = document.getElementById('movie_player');
      const om = new OverlayManager({ playerElement: player });
      om.mount();

      const claim = {
        timestamp: 42.5,
        sentence: 'Sample misinformation claim',
        verdict: 'misinformation',
        explanation: 'Debunked',
        sources: ['https://example.com']
      };

      // 1. Show overlay
      om.update(claim, { enabled: true, showOverlays: true });
      const initialVisible = Boolean(player.querySelector('.yt-misinfo-card'));

      // 2. Click dismiss button
      const dismissBtn = player.querySelector('.yt-misinfo-dismiss');
      dismissBtn.click();
      const cardAfterDismiss = Boolean(player.querySelector('.yt-misinfo-card'));

      // 3. Simulate continuous timeupdate events during the same claim window (10 ticks)
      const visibleOnTicks = [];
      for (let i = 0; i < 10; i++) {
        om.update(claim, { enabled: true, showOverlays: true });
        visibleOnTicks.push(Boolean(player.querySelector('.yt-misinfo-card')));
      }

      // 4. Seek to reset dismissal (e.g. user seeks back or re-navigates)
      om.resetDismissed();
      om.update(claim, { enabled: true, showOverlays: true });
      const visibleAfterReset = Boolean(player.querySelector('.yt-misinfo-card'));

      return {
        initialVisible,
        cardAfterDismiss,
        visibleOnTicks,
        visibleAfterReset
      };
    }, EXTENSION_PATH);

    assert.equal(result.initialVisible, true, 'Overlay must be visible initially');
    assert.equal(result.cardAfterDismiss, false, 'Card must be removed immediately upon dismiss');
    assert.ok(result.visibleOnTicks.every((v) => v === false), 'Overlay must REMAIN hidden during successive updates for same claim');
    assert.equal(result.visibleAfterReset, true, 'Overlay must reappear after resetDismissed() is called upon seek');
  });

  await suite.test('Overlay: Auto-hide when exiting claim tolerance window', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => {
      document.body.innerHTML = '<div id="movie_player"></div>';
    });

    const result = await page.evaluate(async (extPath) => {
      const { OverlayManager } = await import(`file://${extPath}/src/overlay-manager.js`);

      const player = document.getElementById('movie_player');
      const om = new OverlayManager({ playerElement: player });
      om.mount();

      const claim = {
        timestamp: 10.0,
        sentence: 'Active claim',
        verdict: 'misinformation',
        explanation: 'Testing auto-hide'
      };

      // 1. Show claim
      om.update(claim, { enabled: true, showOverlays: true });
      const initialShowing = Boolean(player.querySelector('.yt-misinfo-card'));

      // 2. Exit window (activeClaim becomes null)
      om.update(null, { enabled: true, showOverlays: true });
      const cardImmediatelyAfter = player.querySelector('.yt-misinfo-card');
      const hasHidingClass = cardImmediatelyAfter ? cardImmediatelyAfter.classList.contains('yt-misinfo-card--hiding') : false;

      // 3. Wait for hide transition/timeout (250ms)
      await new Promise((resolve) => setTimeout(resolve, 250));
      const cardAfterTimeout = player.querySelector('.yt-misinfo-card');

      return {
        initialShowing,
        hasHidingClass,
        cardAfterTimeout: Boolean(cardAfterTimeout)
      };
    }, EXTENSION_PATH);

    assert.equal(result.initialShowing, true, 'Overlay must show when active claim is present');
    assert.equal(result.hasHidingClass, true, 'Card must have hiding class during hide transition');
    assert.equal(result.cardAfterTimeout, false, 'Card must be completely removed from DOM after hide timeout');
  });

  await suite.test('Overlay: Rapid timeupdates during hide transition does not permanently keep card in DOM', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => {
      document.body.innerHTML = '<div id="movie_player"></div>';
    });

    const result = await page.evaluate(async (extPath) => {
      const { OverlayManager } = await import(`file://${extPath}/src/overlay-manager.js`);

      const player = document.getElementById('movie_player');
      const om = new OverlayManager({ playerElement: player });
      om.mount();

      const claim = {
        timestamp: 10.0,
        sentence: 'Stress test claim',
        verdict: 'misinformation',
        explanation: 'Stress test'
      };

      // Show
      om.update(claim, { enabled: true, showOverlays: true });

      // Exit claim window
      om.update(null, { enabled: true, showOverlays: true });

      // Fire rapid update(null) calls every 40ms for 280ms (7 calls)
      for (let i = 0; i < 7; i++) {
        await new Promise((r) => setTimeout(r, 40));
        om.update(null, { enabled: true, showOverlays: true });
      }

      // Wait 250ms after flurry ceases
      await new Promise((r) => setTimeout(r, 250));

      const finalCard = player.querySelector('.yt-misinfo-card');
      return {
        finalCardExists: Boolean(finalCard)
      };
    }, EXTENSION_PATH);

    assert.equal(result.finalCardExists, false, 'Card must be removed after rapid timeupdate flurry settles');
  });

  await suite.test('Overlay: Settings toggle immediately suppresses overlay', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => {
      document.body.innerHTML = '<div id="movie_player"></div>';
    });

    const result = await page.evaluate(async (extPath) => {
      const { OverlayManager } = await import(`file://${extPath}/src/overlay-manager.js`);

      const player = document.getElementById('movie_player');
      const om = new OverlayManager({ playerElement: player });
      om.mount();

      const claim = {
        timestamp: 20.0,
        sentence: 'Toggle test claim',
        verdict: 'misinformation',
        explanation: 'Toggle test'
      };

      // Show
      om.update(claim, { enabled: true, showOverlays: true });
      const shown = Boolean(player.querySelector('.yt-misinfo-card'));

      // Toggle showOverlays = false -> triggers animated hide
      om.update(claim, { enabled: true, showOverlays: false });
      const hasHidingClassOnToggle = player.querySelector('.yt-misinfo-card')?.classList.contains('yt-misinfo-card--hiding');
      await new Promise((r) => setTimeout(r, 220));
      const removedAfterOverlayToggle = !player.querySelector('.yt-misinfo-card');

      // Show again
      om.update(claim, { enabled: true, showOverlays: true });
      const reShown = Boolean(player.querySelector('.yt-misinfo-card'));

      // Toggle enabled = false -> triggers animated hide
      om.update(claim, { enabled: false, showOverlays: true });
      const hasHidingClassOnMasterToggle = player.querySelector('.yt-misinfo-card')?.classList.contains('yt-misinfo-card--hiding');
      await new Promise((r) => setTimeout(r, 220));
      const removedAfterMasterToggle = !player.querySelector('.yt-misinfo-card');

      // Test immediate hide API
      om.update(claim, { enabled: true, showOverlays: true });
      om.hide(true);
      const immediateHideRemoved = !player.querySelector('.yt-misinfo-card');

      return {
        shown,
        hasHidingClassOnToggle,
        removedAfterOverlayToggle,
        reShown,
        hasHidingClassOnMasterToggle,
        removedAfterMasterToggle,
        immediateHideRemoved
      };
    }, EXTENSION_PATH);

    assert.equal(result.shown, true);
    assert.equal(result.hasHidingClassOnToggle, true, 'Card must have hiding class on overlay toggle');
    assert.equal(result.removedAfterOverlayToggle, true, 'Card must be unmounted after animation timeout');
    assert.equal(result.reShown, true);
    assert.equal(result.hasHidingClassOnMasterToggle, true, 'Card must have hiding class on master toggle');
    assert.equal(result.removedAfterMasterToggle, true, 'Card must be unmounted after master toggle timeout');
    assert.equal(result.immediateHideRemoved, true, 'hide(true) must remove card synchronously');
  });

  // ---------------------------------------------------------------------------
  // 3. TIMELINE DRAWER INTERACTIONS & DOM BEHAVIORS
  // ---------------------------------------------------------------------------
  const testClaims = [
    {
      timestamp: 90.0,
      sentence: 'Claim at 90s',
      verdict: 'unknown',
      explanation: 'Unverified claim',
      sources: ['https://source90.org']
    },
    {
      timestamp: 0.0,
      sentence: 'Claim at 0s',
      verdict: 'verified',
      explanation: 'Verified beginning claim',
      sources: ['https://source0.org']
    },
    {
      timestamp: 45.5,
      sentence: 'Claim at 45.5s',
      verdict: 'misinformation',
      explanation: 'Misleading statement',
      sources: ['https://source45.org']
    }
  ];

  await suite.test('Drawer: Sorts claims chronologically and renders badges', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => { document.body.innerHTML = ''; });

    const result = await page.evaluate(async (claims, extPath) => {
      const { DrawerManager } = await import(`file://${extPath}/src/drawer-manager.js`);

      const dm = new DrawerManager();
      dm.mount();
      dm.setClaims(claims);

      const cards = Array.from(document.querySelectorAll('.yt-misinfo-timeline-card')).map((card) => ({
        timestamp: parseFloat(card.dataset.timestamp),
        verdict: card.dataset.verdict,
        pillText: card.querySelector('.yt-misinfo-ts-pill').textContent
      }));

      dm.destroy();
      return cards;
    }, testClaims, EXTENSION_PATH);

    assert.equal(result.length, 3);
    assert.equal(result[0].timestamp, 0.0);
    assert.equal(result[0].verdict, 'verified');
    assert.ok(result[0].pillText.includes('00:00'));

    assert.equal(result[1].timestamp, 45.5);
    assert.equal(result[1].verdict, 'misinformation');
    assert.ok(result[1].pillText.includes('00:45'));

    assert.equal(result[2].timestamp, 90.0);
    assert.equal(result[2].verdict, 'unknown');
    assert.ok(result[2].pillText.includes('01:30'));
  });

  await suite.test('Drawer: Click-to-seek handles card and timestamp pill clicks, ignores source links', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => { document.body.innerHTML = ''; });

    const result = await page.evaluate(async (claims, extPath) => {
      const { DrawerManager } = await import(`file://${extPath}/src/drawer-manager.js`);

      const seeks = [];
      const dm = new DrawerManager({ onSeek: (ts) => seeks.push(ts) });
      dm.mount();
      dm.setClaims(claims);
      dm.open();

      const cards = document.querySelectorAll('.yt-misinfo-timeline-card');

      // Click card 0 (timestamp 0.0)
      cards[0].click();

      // Click timestamp pill on card 1 (timestamp 45.5)
      const pill1 = cards[1].querySelector('.yt-misinfo-ts-pill');
      pill1.click();

      // Click source link on card 2 (timestamp 90.0) -> MUST NOT SEEK
      const sourceLink2 = cards[2].querySelector('a.yt-misinfo-source-link');
      sourceLink2.click();

      // Click body of card 2 (timestamp 90.0) -> SHOULD SEEK
      cards[2].click();

      dm.destroy();
      return seeks;
    }, testClaims, EXTENSION_PATH);

    assert.deepEqual(result, [0.0, 45.5, 90.0], 'Seeks must occur for card and pill clicks, but NOT source link clicks');
  });

  await suite.test('Drawer: Keyboard accessibility triggers onSeek with Enter and Space', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => { document.body.innerHTML = ''; });

    const result = await page.evaluate(async (claims, extPath) => {
      const { DrawerManager } = await import(`file://${extPath}/src/drawer-manager.js`);

      const seeks = [];
      const dm = new DrawerManager({ onSeek: (ts) => seeks.push(ts) });
      dm.mount();
      dm.setClaims(claims);

      const cards = document.querySelectorAll('.yt-misinfo-timeline-card');

      // Dispatch Enter on card 1
      cards[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      // Dispatch Space on card 2
      cards[2].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      // Irrelevant key (Escape)
      cards[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      dm.destroy();
      return seeks;
    }, testClaims, EXTENSION_PATH);

    assert.deepEqual(result, [45.5, 90.0]);
  });

  await suite.test('Drawer: Active card highlighting accurately tracks current claim', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => { document.body.innerHTML = ''; });

    const result = await page.evaluate(async (claims, extPath) => {
      const { DrawerManager } = await import(`file://${extPath}/src/drawer-manager.js`);

      const dm = new DrawerManager();
      dm.mount();
      dm.setClaims(claims);

      // Activate claim at 45.5
      dm.setActiveClaim(claims[2]); // 45.5s claim
      const cardsAfterActivating45 = Array.from(document.querySelectorAll('.yt-misinfo-timeline-card')).map(
        (c) => c.classList.contains('yt-misinfo-card--active')
      );

      // Deactivate all
      dm.setActiveClaim(null);
      const cardsAfterDeactivating = Array.from(document.querySelectorAll('.yt-misinfo-timeline-card')).map(
        (c) => c.classList.contains('yt-misinfo-card--active')
      );

      dm.destroy();
      return {
        cardsAfterActivating45,
        cardsAfterDeactivating
      };
    }, testClaims, EXTENSION_PATH);

    assert.deepEqual(result.cardsAfterActivating45, [false, true, false], 'Only card 1 (45.5s) must be active');
    assert.deepEqual(result.cardsAfterDeactivating, [false, false, false], 'All cards must be inactive when null');
  });

  await suite.test('Drawer: Filter chips filter cards list and show empty state when no match', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => { document.body.innerHTML = ''; });

    const result = await page.evaluate(async (claims, extPath) => {
      const { DrawerManager } = await import(`file://${extPath}/src/drawer-manager.js`);

      const dm = new DrawerManager();
      dm.mount();
      dm.setClaims(claims);

      const countVisible = () => document.querySelectorAll('.yt-misinfo-timeline-card').length;
      const emptyStateHidden = () => document.querySelector('.yt-misinfo-empty-state').classList.contains('yt-misinfo-hidden');

      // 1. All
      const allCount = countVisible();

      // 2. Misinformation only
      dm.setFilter('misinformation');
      const misinfoCount = countVisible();
      const misinfoVerdict = document.querySelector('.yt-misinfo-timeline-card')?.dataset.verdict;

      // 3. Verified only
      dm.setFilter('verified');
      const verifiedCount = countVisible();
      const verifiedVerdict = document.querySelector('.yt-misinfo-timeline-card')?.dataset.verdict;

      // 4. Unknown only
      dm.setFilter('unknown');
      const unknownCount = countVisible();
      const unknownVerdict = document.querySelector('.yt-misinfo-timeline-card')?.dataset.verdict;

      // 5. Test empty state: set claims with NO misinformation
      dm.setClaims([claims[1]]); // only verified claim
      dm.setFilter('misinformation');
      const emptyCount = countVisible();
      const emptyStateVisible = !emptyStateHidden();

      dm.destroy();
      return {
        allCount,
        misinfoCount,
        misinfoVerdict,
        verifiedCount,
        verifiedVerdict,
        unknownCount,
        unknownVerdict,
        emptyCount,
        emptyStateVisible
      };
    }, testClaims, EXTENSION_PATH);

    assert.equal(result.allCount, 3);
    assert.equal(result.misinfoCount, 1);
    assert.equal(result.misinfoVerdict, 'misinformation');
    assert.equal(result.verifiedCount, 1);
    assert.equal(result.verifiedVerdict, 'verified');
    assert.equal(result.unknownCount, 1);
    assert.equal(result.unknownVerdict, 'unknown');
    assert.equal(result.emptyCount, 0);
    assert.equal(result.emptyStateVisible, true, 'Empty state must be visible when filter matches 0 claims');
  });

  await suite.test('Drawer: Collapse and expand toggles panel classes and ARIA attributes', async () => {
    await page.goto(POPUP_URL);
    await page.evaluate(() => { document.body.innerHTML = ''; });

    const result = await page.evaluate(async (extPath) => {
      const { DrawerManager } = await import(`file://${extPath}/src/drawer-manager.js`);

      const dm = new DrawerManager();
      dm.mount();

      const panel = document.getElementById('yt-misinfo-drawer-panel');

      const initialOpen = dm.isOpen();
      const initialAria = panel.getAttribute('aria-expanded');
      const initialCollapsedClass = panel.classList.contains('yt-misinfo-drawer-panel--collapsed');

      // Open
      dm.open();
      const afterOpenState = dm.isOpen();
      const afterOpenAria = panel.getAttribute('aria-expanded');
      const afterOpenCollapsedClass = panel.classList.contains('yt-misinfo-drawer-panel--collapsed');

      // Close
      dm.close();
      const afterCloseState = dm.isOpen();
      const afterCloseAria = panel.getAttribute('aria-expanded');
      const afterCloseCollapsedClass = panel.classList.contains('yt-misinfo-drawer-panel--collapsed');

      // Toggle
      dm.toggle();
      const afterToggleState = dm.isOpen();

      dm.destroy();
      return {
        initialOpen,
        initialAria,
        initialCollapsedClass,
        afterOpenState,
        afterOpenAria,
        afterOpenCollapsedClass,
        afterCloseState,
        afterCloseAria,
        afterCloseCollapsedClass,
        afterToggleState
      };
    }, EXTENSION_PATH);

    assert.equal(result.initialOpen, false);
    assert.equal(result.initialAria, 'false');
    assert.equal(result.initialCollapsedClass, true);

    assert.equal(result.afterOpenState, true);
    assert.equal(result.afterOpenAria, 'true');
    assert.equal(result.afterOpenCollapsedClass, false);

    assert.equal(result.afterCloseState, false);
    assert.equal(result.afterCloseAria, 'false');
    assert.equal(result.afterCloseCollapsedClass, true);

    assert.equal(result.afterToggleState, true);
  });
});

// =============================================================================
// 4. STORAGE FALLBACK RESILIENCE (Node.js & In-Memory Verification)
// =============================================================================
test('Adversarial Storage Fallback: Operation when chrome.storage is unavailable', async (t) => {
  t.beforeEach(() => {
    resetMemoryStore();
  });

  await t.test('hasChromeStorage returns false when chrome is undefined in Node.js', () => {
    const originalChrome = globalThis.chrome;
    try {
      delete globalThis.chrome;
      assert.equal(hasChromeStorage(), false);
    } finally {
      if (originalChrome !== undefined) globalThis.chrome = originalChrome;
    }
  });

  await t.test('hasChromeStorage returns false when chrome is defined but storage is undefined or missing get', () => {
    const originalChrome = globalThis.chrome;
    try {
      globalThis.chrome = {};
      assert.equal(hasChromeStorage(), false);

      globalThis.chrome = { storage: {} };
      assert.equal(hasChromeStorage(), false);

      globalThis.chrome = { storage: { local: {} } };
      assert.equal(hasChromeStorage(), false); // missing get function
    } finally {
      if (originalChrome !== undefined) globalThis.chrome = originalChrome;
      else delete globalThis.chrome;
    }
  });

  await t.test('getSettings retrieves default settings when storage is empty in fallback mode', async () => {
    const settings = await getSettings();
    assert.deepEqual(settings, DEFAULT_SETTINGS);
    assert.equal(settings.enabled, true);
    assert.equal(settings.showOverlays, true);
    assert.equal(settings.filterVerdict, 'all');
  });

  await t.test('saveSettings updates in-memory store and notifies listeners in fallback mode', async () => {
    const receivedChanges = [];
    const unsubscribe = onSettingsChanged((newSettings) => {
      receivedChanges.push(newSettings);
    });

    const updated = await saveSettings({ showOverlays: false, filterVerdict: 'misinformation' });

    assert.equal(updated.showOverlays, false);
    assert.equal(updated.filterVerdict, 'misinformation');
    assert.equal(updated.enabled, true); // retained default

    assert.equal(receivedChanges.length, 1);
    assert.equal(receivedChanges[0].showOverlays, false);
    assert.equal(receivedChanges[0].filterVerdict, 'misinformation');

    // Subsequent getSettings returns updated state
    const retrieved = await getSettings();
    assert.deepEqual(retrieved, updated);

    // Unsubscribe check
    unsubscribe();
    await saveSettings({ enabled: false });
    assert.equal(receivedChanges.length, 1, 'Unsubscribed listener must not be called again');
  });

  await t.test('saveSettings validates and rejects invalid filterVerdict or non-object payloads', async () => {
    await assert.rejects(
      async () => saveSettings(null),
      { name: 'TypeError' }
    );

    await assert.rejects(
      async () => saveSettings('invalid'),
      { name: 'TypeError' }
    );

    // Invalid filterVerdict should be ignored, keeping previous
    const current = await getSettings();
    const updated = await saveSettings({ filterVerdict: 'malicious_verdict' });
    assert.equal(updated.filterVerdict, current.filterVerdict, 'Invalid verdict must be ignored');
  });
});
