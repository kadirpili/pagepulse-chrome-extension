import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWarningOverlay,
  removeWarningOverlay,
  OverlayManager
} from '../src/overlay-manager.js';
import {
  createDrawer,
  updateActiveClaim,
  toggleDrawer,
  DrawerManager
} from '../src/drawer-manager.js';

// --- Lightweight Mock DOM Harness for Node.js ---
class MockElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.attributes = new Map();
    this.eventListeners = {};
    this._textContent = '';
    this._innerHTML = '';
    this.dataset = new Proxy({}, {
      set: (target, prop, val) => {
        target[prop] = String(val);
        const attrName = `data-${prop.replace(/[A-Z]/g, '-$&').toLowerCase()}`;
        this.attributes.set(attrName, String(val));
        return true;
      },
      get: (target, prop) => {
        const attrName = `data-${prop.replace(/[A-Z]/g, '-$&').toLowerCase()}`;
        if (this.attributes.has(attrName)) {
          return this.attributes.get(attrName);
        }
        return target[prop];
      }
    });

    this.classList = {
      _tokens: new Set(),
      add: (...tokens) => tokens.forEach((t) => {
        if (t) String(t).split(/\s+/).filter(Boolean).forEach((tok) => this.classList._tokens.add(tok));
      }),
      remove: (...tokens) => tokens.forEach((t) => {
        if (t) String(t).split(/\s+/).filter(Boolean).forEach((tok) => this.classList._tokens.delete(tok));
      }),
      toggle: (token, force) => {
        if (force === true) {
          this.classList._tokens.add(token);
          return true;
        } else if (force === false) {
          this.classList._tokens.delete(token);
          return false;
        }
        if (this.classList._tokens.has(token)) {
          this.classList._tokens.delete(token);
          return false;
        }
        this.classList._tokens.add(token);
        return true;
      },
      contains: (token) => this.classList._tokens.has(token)
    };
  }

  get className() {
    return Array.from(this.classList._tokens).join(' ');
  }

  set className(val) {
    this.classList._tokens.clear();
    if (val) {
      String(val).split(/\s+/).filter(Boolean).forEach((t) => this.classList._tokens.add(t));
    }
  }

  get textContent() {
    if (this._textContent) {
      return this._textContent;
    }
    if (this.children.length > 0) {
      return this.children.map((c) => c.textContent).join('');
    }
    if (this._innerHTML) {
      return this._innerHTML.replace(/<[^>]*>/g, '');
    }
    return '';
  }

  set textContent(val) {
    this._textContent = String(val);
    this._innerHTML = '';
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML || this.textContent;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this._textContent = '';
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(val) {
    this.setAttribute('id', val);
  }

  get firstChild() {
    return this.children[0] || null;
  }

  setAttribute(name, value) {
    const strVal = String(value);
    this.attributes.set(name, strVal);
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[prop] = strVal;
    }
    if (name === 'id') {
      // sync id
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      delete this.dataset[prop];
    }
  }

  appendChild(child) {
    if (!child) return child;
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      child.parentNode = null;
      this.children.splice(idx, 1);
    }
    return child;
  }

  replaceChildren(...newChildren) {
    while (this.children.length > 0) {
      const child = this.children.pop();
      child.parentNode = null;
    }
    for (const child of newChildren) {
      if (child) {
        this.appendChild(child);
      }
    }
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(event, handler) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter((h) => h !== handler);
  }

  dispatchEvent(event) {
    const type = event.type || event;
    const handlers = this.eventListeners[type] || [];
    const eventObj = typeof event === 'object' ? { target: this, ...event } : { target: this, type };
    for (const handler of handlers) {
      handler(eventObj);
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: 'click' });
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        if (curr.classList && curr.classList.contains(cls)) return curr;
      } else if (selector.startsWith('#')) {
        const id = selector.slice(1);
        if (curr.id === id) return curr;
      } else if (curr.tagName && curr.tagName.toLowerCase() === selector.toLowerCase()) {
        return curr;
      }
      curr = curr.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const matchNode = (node) => {
      let isMatch = false;
      if (selector.startsWith('#')) {
        isMatch = node.id === selector.slice(1);
      } else if (selector.startsWith('.')) {
        isMatch = node.classList.contains(selector.slice(1));
      } else if (selector.startsWith('[')) {
        const attrName = selector.replace(/[\[\]]/g, '').split('=')[0];
        isMatch = node.hasAttribute(attrName);
      } else if (node.tagName && node.tagName.toLowerCase() === selector.toLowerCase()) {
        isMatch = true;
      }

      if (isMatch) matches.push(node);
      for (const child of node.children) {
        matchNode(child);
      }
    };

    for (const child of this.children) {
      matchNode(child);
    }
    return matches;
  }
}

