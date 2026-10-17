import { formatTimestamp } from './youtube-url.js';

/**
 * Creates an interactive timeline drawer element tree.
 *
 * @param {Array<Object>} [claims=[]]
 * @param {Object} [options]
 * @param {(timestamp: number) => void} [options.onSeek]
 * @param {(isOpen: boolean) => void} [options.onToggle]
 * @returns {HTMLElement} The drawer element.
 */
export function createDrawer(claims = [], options = {}) {
  const sorted = [...claims].sort((a, b) => a.timestamp - b.timestamp);

  const drawer = document.createElement('div');
  drawer.id = 'yt-misinfo-drawer';
  drawer.className = 'yt-misinfo-drawer-panel';
  drawer.setAttribute('role', 'complementary');
  drawer.setAttribute('aria-label', 'Fact check claims timeline');
  drawer.setAttribute('aria-expanded', 'true');

  // Header
  const header = document.createElement('header');
  header.className = 'yt-misinfo-drawer-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'yt-misinfo-drawer-title-group';

  const title = document.createElement('h2');
  title.className = 'yt-misinfo-drawer-title';
  title.textContent = 'Claims Timeline';

  const countBadge = document.createElement('span');
  countBadge.className = 'yt-misinfo-drawer-total-badge';
  countBadge.id = 'yt-misinfo-drawer-total';
  countBadge.textContent = String(sorted.length);

  titleGroup.appendChild(title);
  titleGroup.appendChild(countBadge);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'yt-misinfo-drawer-toggle yt-misinfo-drawer-close';
  toggleBtn.setAttribute('aria-label', 'Toggle timeline drawer');
  toggleBtn.textContent = '×';
  toggleBtn.addEventListener('click', () => {
    toggleDrawer(drawer, options.onToggle);
  });

  header.appendChild(titleGroup);
  header.appendChild(toggleBtn);

  // Filter Chips
  const filterNav = document.createElement('nav');
  filterNav.className = 'yt-misinfo-drawer-filters';
  filterNav.setAttribute('role', 'tablist');

  const misinfoCount = sorted.filter((c) => c.verdict === 'misinformation').length;
  const verifiedCount = sorted.filter((c) => c.verdict === 'verified').length;
  const unknownCount = sorted.filter((c) => c.verdict === 'unknown').length;

  const filterDefs = [
    { key: 'all', label: `All (${sorted.length})`, active: true },
    { key: 'misinformation', label: `Misinformation (${misinfoCount})`, active: false },
    { key: 'verified', label: `Verified (${verifiedCount})`, active: false },
    { key: 'unknown', label: `Unverified (${unknownCount})`, active: false }
  ];

  filterDefs.forEach((f) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `yt-misinfo-filter-chip${f.active ? ' yt-misinfo-filter-chip--active' : ''}`;
    chip.dataset.filter = f.key;
    chip.textContent = f.label;
    filterNav.appendChild(chip);
  });

  // Body & Cards list
  const body = document.createElement('div');
  body.className = 'yt-misinfo-drawer-body';

  const cardsList = document.createElement('div');
  cardsList.className = 'yt-misinfo-cards-list';
  cardsList.setAttribute('role', 'list');

  if (sorted.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'yt-misinfo-empty-state';
    emptyState.style.cssText = 'padding: 36px 16px; text-align: center; color: #888; font-size: 13px; line-height: 1.6;';
    emptyState.innerHTML = '<div style="font-size: 28px; margin-bottom: 8px;">🛡️</div><div>No claims recorded for this video.</div><div style="font-size: 11px; color: #666; margin-top: 4px;">Fact-check data will appear here when available.</div>';
    cardsList.appendChild(emptyState);
  }

  sorted.forEach((claim) => {
    const hasScore = typeof claim.score === 'number';
    const isDanger = hasScore ? claim.score >= 4 : claim.verdict === 'misinformation';
    const isWarning = hasScore && claim.score < 4;

    const card = document.createElement('article');
    const scoreCardClass = hasScore
      ? (isDanger ? 'yt-misinfo-timeline-card--danger' : 'yt-misinfo-timeline-card--warning')
      : `yt-misinfo-timeline-card--${claim.verdict}`;
    card.className = `yt-misinfo-timeline-card yt-misinfo-card ${scoreCardClass} yt-misinfo-timeline-card--${claim.verdict || 'unknown'}`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.dataset.timestamp = String(claim.timestamp);
    card.dataset.verdict = claim.verdict;

    // Top Row
    const topRow = document.createElement('div');
    topRow.className = 'yt-misinfo-card-row-top';

    const tsPill = document.createElement('button');
    tsPill.type = 'button';
    tsPill.className = 'yt-misinfo-ts-pill';
    tsPill.title = `Jump to ${formatTimestamp(claim.timestamp)}`;
    tsPill.textContent = `▶ ${formatTimestamp(claim.timestamp)}`;

    topRow.appendChild(tsPill);

    if (hasScore) {
      const badge = document.createElement('span');
      badge.className = `yt-misinfo-badge ${isDanger ? 'yt-misinfo-badge--danger' : 'yt-misinfo-badge--warning'}`;
      badge.textContent = `Score: ${claim.score}`;
      topRow.appendChild(badge);
    } else {
      const badge = document.createElement('span');
      badge.className = `yt-misinfo-badge yt-misinfo-badge--${claim.verdict} badge-${claim.verdict}`;
      badge.textContent =
        claim.verdict === 'misinformation'
          ? 'Misinformation'
          : claim.verdict === 'verified'
            ? 'Verified'
            : 'Unverified';
      topRow.appendChild(badge);
    }

    // Quote & Explanation (Sanitized via textContent)
    const quote = document.createElement('p');
    quote.className = 'yt-misinfo-card-quote';
    quote.textContent = `“${claim.sentence}”`;

    const desc = document.createElement('p');
    desc.className = 'yt-misinfo-card-desc';
    desc.textContent = claim.explanation;

    card.appendChild(topRow);
    card.appendChild(quote);
    card.appendChild(desc);

    // Sources
    if (claim.sources && Array.isArray(claim.sources) && claim.sources.length > 0) {
      const sourcesDiv = document.createElement('div');
      sourcesDiv.className = 'yt-misinfo-card-sources';

      const label = document.createElement('span');
      label.className = 'yt-misinfo-sources-label';
      label.textContent = 'Sources:';
      sourcesDiv.appendChild(label);

      claim.sources.forEach((src) => {
        if (typeof src === 'string' && /^https?:\/\//i.test(src.trim())) {
          const link = document.createElement('a');
          link.className = 'yt-misinfo-source-link';
          link.href = src.trim();
          link.setAttribute('href', src.trim());
          link.target = '_blank';
          link.setAttribute('target', '_blank');
          link.rel = 'noopener noreferrer';
          try {
            link.textContent = new URL(src.trim()).hostname.replace(/^www\./, '');
          } catch {
            link.textContent = 'source';
          }
          sourcesDiv.appendChild(link);
        }
      });

      card.appendChild(sourcesDiv);
    }

    // Card click listener
    card.addEventListener('click', (e) => {
      if (e && e.target && typeof e.target.closest === 'function' && e.target.closest('a')) {
        return;
      }
      if (typeof options.onSeek === 'function') {
        options.onSeek(claim.timestamp);
      }
    });

    cardsList.appendChild(card);
  });

  body.appendChild(cardsList);

  drawer.appendChild(header);
  drawer.appendChild(filterNav);
  drawer.appendChild(body);

  return drawer;
}

