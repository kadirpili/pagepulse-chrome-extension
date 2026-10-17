import { formatTimestamp } from './youtube-url.js';

/**
 * Creates an in-video warning overlay element tree for a misinformation claim.
 *
 * @param {Object} claim - The claim object.
 * @param {Object} [options] - Optional settings (e.g. onDismiss callback).
 * @param {() => void} [options.onDismiss] - Called when the dismiss button is clicked.
 * @param {() => void} [options.onViewTimeline] - Called when "View in Timeline" is clicked.
 * @returns {HTMLElement} The overlay container element.
 */
export function createWarningOverlay(claim, options = {}) {
  const container = document.createElement('div');
  container.id = 'yt-misinfo-overlay-root';
  container.className = 'yt-misinfo-overlay-container yt-misinfo-overlay';
  container.style.pointerEvents = 'none';

  const card = document.createElement('div');
  card.className = 'yt-misinfo-card yt-misinfo-card--misinformation';
  card.setAttribute('role', 'alert');
  card.setAttribute('aria-live', 'polite');
  card.style.pointerEvents = 'auto';
  if (claim && typeof claim.timestamp === 'number') {
    card.dataset.timestamp = String(claim.timestamp);
  }

  // Header
  const header = document.createElement('div');
  header.className = 'yt-misinfo-card-header';

  const badge = document.createElement('div');
  badge.className = 'yt-misinfo-card-badge';
  badge.innerHTML = `
    <svg class="yt-misinfo-icon" viewBox="0 0 24 24" width="16" height="16">
      <path d="M12 2L1 21h22L12 2zm0 3.5L20 19H4L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="currentColor"/>
    </svg>
    <span class="yt-misinfo-card-badge-text">Misinformation Alert</span>
  `;

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'yt-misinfo-card-dismiss yt-misinfo-dismiss';
  dismissBtn.setAttribute('aria-label', 'Dismiss alert');
  dismissBtn.innerHTML = '&times;';
  dismissBtn.addEventListener('click', (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof options.onDismiss === 'function') {
      options.onDismiss();
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  header.appendChild(badge);
  header.appendChild(dismissBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'yt-misinfo-card-body';

  const meta = document.createElement('div');
  meta.className = 'yt-misinfo-card-meta';
  const timeSpan = document.createElement('span');
  timeSpan.className = 'yt-misinfo-card-time';
  timeSpan.textContent = formatTimestamp(claim?.timestamp || 0);
  meta.appendChild(timeSpan);

  const quote = document.createElement('blockquote');
  quote.className = 'yt-misinfo-card-sentence';
  quote.textContent = `“${claim?.sentence || ''}”`;

  const explanation = document.createElement('p');
  explanation.className = 'yt-misinfo-card-explanation';
  explanation.textContent = claim?.explanation || 'This statement has been flagged as inaccurate or misleading.';

  body.appendChild(meta);
  body.appendChild(quote);
  body.appendChild(explanation);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'yt-misinfo-card-footer';

  if (claim?.sources && Array.isArray(claim.sources) && claim.sources.length > 0) {
    claim.sources.forEach((sourceUrl) => {
      if (typeof sourceUrl === 'string' && /^https?:\/\//i.test(sourceUrl.trim())) {
        const sourceLink = document.createElement('a');
        sourceLink.className = 'yt-misinfo-card-source';
        sourceLink.href = sourceUrl.trim();
        sourceLink.setAttribute('href', sourceUrl.trim());
        sourceLink.target = '_blank';
        sourceLink.setAttribute('target', '_blank');
        sourceLink.rel = 'noopener noreferrer';
        try {
          sourceLink.textContent = new URL(sourceUrl.trim()).hostname.replace(/^www\./, '');
        } catch {
          sourceLink.textContent = 'source';
        }
        footer.appendChild(sourceLink);
      }
    });
  }

  const timelineBtn = document.createElement('button');
  timelineBtn.type = 'button';
  timelineBtn.className = 'yt-misinfo-card-btn-timeline';
  timelineBtn.textContent = 'View in Timeline →';
  timelineBtn.addEventListener('click', (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof options.onViewTimeline === 'function') {
      options.onViewTimeline(claim);
    }
  });
  footer.appendChild(timelineBtn);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);

  container.appendChild(card);
  return container;
}

/**
 * Removes the warning overlay from a video player element.
 *
 * @param {HTMLElement} playerElement - The container element.
 */
export function removeWarningOverlay(playerElement) {
  if (!playerElement || typeof playerElement.querySelector !== 'function') return;
  const overlay =
    playerElement.querySelector('#yt-misinfo-overlay-root') ||
    playerElement.querySelector('.yt-misinfo-overlay') ||
    playerElement.querySelector('.yt-misinfo-overlay-container');

  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

/**
 * Manages the in-video misinformation warning alert card inside YouTube's #movie_player.
 */
export class OverlayManager {
  /**
   * @param {Object} [options]
   * @param {HTMLElement} [options.playerElement]
   * @param {(claim: Object) => void} [options.onViewTimeline]
   */
  constructor(options = {}) {
    this.playerElement = options.playerElement || null;
    this.container = null;
    this.activeClaim = null;
    this.dismissedClaimKey = null;
    this.onViewTimelineCallback = options.onViewTimeline || null;
    this.hideTimeout = null;
  }

  /**
   * Mounts the overlay container into #movie_player.
   * @param {HTMLElement} [playerElement]
   * @returns {HTMLElement} The root container.
   */
  mount(playerElement) {
    if (playerElement) {
      this.playerElement = playerElement;
    }
    if (!this.playerElement && typeof document !== 'undefined') {
      this.playerElement =
        (typeof document.getElementById === 'function' && document.getElementById('movie_player')) ||
        (typeof document.querySelector === 'function' &&
          (document.querySelector('ytd-shorts-player[is-active] #player-container') ||
           document.querySelector('ytd-reel-video-renderer[is-active] #player-container') ||
           document.querySelector('ytd-shorts-player') ||
           document.querySelector('.html5-video-player')));
    }
    if (!this.playerElement) {
      return null;
    }

    let existing = this.playerElement.querySelector('#yt-misinfo-overlay-root');
    if (existing) {
      this.container = existing;
      return this.container;
    }

    this.container = document.createElement('div');
    this.container.id = 'yt-misinfo-overlay-root';
    this.container.className = 'yt-misinfo-overlay-container yt-misinfo-overlay';
    this.container.style.pointerEvents = 'none';

    this.playerElement.appendChild(this.container);
    return this.container;
  }

  /**
   * Synchronizes the overlay state with current active claim and settings.
   * @param {Object|null} activeClaim
   * @param {{ enabled: boolean, showOverlays: boolean }} [settings]
   */
  update(activeClaim, settings = { enabled: true, showOverlays: true }) {
    if (!settings.enabled || !settings.showOverlays) {
      this.hide();
      return;
    }

    if (!activeClaim || activeClaim.verdict !== 'misinformation') {
      this.hide();
      return;
    }

    const claimKey = `${activeClaim.timestamp}_${activeClaim.sentence}`;
    if (this.dismissedClaimKey === claimKey) {
      return;
    }

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
      const card = this.container?.querySelector('.yt-misinfo-card');
      if (card) {
        card.classList.remove('yt-misinfo-card--hiding');
      }
    }

    if (this.activeClaim && `${this.activeClaim.timestamp}_${this.activeClaim.sentence}` === claimKey) {
      // Already displaying this active claim
      return;
    }

    this.show(activeClaim);
  }

  /**
   * Renders and displays the warning card for a misinformation claim.
   * @param {Object} claim
   */
  show(claim) {
    if (!this.container) {
      this.mount();
    }
    if (!this.container) return;

    this.activeClaim = claim;
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    const overlayTree = createWarningOverlay(claim, {
      onDismiss: () => {
        this.dismiss();
      },
      onViewTimeline: (c) => {
        if (typeof this.onViewTimelineCallback === 'function') {
          this.onViewTimelineCallback(c);
        }
      }
    });

    // Replace children in this.container with the card from overlayTree
    const card = overlayTree.querySelector('.yt-misinfo-card');
    if (card) {
      if (typeof this.container.replaceChildren === 'function') {
        this.container.replaceChildren(card);
      } else {
        while (this.container.firstChild) {
          this.container.removeChild(this.container.firstChild);
        }
        this.container.appendChild(card);
      }
    }
  }

  /**
   * Hides the active warning overlay.
   * @param {boolean} [immediate=false]
   */
  hide(immediate = false) {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    if (!this.container || !this.activeClaim) {
      this.activeClaim = null;
      return;
    }
    const card = this.container.querySelector('.yt-misinfo-card');
    if (immediate || !card) {
      if (typeof this.container.replaceChildren === 'function') {
        this.container.replaceChildren();
      } else {
        while (this.container.firstChild) {
          this.container.removeChild(this.container.firstChild);
        }
      }
      this.activeClaim = null;
      return;
    }

    if (card && card.classList) {
      card.classList.add('yt-misinfo-card--hiding');
      this.hideTimeout = setTimeout(() => {
        if (this.container) {
          if (typeof this.container.replaceChildren === 'function') {
            this.container.replaceChildren();
          } else {
            while (this.container.firstChild) {
              this.container.removeChild(this.container.firstChild);
            }
          }
        }
        this.activeClaim = null;
        this.hideTimeout = null;
      }, 180);
    }
  }

  /**
   * Dismisses the current claim instance on manual user action.
   */
  dismiss() {
    if (this.activeClaim) {
      this.dismissedClaimKey = `${this.activeClaim.timestamp}_${this.activeClaim.sentence}`;
    }
    this.hide(true);
  }

  /**
   * Resets the dismissed claim key (e.g., when the user seeks or navigates).
   */
  resetDismissed() {
    this.dismissedClaimKey = null;
  }

  /**
   * Registers a callback for the "View in Timeline" button.
   * @param {(claim: Object) => void} callback
   */
  onViewTimeline(callback) {
    this.onViewTimelineCallback = callback;
  }

  /**
   * Completely removes the overlay from the DOM.
   */
  destroy() {
    this.hide();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.activeClaim = null;
    this.dismissedClaimKey = null;
  }
}