function createMockDocument() {
  const doc = {
    createElement(tag) {
      return new MockElement(tag);
    },
    getElementById(id) {
      return doc.body.querySelector(`#${id}`);
    },
    querySelector(selector) {
      return doc.body.querySelector(selector);
    },
    querySelectorAll(selector) {
      return doc.body.querySelectorAll(selector);
    }
  };
  doc.body = new MockElement('body');
  return doc;
}

// Set globalThis.document for modules
const mockDoc = createMockDocument();
globalThis.document = mockDoc;

const sampleMisinfoClaim = {
  timestamp: 42.5,
  sentence: 'The moon landing was filmed on a Hollywood sound stage.',
  verdict: 'misinformation',
  explanation: 'Physical evidence, Apollo telemetry, and lunar rock samples confirm actual lunar landings.',
  sources: ['https://www.nasa.gov/apollo', 'https://factcheck.afp.com/lunar-landing'],
  duration: 5.0
};

const sampleDrawerClaims = [
  {
    timestamp: 15.0,
    sentence: 'Water covers 71% of Earth surface.',
    verdict: 'verified',
    explanation: 'USGS hydrological survey confirms ocean surface coverage.',
    sources: ['https://usgs.gov/water']
  },
  {
    timestamp: 42.5,
    sentence: 'The moon landing was filmed on a sound stage.',
    verdict: 'misinformation',
    explanation: 'Debunked by NASA telemetry and photographic evidence.',
    sources: ['https://nasa.gov/apollo']
  },
  {
    timestamp: 95.0,
    sentence: 'A new subterranean pyramid was uncovered.',
    verdict: 'unknown',
    explanation: 'Archaeological investigation is ongoing without peer review.',
    sources: ['https://reuters.com/archive']
  }
];

test('dom-components: Warning Overlay Component', async (t) => {
  await t.test('creates overlay container with non-intrusive pointer-events and inner card with auto pointer-events', () => {
    const overlay = createWarningOverlay(sampleMisinfoClaim);
    assert.ok(overlay);
    assert.ok(overlay.classList.contains('yt-misinfo-overlay') || overlay.classList.contains('yt-misinfo-overlay-container'));
    assert.equal(overlay.style.pointerEvents, 'none');

    const card = overlay.querySelector('.yt-misinfo-card');
    assert.ok(card);
    assert.equal(card.style.pointerEvents, 'auto');
  });

  await t.test('renders warning badge, claim sentence, explanation, and verified sources', () => {
    const overlay = createWarningOverlay(sampleMisinfoClaim);
    const text = overlay.textContent;

    assert.ok(text.includes('Misinformation'), 'Overlay header must indicate misinformation');
    assert.ok(text.includes(sampleMisinfoClaim.sentence), 'Overlay must contain quoted sentence');
    assert.ok(text.includes(sampleMisinfoClaim.explanation), 'Overlay must contain explanation');

    const links = overlay.querySelectorAll('a');
    assert.ok(links.length >= 2, 'Should render source links');
    assert.equal(links[0].getAttribute('href'), sampleMisinfoClaim.sources[0]);
    assert.equal(links[0].getAttribute('target'), '_blank');
  });

  await t.test('dismiss button click triggers onDismiss callback and removes overlay', () => {
    let dismissed = false;
    const overlay = createWarningOverlay(sampleMisinfoClaim, {
      onDismiss: () => { dismissed = true; }
    });

    const dismissBtn = overlay.querySelector('.yt-misinfo-dismiss');
    assert.ok(dismissBtn, 'Dismiss button must exist');
    dismissBtn.click();

    assert.equal(dismissed, true, 'onDismiss callback must fire upon click');
  });

  await t.test('removeWarningOverlay cleanly unmounts overlay from player container', () => {
    const player = mockDoc.createElement('div');
    player.id = 'movie_player';
    const overlay = createWarningOverlay(sampleMisinfoClaim);
    player.appendChild(overlay);

    assert.equal(player.children.length, 1);
    removeWarningOverlay(player);
    assert.equal(player.children.length, 0);
  });
});