/**
 * Toggles the collapsed state of a drawer element.
 *
 * @param {HTMLElement} drawerElement
 * @param {(isOpen: boolean) => void} [onToggle]
 * @returns {boolean} Whether drawer is now collapsed.
 */
export function toggleDrawer(drawerElement, onToggle) {
  if (!drawerElement || !drawerElement.classList) return false;

  const isCollapsed = drawerElement.classList.toggle('is-collapsed');
  drawerElement.classList.toggle('yt-misinfo-drawer-panel--collapsed', isCollapsed);
  drawerElement.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');

  if (typeof onToggle === 'function') {
    onToggle(!isCollapsed);
  }

  return isCollapsed;
}

/**
 * Updates which claim card is highlighted as active in the drawer.
 *
 * @param {HTMLElement} drawerElement
 * @param {Object|null} activeClaim
 */
export function updateActiveClaim(drawerElement, activeClaim) {
  if (!drawerElement || typeof drawerElement.querySelectorAll !== 'function') return;

  const cards = drawerElement.querySelectorAll('.yt-misinfo-card');
  cards.forEach((card) => {
    const ts = parseFloat(card.dataset.timestamp);
    if (activeClaim && !isNaN(ts) && ts === activeClaim.timestamp) {
      card.classList.add('is-active', 'yt-misinfo-card--active');
    } else {
      card.classList.remove('is-active', 'yt-misinfo-card--active');
    }
  });
}