test('dom-components: Interactive Timeline Drawer Component', async (t) => {
  await t.test('creates drawer container with header, toggle button, and all claims in order', () => {
    const drawer = createDrawer(sampleDrawerClaims, { onSeek: () => {} });
    assert.ok(drawer);

    const cards = drawer.querySelectorAll('.yt-misinfo-card');
    assert.equal(cards.length, 3, 'Must render 3 claim cards');

    // Header claim counter
    const header = drawer.querySelector('.yt-misinfo-drawer-header');
    assert.ok(header);
    assert.ok(header.textContent.includes('3'), 'Header should display total claim count');
  });

  await t.test('applies color-coded badge classes corresponding to claim verdicts', () => {
    const drawer = createDrawer(sampleDrawerClaims, { onSeek: () => {} });
    const cards = drawer.querySelectorAll('.yt-misinfo-card');

    // Card 1: verified
    const badge1 = cards[0].querySelector('.badge-verified');
    assert.ok(badge1, 'Card 1 must have badge-verified');
    assert.ok(badge1.textContent.toLowerCase().includes('verified'));

    // Card 2: misinformation
    const badge2 = cards[1].querySelector('.badge-misinformation');
    assert.ok(badge2, 'Card 2 must have badge-misinformation');
    assert.ok(badge2.textContent.toLowerCase().includes('misinformation'));

    // Card 3: unknown
    const badge3 = cards[2].querySelector('.badge-unknown');
    assert.ok(badge3, 'Card 3 must have badge-unknown');
    assert.ok(badge3.textContent.toLowerCase().includes('unverified'));
  });

  await t.test('applies score 2-5 styles: red error warning for 4-5 and yellow warning for 2-3 without verdict', () => {
    const scoredClaims = [
      {
        timestamp: 10.0,
        sentence: 'Mildly disputed assertion.',
        score: 3.2,
        explanation: 'Evidence indicates key parts are misleading.',
        sources: ['https://factcheck.org/1']
      },
      {
        timestamp: 40.0,
        sentence: 'Blatantly false assertion.',
        score: 4.8,
        explanation: 'Completely debunked by scientific consensus.',
        sources: ['https://factcheck.org/2']
      }
    ];

    // Drawer tests
    const drawer = createDrawer(scoredClaims, { onSeek: () => {} });
    const cards = drawer.querySelectorAll('.yt-misinfo-card');

    // Card 1: Score 3.2 (Yellow warning, no verdict text)
    assert.ok(cards[0].classList.contains('yt-misinfo-timeline-card--warning'));
    const badge1 = cards[0].querySelector('.yt-misinfo-badge--warning');
    assert.ok(badge1, 'Must have .yt-misinfo-badge--warning');
    assert.equal(badge1.textContent, 'Score: 3.2');
    assert.equal(cards[0].querySelector('.badge-misinformation'), null, 'Must not show verdict badge');

    // Card 2: Score 4.8 (Red error warning, no verdict text)
    assert.ok(cards[1].classList.contains('yt-misinfo-timeline-card--danger'));
    const badge2 = cards[1].querySelector('.yt-misinfo-badge--danger');
    assert.ok(badge2, 'Must have .yt-misinfo-badge--danger');
    assert.equal(badge2.textContent, 'Score: 4.8');
    assert.equal(cards[1].querySelector('.badge-misinformation'), null, 'Must not show verdict badge');

    // Overlay tests
    const overlayYellow = createWarningOverlay(scoredClaims[0]);
    assert.ok(overlayYellow.querySelector('.yt-misinfo-card--warning'));
    assert.ok(overlayYellow.textContent.includes('Warning (Score: 3.2)'));

    const overlayRed = createWarningOverlay(scoredClaims[1]);
    assert.ok(overlayRed.querySelector('.yt-misinfo-card--danger'));
    assert.ok(overlayRed.textContent.includes('Score: 4.8'));
  });

  await t.test('formats timestamps chronologically as MM:SS', () => {
    const drawer = createDrawer(sampleDrawerClaims, { onSeek: () => {} });
    const cards = drawer.querySelectorAll('.yt-misinfo-card');

    assert.ok(cards[0].textContent.includes('00:15'));
    assert.ok(cards[1].textContent.includes('00:42'));
    assert.ok(cards[2].textContent.includes('01:35'));
  });

  await t.test('click-to-seek: clicking card dispatches onSeek callback with exact timestamp', () => {
    let seekedTime = null;
    const drawer = createDrawer(sampleDrawerClaims, {
      onSeek: (ts) => { seekedTime = ts; }
    });

    const cards = drawer.querySelectorAll('.yt-misinfo-card');

    // Click on Card 2 (timestamp 42.5)
    cards[1].click();
    assert.equal(seekedTime, 42.5);

    // Click on Card 1 (timestamp 15.0)
    cards[0].click();
    assert.equal(seekedTime, 15.0);
  });

  await t.test('toggleDrawer toggles collapsed state and aria-expanded attributes', () => {
    let toggleState = null;
    const drawer = createDrawer(sampleDrawerClaims, {
      onSeek: () => {},
      onToggle: (isOpen) => { toggleState = isOpen; }
    });

    const toggleBtn = drawer.querySelector('.yt-misinfo-drawer-toggle');
    assert.ok(toggleBtn);

    // Toggle collapsed
    const newState = toggleDrawer(drawer);
    assert.ok(drawer.classList.contains('is-collapsed'));
    assert.equal(drawer.getAttribute('aria-expanded'), 'false');

    // Toggle expanded
    const restoredState = toggleDrawer(drawer);
    assert.equal(drawer.classList.contains('is-collapsed'), false);
    assert.equal(drawer.getAttribute('aria-expanded'), 'true');
  });

  await t.test('updateActiveClaim highlights playing sentence and removes highlights when outside claims', () => {
    const drawer = createDrawer(sampleDrawerClaims, { onSeek: () => {} });
    const cards = drawer.querySelectorAll('.yt-misinfo-card');

    // Activate Card 2
    updateActiveClaim(drawer, sampleDrawerClaims[1]);
    assert.equal(cards[1].classList.contains('is-active'), true);
    assert.equal(cards[0].classList.contains('is-active'), false);
    assert.equal(cards[2].classList.contains('is-active'), false);

    // Deactivate all
    updateActiveClaim(drawer, null);
    assert.equal(cards[1].classList.contains('is-active'), false);
    assert.equal(cards[0].classList.contains('is-active'), false);
    assert.equal(cards[2].classList.contains('is-active'), false);
  });
});

test('dom-components: OverlayManager & DrawerManager Class APIs', async (t) => {
  await t.test('OverlayManager mount, show, hide, dismiss, and destroy', () => {
    const player = mockDoc.createElement('div');
    player.id = 'movie_player';
    mockDoc.body.appendChild(player);

    const om = new OverlayManager({ playerElement: player });
    om.mount();
    assert.ok(player.querySelector('#yt-misinfo-overlay-root'));

    om.update(sampleMisinfoClaim, { enabled: true, showOverlays: true });
    assert.ok(player.querySelector('.yt-misinfo-card'));

    om.dismiss();
    assert.equal(om.activeClaim, null);

    om.destroy();
    assert.equal(player.querySelector('#yt-misinfo-overlay-root'), null);
  });

  await t.test('DrawerManager mount, setClaims, filter, and seek', () => {
    let seeked = null;
    const dm = new DrawerManager({ onSeek: (ts) => { seeked = ts; } });
    dm.mount(mockDoc.body);
    dm.setClaims(sampleDrawerClaims);

    assert.equal(dm.claims.length, 3);
    dm.open();
    assert.equal(dm.isOpen(), true);

    dm.setFilter('misinformation');
    assert.equal(dm.currentFilter, 'misinformation');

    dm.close();
    assert.equal(dm.isOpen(), false);
    dm.destroy();
  });

  await t.test('DrawerManager setLoading and setError states', () => {
    let retried = false;
    const dm = new DrawerManager();
    dm.mount(mockDoc.body);

    // 1. Loading state
    dm.setLoading('Extracting captions and evaluating claims...');
    assert.equal(dm.isLoading, true);
    assert.ok(dm.cardsListElement.querySelector('.yt-misinfo-state-loading'));
    assert.ok(dm.cardsListElement.textContent.includes('Analyzing Video'));
    assert.ok(dm.cardsListElement.textContent.includes('Extracting captions'));

    // 2. Error state with retry
    dm.setError('Captions unavailable for this video.', () => { retried = true; });
    assert.equal(dm.isLoading, false);
    assert.equal(dm.errorMessage, 'Captions unavailable for this video.');
    assert.ok(dm.cardsListElement.querySelector('.yt-misinfo-state-error'));
    assert.ok(dm.cardsListElement.textContent.includes('Captions unavailable'));

    const retryBtn = dm.cardsListElement.querySelector('.yt-misinfo-btn-retry');
    assert.ok(retryBtn, 'Retry button should be rendered');
    retryBtn.click();
    assert.equal(retried, true, 'Clicking retry button must trigger callback');

    // 3. Recovery via setClaims
    dm.setClaims(sampleDrawerClaims);
    assert.equal(dm.isLoading, false);
    assert.equal(dm.errorMessage, null);
    assert.equal(dm.cardsListElement.querySelectorAll('.yt-misinfo-card').length, 3);

    dm.destroy();
  });
});