/**
 * Manages the collapsible interactive timeline drawer listing all analyzed claims chronologically.
 */
export class DrawerManager {
  /**
   * @param {Object} [options]
   * @param {HTMLElement} [options.parent]
   * @param {(timestamp: number) => void} [options.onSeek]
   */
  constructor(options = {}) {
    this.parent = options.parent || null;
    this.root = null;
    this.tabElement = null;
    this.panelElement = null;
    this.cardsListElement = null;
    this.emptyStateElement = null;
    this.totalBadge = null;
    this.tabCount = null;
    this.tabAlertDot = null;

    this.claims = [];
    this.activeClaim = null;
    this.currentFilter = 'all'; // 'all' | 'misinformation' | 'verified' | 'unknown'
    this.isOpenState = false;
    this.isLoading = false;
    this.errorMessage = null;
    this.onSeekCallback = options.onSeek || null;
  }

  /**
   * Injects the drawer and floating toggle tab into the DOM.
   * @param {HTMLElement} [parent]
   * @returns {HTMLElement}
   */
  mount(parent) {
    if (parent) {
      this.parent = parent;
    }
    if (!this.parent && typeof document !== 'undefined') {
      this.parent = document.body;
    }
    if (!this.parent) return null;

    let existing = document.getElementById('yt-misinfo-drawer-root');
    if (existing) {
      this.root = existing;
      this._bindElements();
      return this.root;
    }

    this.root = document.createElement('div');
    this.root.id = 'yt-misinfo-drawer-root';

    // 1. Floating Toggle Tab
    this.tabElement = document.createElement('button');
    this.tabElement.id = 'yt-misinfo-drawer-tab';
    this.tabElement.className = 'yt-misinfo-drawer-tab';
    this.tabElement.setAttribute('aria-label', 'Toggle Fact Check Timeline');
    this.tabElement.setAttribute('title', 'Toggle Fact Check Timeline');

    const tabLabel = document.createElement('span');
    tabLabel.className = 'yt-misinfo-tab-label';
    tabLabel.textContent = 'Claims';

    this.tabCount = document.createElement('span');
    this.tabCount.className = 'yt-misinfo-tab-count';
    this.tabCount.textContent = '0';

    this.tabAlertDot = document.createElement('span');
    this.tabAlertDot.className = 'yt-misinfo-tab-alert-dot yt-misinfo-hidden';

    this.tabElement.appendChild(tabLabel);
    this.tabElement.appendChild(this.tabCount);
    this.tabElement.appendChild(this.tabAlertDot);
    this.tabElement.addEventListener('click', () => this.toggle());

    // 2. Sliding Drawer Panel
    this.panelElement = document.createElement('aside');
    this.panelElement.id = 'yt-misinfo-drawer-panel';
    this.panelElement.className = 'yt-misinfo-drawer-panel yt-misinfo-drawer-panel--collapsed is-collapsed';
    this.panelElement.setAttribute('role', 'complementary');
    this.panelElement.setAttribute('aria-label', 'Fact check claims timeline');
    this.panelElement.setAttribute('aria-expanded', 'false');

    // Header
    const header = document.createElement('header');
    header.className = 'yt-misinfo-drawer-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'yt-misinfo-drawer-title-group';

    const title = document.createElement('h2');
    title.className = 'yt-misinfo-drawer-title';
    title.textContent = 'Claims Timeline';

    this.totalBadge = document.createElement('span');
    this.totalBadge.className = 'yt-misinfo-drawer-total-badge';
    this.totalBadge.id = 'yt-misinfo-drawer-total';
    this.totalBadge.textContent = '0';

    titleGroup.appendChild(title);
    titleGroup.appendChild(this.totalBadge);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'yt-misinfo-drawer-close yt-misinfo-drawer-toggle';
    closeBtn.setAttribute('aria-label', 'Close timeline drawer');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(titleGroup);
    header.appendChild(closeBtn);

    // Filter Chips
    const filters = document.createElement('nav');
    filters.className = 'yt-misinfo-drawer-filters';
    filters.setAttribute('role', 'tablist');

    const filterDefs = [
      { key: 'all', label: 'All', active: true },
      { key: 'misinformation', label: 'Misinformation', active: false },
      { key: 'verified', label: 'Verified', active: false },
      { key: 'unknown', label: 'Unverified', active: false }
    ];

    filterDefs.forEach((f) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `yt-misinfo-filter-chip${f.active ? ' yt-misinfo-filter-chip--active' : ''}`;
      chip.dataset.filter = f.key;
      chip.textContent = f.label;
      filters.appendChild(chip);
    });