test('dom-components: Security & XSS Sanitization', async (t) => {
  const xssClaim = {
    timestamp: 10.0,
    sentence: '<script>alert("pwned")</script><img src=x onerror=alert(1)>',
    verdict: 'misinformation',
    explanation: '<svg onload=alert(2)>Explanation</svg>',
    sources: [
      'javascript:alert(document.cookie)',
      'https://safe-factcheck.org/evidence'
    ]
  };

  await t.test('escapes malicious HTML payloads into plain text without script elements', () => {
    const overlay = createWarningOverlay(xssClaim);

    // Text content contains verbatim characters
    assert.ok(overlay.textContent.includes('<script>alert("pwned")</script>'));

    // Assert DOM contains NO script or img child tags
    const scripts = overlay.querySelectorAll('script');
    assert.equal(scripts.length, 0, 'No script tags must be inserted into DOM');

    const svg = overlay.querySelectorAll('svg');
    assert.equal(svg.length, 0, 'No injected SVG tags allowed');
  });

  await t.test('sanitizes source links, blocking javascript: pseudo-protocols', () => {
    const overlay = createWarningOverlay(xssClaim);
    const links = overlay.querySelectorAll('a');

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      assert.ok(!href.toLowerCase().startsWith('javascript:'), `Blocked dangerous href: ${href}`);
    }

    // Legit link is preserved
    const safeLink = links.find((l) => l.getAttribute('href') === 'https://safe-factcheck.org/evidence');
    assert.ok(safeLink, 'Safe HTTPS factcheck link should be present');
  });
});