    filters.addEventListener('click', (e) => {
      const chip = e.target && typeof e.target.closest === 'function' ? e.target.closest('.yt-misinfo-filter-chip') : null;
      if (chip && chip.dataset.filter) {
        this.setFilter(chip.dataset.filter);
      }
    });

    // Body
    const body = document.createElement('div');
    body.className = 'yt-misinfo-drawer-body';

    this.cardsListElement = document.createElement('div');
    this.cardsListElement.className = 'yt-misinfo-cards-list';
    this.cardsListElement.setAttribute('role', 'list');
    this._attachEventDelegation(this.cardsListElement);

    this.emptyStateElement = document.createElement('div');
    this.emptyStateElement.className = 'yt-misinfo-empty-state yt-misinfo-hidden';
    this.emptyStateElement.textContent = 'No claims match the selected filter.';

    body.appendChild(this.cardsListElement);
    body.appendChild(this.emptyStateElement);

    // Footer
    const footer = document.createElement('footer');
    footer.className = 'yt-misinfo-drawer-footer';
    footer.textContent = 'YouTube Misinformation Detector • Real-time';

    this.panelElement.appendChild(header);
    this.panelElement.appendChild(filters);
    this.panelElement.appendChild(body);
    this.panelElement.appendChild(footer);

    this.root.appendChild(this.tabElement);
    this.root.appendChild(this.panelElement);
    this.parent.appendChild(this.root);

    this._bindElements();
    return this.root;
  }

  _bindElements() {
    if (!this.root) return;
    this.tabElement = this.root.querySelector('#yt-misinfo-drawer-tab');
    this.panelElement = this.root.querySelector('#yt-misinfo-drawer-panel');
    this.cardsListElement = this.root.querySelector('.yt-misinfo-cards-list');
    this.emptyStateElement = this.root.querySelector('.yt-misinfo-empty-state');
    this.totalBadge = this.root.querySelector('#yt-misinfo-drawer-total');
    this.tabCount = this.root.querySelector('.yt-misinfo-tab-count');
    this.tabAlertDot = this.root.querySelector('.yt-misinfo-tab-alert-dot');
  }

  _attachEventDelegation(container) {
    container.addEventListener('click', (e) => {
      // Don't intercept clicks on source links
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('a')) return;

      const card = e.target && typeof e.target.closest === 'function' ? e.target.closest('.yt-misinfo-timeline-card') : null;
      if (card && card.dataset.timestamp) {
        const timestamp = parseFloat(card.dataset.timestamp);
        if (!isNaN(timestamp) && typeof this.onSeekCallback === 'function') {
          this.onSeekCallback(timestamp);
        }
      }
    });

    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target && typeof e.target.closest === 'function' ? e.target.closest('.yt-misinfo-timeline-card') : null;
        if (card && card.dataset.timestamp) {
          e.preventDefault();
          const timestamp = parseFloat(card.dataset.timestamp);
          if (!isNaN(timestamp) && typeof this.onSeekCallback === 'function') {
            this.onSeekCallback(timestamp);
          }
        }
      }
    });
  }

  /**
  /**
   * Sets the drawer into an active loading state while fact-checks are being fetched.
   * @param {string} [message]
   */
  setLoading(message = 'Analyzing video transcript and fact-checking claims with AI...') {
    this.isLoading = true;
    this.errorMessage = null;
    this._updateCounters();

    if (this.emptyStateElement) {
      this.emptyStateElement.classList.add('yt-misinfo-hidden');
    }

    if (this.cardsListElement) {
      if (typeof this.cardsListElement.replaceChildren === 'function') {
        this.cardsListElement.replaceChildren();
      } else {
        while (this.cardsListElement.firstChild) {
          this.cardsListElement.removeChild(this.cardsListElement.firstChild);
        }
      }

      const box = document.createElement('div');
      box.className = 'yt-misinfo-state-box yt-misinfo-state-loading';

      const spinner = document.createElement('div');
      spinner.className = 'yt-misinfo-spinner-circle';

      const title = document.createElement('div');
      title.className = 'yt-misinfo-state-title';
      title.textContent = 'Analyzing Video';

      const desc = document.createElement('div');
      desc.className = 'yt-misinfo-state-desc';
      desc.textContent = message;

      box.appendChild(spinner);
      box.appendChild(title);
      box.appendChild(desc);
      this.cardsListElement.appendChild(box);
    }
  }

  /**
   * Sets the drawer into an error state if fetching or fact-checking fails.
   * @param {string} errorMessage
   * @param {() => void} [onRetry]
   */
  setError(errorMessage, onRetry) {
    this.isLoading = false;
    this.errorMessage = errorMessage;
    this._updateCounters();

    if (this.emptyStateElement) {
      this.emptyStateElement.classList.add('yt-misinfo-hidden');
    }

    if (this.cardsListElement) {
      if (typeof this.cardsListElement.replaceChildren === 'function') {
        this.cardsListElement.replaceChildren();
      } else {
        while (this.cardsListElement.firstChild) {
          this.cardsListElement.removeChild(this.cardsListElement.firstChild);
        }
      }

      const box = document.createElement('div');
      box.className = 'yt-misinfo-state-box yt-misinfo-state-error';

      const icon = document.createElement('div');
      icon.style.cssText = 'font-size: 32px; margin-bottom: 12px;';
      icon.textContent = '⚠️';

      const title = document.createElement('div');
      title.className = 'yt-misinfo-state-title';
      title.style.color = '#ff4d4f';
      title.textContent = 'Fact-Check Service Notice';

      const desc = document.createElement('div');
      desc.className = 'yt-misinfo-state-desc';
      desc.textContent = errorMessage || 'Failed to retrieve analysis from backend service.';

      box.appendChild(icon);
      box.appendChild(title);
      box.appendChild(desc);

      if (typeof onRetry === 'function') {
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'yt-misinfo-btn-retry';
        retryBtn.textContent = 'Retry Analysis';
        retryBtn.addEventListener('click', (e) => {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          onRetry();
        });
        box.appendChild(retryBtn);
      }

      this.cardsListElement.appendChild(box);
    }
  }

  /**
   * Sets the claims array and re-renders the chronological cards.
   * @param {Array<Object>} [claims=[]]
   */
  setClaims(claims = []) {
    this.isLoading = false;
    this.errorMessage = null;
    this.claims = [...claims].sort((a, b) => a.timestamp - b.timestamp);
    this._updateCounters();
    this.render();
  }

  _updateCounters() {
    if (this.isLoading) {
      if (this.totalBadge) this.totalBadge.textContent = '⏳';
      if (this.tabCount) this.tabCount.textContent = '⏳';
      if (this.tabAlertDot) this.tabAlertDot.classList.add('yt-misinfo-hidden');
      return;
    }

    if (this.errorMessage) {
      if (this.totalBadge) this.totalBadge.textContent = '!';
      if (this.tabCount) this.tabCount.textContent = '!';
      if (this.tabAlertDot) this.tabAlertDot.classList.remove('yt-misinfo-hidden');
      return;
    }

    const total = this.claims.length;
    const misinfoCount = this.claims.filter((c) => c.verdict === 'misinformation').length;

    if (this.totalBadge) this.totalBadge.textContent = String(total);
    if (this.tabCount) this.tabCount.textContent = String(total);
    if (this.tabAlertDot) {
      if (misinfoCount > 0) {
        this.tabAlertDot.classList.remove('yt-misinfo-hidden');
      } else {
        this.tabAlertDot.classList.add('yt-misinfo-hidden');
      }
    }

    if (this.root) {
      const chips = this.root.querySelectorAll('.yt-misinfo-filter-chip');
      chips.forEach((chip) => {
        const f = chip.dataset.filter;
        if (f === 'all') chip.textContent = `All (${total})`;
        else if (f === 'misinformation') chip.textContent = `Misinformation (${misinfoCount})`;
        else if (f === 'verified') chip.textContent = `Verified (${this.claims.filter((c) => c.verdict === 'verified').length})`;
        else if (f === 'unknown') chip.textContent = `Unverified (${this.claims.filter((c) => c.verdict === 'unknown').length})`;
      });
    }
  }

  /**
   * Renders the claim cards according to the active filter.
   */
  render() {
    if (!this.cardsListElement) return;
    if (this.isLoading || this.errorMessage) return;

    const filtered = this.claims.filter((claim) => {
      if (this.currentFilter === 'all') return true;
      return claim.verdict === this.currentFilter;
    });

    if (typeof this.cardsListElement.replaceChildren === 'function') {
      this.cardsListElement.replaceChildren();
    } else {
      while (this.cardsListElement.firstChild) {
        this.cardsListElement.removeChild(this.cardsListElement.firstChild);
      }
    }

    if (filtered.length === 0) {
      if (this.emptyStateElement) this.emptyStateElement.classList.remove('yt-misinfo-hidden');
      return;
    }

    if (this.emptyStateElement) this.emptyStateElement.classList.add('yt-misinfo-hidden');

    filtered.forEach((claim) => {
      const hasScore = typeof claim.score === 'number';
      const isDanger = hasScore ? claim.score >= 4 : claim.verdict === 'misinformation';
      const isWarning = hasScore && claim.score < 4;

      const card = document.createElement('article');
      const scoreCardClass = hasScore
        ? (isDanger ? 'yt-misinfo-timeline-card--danger' : 'yt-misinfo-timeline-card--warning')
        : `yt-misinfo-timeline-card--${claim.verdict}`;
      card.className = `yt-misinfo-timeline-card yt-misinfo-card ${scoreCardClass} yt-misinfo-timeline-card--${claim.verdict || 'unknown'}`;
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');
      card.dataset.timestamp = String(claim.timestamp);
      card.dataset.verdict = claim.verdict;

      if (this.activeClaim && this.activeClaim.timestamp === claim.timestamp) {
        card.classList.add('yt-misinfo-card--active', 'is-active');
      }

      // Top Row (Timestamp Pill + Score / Verdict Badge)
      const topRow = document.createElement('div');
      topRow.className = 'yt-misinfo-card-row-top';

      const tsPill = document.createElement('button');
      tsPill.type = 'button';
      tsPill.className = 'yt-misinfo-ts-pill';
      tsPill.title = `Jump to ${formatTimestamp(claim.timestamp)}`;
      tsPill.textContent = `▶ ${formatTimestamp(claim.timestamp)}`;

      topRow.appendChild(tsPill);

      if (hasScore) {
        const badge = document.createElement('span');
        badge.className = `yt-misinfo-badge ${isDanger ? 'yt-misinfo-badge--danger' : 'yt-misinfo-badge--warning'}`;
        badge.textContent = `Score: ${claim.score}`;
        topRow.appendChild(badge);
      } else {
        const badge = document.createElement('span');
        badge.className = `yt-misinfo-badge yt-misinfo-badge--${claim.verdict} badge-${claim.verdict}`;
        badge.textContent =
          claim.verdict === 'misinformation'
            ? 'Misinformation'
            : claim.verdict === 'verified'
              ? 'Verified'
              : 'Unverified';
        topRow.appendChild(badge);
      }

      // Quote & Explanation (Sanitized with textContent)
      const quote = document.createElement('p');
      quote.className = 'yt-misinfo-card-quote';
      quote.textContent = `“${claim.sentence}”`;

      const desc = document.createElement('p');
      desc.className = 'yt-misinfo-card-desc';
      desc.textContent = claim.explanation;

      card.appendChild(topRow);
      card.appendChild(quote);
      card.appendChild(desc);

      // Sources
      if (claim.sources && Array.isArray(claim.sources) && claim.sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'yt-misinfo-card-sources';

        const label = document.createElement('span');
        label.className = 'yt-misinfo-sources-label';
        label.textContent = 'Sources:';
        sourcesDiv.appendChild(label);

        claim.sources.forEach((src) => {
          if (typeof src === 'string' && /^https?:\/\//i.test(src.trim())) {
            const link = document.createElement('a');
            link.className = 'yt-misinfo-source-link';
            link.href = src.trim();
            link.setAttribute('href', src.trim());
            link.target = '_blank';
            link.setAttribute('target', '_blank');
            link.rel = 'noopener noreferrer';
            try {
              link.textContent = new URL(src.trim()).hostname.replace(/^www\./, '');
            } catch {
              link.textContent = 'source';
            }
            sourcesDiv.appendChild(link);
          }
        });

        card.appendChild(sourcesDiv);
      }

      this.cardsListElement.appendChild(card);
    });
  }

  /**
   * Highlights the active claim currently playing and scrolls into view.
   * @param {Object|null} activeClaim
   */
  setActiveClaim(activeClaim) {
    this.activeClaim = activeClaim;
    if (!this.cardsListElement) return;

    const cards = this.cardsListElement.querySelectorAll('.yt-misinfo-timeline-card');
    cards.forEach((card) => {
      const ts = parseFloat(card.dataset.timestamp);
      if (activeClaim && ts === activeClaim.timestamp) {
        if (!card.classList.contains('yt-misinfo-card--active')) {
          card.classList.add('yt-misinfo-card--active', 'is-active');
          if (this.isOpenState && typeof card.scrollIntoView === 'function') {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      } else {
        card.classList.remove('yt-misinfo-card--active', 'is-active');
      }
    });
  }

  /**
   * Filters the visible cards by verdict.
   * @param {'all' | 'misinformation' | 'verified' | 'unknown'} filter
   */
  setFilter(filter) {
    this.currentFilter = filter;
    if (this.root) {
      const chips = this.root.querySelectorAll('.yt-misinfo-filter-chip');
      chips.forEach((chip) => {
        if (chip.dataset.filter === filter) {
          chip.classList.add('yt-misinfo-filter-chip--active');
        } else {
          chip.classList.remove('yt-misinfo-filter-chip--active');
        }
      });
    }
    this.render();
  }

  open() {
    this.isOpenState = true;
    if (this.panelElement) {
      this.panelElement.classList.remove('yt-misinfo-drawer-panel--collapsed', 'is-collapsed');
      this.panelElement.setAttribute('aria-expanded', 'true');
    }
    if (this.activeClaim) {
      this.setActiveClaim(this.activeClaim);
    }
  }

  close() {
    this.isOpenState = false;
    if (this.panelElement) {
      this.panelElement.classList.add('yt-misinfo-drawer-panel--collapsed', 'is-collapsed');
      this.panelElement.setAttribute('aria-expanded', 'false');
    }
  }

  toggle() {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open();
    }
  }

  isOpen() {
    return this.isOpenState;
  }

  /**
   * Registers a seek callback when a claim or timestamp is clicked.
   * @param {(timestamp: number) => void} callback
   */
  onSeek(callback) {
    this.onSeekCallback = callback;
  }

  /**
   * Removes drawer from DOM and cleans up listeners.
   */
  destroy() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.claims = [];
    this.activeClaim = null;
    this.isOpenState = false;
  }
}
