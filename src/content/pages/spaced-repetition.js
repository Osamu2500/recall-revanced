'use strict';

/**
 * @fileoverview Wider Recall — Spaced Repetition Page Handler (v1.3)
 */

window.WR_PAGES.spaced = {
  _observer: null,
  _tabObserver: null,
  _active: false,
  _currentTab: null,
  _enhancedCards: new WeakSet(),

  init() {
    this._active = true;
    this._injectStyles();
    this._detectTabAndApply();
    this._watchTabSwitches();

    this._fallbackTimer = setInterval(() => {
      if (this._active) this._detectTabAndApply();
    }, 1000);
  },

  cleanup() {
    this._active = false;
    clearInterval(this._fallbackTimer);
    if (this._observer)    { this._observer.disconnect();    this._observer    = null; }
    if (this._tabObserver) { this._tabObserver.disconnect(); this._tabObserver = null; }
    this._restoreAll();
  },

  _getActiveTab() {
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (!activeTab) return null;
    const text = activeTab.textContent.trim().toLowerCase();
    if (text.includes('question')) return 'questions';
    if (text.includes('review'))   return 'review';
    return null;
  },

  _detectTabAndApply() {
    if (!this._active) return;
    if (!window.WR_STATE || !window.WR_STATE.enabled) return;

    const tab = this._getActiveTab();
    if (tab === this._currentTab) {
      if (tab === 'questions') this._enhanceQuestionsTab();
      return;
    }

    this._currentTab = tab;

    if (tab === 'questions') {
      this._onQuestionsTabActivated();
    } else if (tab === 'review') {
      this._onReviewTabActivated();
    }
  },

  _watchTabSwitches() {
    if (this._tabObserver) this._tabObserver.disconnect();

    const tabList = document.querySelector('[role="tablist"]');
    if (!tabList) {
      setTimeout(() => { if (this._active) this._watchTabSwitches(); }, 500);
      return;
    }

    this._tabObserver = new MutationObserver(() => {
      if (this._active) this._detectTabAndApply();
    });

    this._tabObserver.observe(tabList, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    });
  },

  _onReviewTabActivated() {
    this._restoreAll();
    this._enhanceReviewDashboard();
  },

  _enhanceReviewDashboard() {
    const statCards = document.querySelectorAll(
      '[data-wr-page="spaced"] [class*="Card"], [data-wr-page="spaced"] article'
    );
    statCards.forEach(card => {
      if (!this._enhancedCards.has(card)) {
        this._enhancedCards.add(card);
        card.classList.add('wr-spaced-stat-card');
      }
    });
  },

  _onQuestionsTabActivated() {
    if (!this._isGridEnabled()) {
      this._restoreAll();
      return;
    }

    this._enhanceQuestionsTab();
    this._watchForNewCards();
  },

  _isGridEnabled() {
    return (
      document.body.getAttribute('data-wr-grid') === 'true' &&
      document.body.getAttribute('data-wr-enabled') === 'true'
    );
  },

  _enhanceQuestionsTab() {
    if (!this._isGridEnabled()) {
      this._restoreAll();
      return;
    }

    // Find checkboxes in the main area to locate the list items
    const checkboxes = Array.from(document.querySelectorAll('main input[type="checkbox"]'));
    if (checkboxes.length === 0) return;

    let container = null;

    let delay = 0;
    checkboxes.forEach((cb) => {
      // The row/card is typically 3-4 levels up
      let row = cb.parentElement;
      for (let i = 0; i < 4; i++) {
        if (row && row.parentElement && row.parentElement.tagName !== 'MAIN' && row.parentElement.tagName !== 'BODY') {
          row = row.parentElement;
        }
      }

      if (row && row.tagName !== 'MAIN') {
        if (!container) container = row.parentElement;

        if (!this._enhancedCards.has(row)) {
          this._enhancedCards.add(row);
          row.classList.add('wr-spaced-card-enhanced', 'wr-question-row');
          row.style.animationDelay = `${delay}ms`;
          delay = Math.min(delay + 40, 400);

          this._addSpotlight(row);
          this._styleNativeCheckbox(row, cb);
        }
      }
    });

    // Tag the container and its headers
    if (container) {
      container.classList.add('wr-questions-container');
      
      // Hide the header row (usually the first child if it doesn't contain a checkbox)
      const firstChild = container.firstElementChild;
      if (firstChild && !firstChild.querySelector('input[type="checkbox"]')) {
        firstChild.classList.add('wr-questions-header');
      }
    }
  },

  _addSpotlight(card) {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
      card.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '50%');
    });
  },

  _styleNativeCheckbox(card, nativeCb) {
    if (nativeCb.getAttribute('data-wr-styled')) return;
    nativeCb.setAttribute('data-wr-styled', 'true');

    const visualCb = document.createElement('div');
    visualCb.className = 'wr-cb-visual';
    visualCb.setAttribute('aria-hidden', 'true');

    const syncVisual = () => {
      visualCb.classList.toggle('wr-cb-checked', nativeCb.checked);
    };
    syncVisual();

    visualCb.addEventListener('click', (e) => {
      e.stopPropagation();
      nativeCb.click();
    });

    nativeCb.addEventListener('change', syncVisual);

    nativeCb.style.cssText = 'position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0;';
    
    // Some checkboxes might be in flex containers that collapse if absolute, 
    // so we ensure the parent maintains layout
    if (nativeCb.parentElement) {
      nativeCb.parentElement.style.position = 'relative';
      nativeCb.parentElement.style.display = 'flex';
      nativeCb.parentElement.style.alignItems = 'center';
      nativeCb.parentElement.style.justifyContent = 'center';
      nativeCb.parentElement.style.minWidth = '24px';
      nativeCb.parentElement.style.minHeight = '24px';
    }
    
    nativeCb.after(visualCb);
  },

  _watchForNewCards() {
    if (this._observer) this._observer.disconnect();

    const target = document.querySelector('main') || document.body;
    let debounce;

    this._observer = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (this._active && this._getActiveTab() === 'questions') {
          this._enhanceQuestionsTab();
        }
      }, 200);
    });

    this._observer.observe(target, { childList: true, subtree: true });
  },

  _restoreAll() {
    document.querySelectorAll('.wr-spaced-card-enhanced').forEach(card => {
      card.classList.remove('wr-spaced-card-enhanced', 'wr-question-row');
      card.style.animationDelay = '';
    });
    
    document.querySelectorAll('.wr-questions-container').forEach(c => c.classList.remove('wr-questions-container'));
    document.querySelectorAll('.wr-questions-header').forEach(c => c.classList.remove('wr-questions-header'));

    document.querySelectorAll('.wr-spaced-stat-card').forEach(card => {
      card.classList.remove('wr-spaced-stat-card');
    });

    document.querySelectorAll('[data-wr-styled="true"]').forEach(cb => {
      cb.removeAttribute('data-wr-styled');
      cb.style.cssText = '';
      if (cb.parentElement) {
        cb.parentElement.style.position = '';
        cb.parentElement.style.display = '';
        cb.parentElement.style.alignItems = '';
        cb.parentElement.style.justifyContent = '';
        cb.parentElement.style.minWidth = '';
        cb.parentElement.style.minHeight = '';
      }
      const visual = cb.nextElementSibling;
      if (visual && visual.classList.contains('wr-cb-visual')) {
        visual.remove();
      }
    });

    this._enhancedCards = new WeakSet();
  },

  _injectStyles() {
    if (document.getElementById('wr-spaced-styles')) return;

    const style = document.createElement('style');
    style.id = 'wr-spaced-styles';
    style.textContent = `
      /* ── CSS Grid Transformation ────────────────────────────────────────── */
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-questions-container {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
        gap: 16px !important;
        width: 100% !important;
        max-width: 100% !important;
        align-items: start !important;
        padding-bottom: 40px !important;
      }

      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-questions-header {
        display: none !important;
      }

      /* ── Enhanced Card Styling ────────────────────────────────────────── */
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-question-row {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        position: relative !important;
        border-radius: 14px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        background: rgba(18, 18, 28, 0.6) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1),
                    box-shadow 0.25s cubic-bezier(0.25, 0.8, 0.25, 1),
                    border-color 0.25s ease !important;
        overflow: hidden !important;
        animation: wr-card-enter 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) both !important;
        padding: 16px !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-question-row:hover {
        transform: translateY(-5px) scale(1.01) !important;
        border-color: rgba(139, 92, 246, 0.45) !important;
        box-shadow: 0 16px 32px rgba(0,0,0,0.4), 0 0 20px rgba(139,92,246,0.15) !important;
      }

      /* Fix images inside the row */
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-question-row img {
        width: 100% !important;
        height: 140px !important;
        object-fit: cover !important;
        border-radius: 8px !important;
        margin-bottom: 12px !important;
        display: block !important;
      }
      
      /* Fix text wrapping inside the row */
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-question-row * {
        white-space: normal !important;
        overflow: visible !important;
      }

      /* Spotlight radial gradient */
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-question-row::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: radial-gradient(
          500px circle at var(--mx, 50%) var(--my, 50%),
          rgba(255, 255, 255, 0.07),
          transparent 40%
        );
        pointer-events: none;
        z-index: 2;
        opacity: 0;
        transition: opacity 0.3s;
      }
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-question-row:hover::before {
        opacity: 1;
      }

      @keyframes wr-card-enter {
        from { opacity: 0; transform: translateY(18px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* ── Custom Checkbox Overlay ──────────────────────────────────────────── */
      .wr-cb-visual {
        position: absolute;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        cursor: pointer;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      
      /* Reposition checkbox wrapper inside the grid card */
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-question-row > div:has(.wr-cb-visual) {
        position: absolute !important;
        top: 12px !important;
        left: 12px !important;
        z-index: 15 !important;
      }

      .wr-cb-visual:hover {
        border-color: rgba(139, 92, 246, 0.8);
        background: rgba(0, 0, 0, 0.65);
        transform: scale(1.1);
      }
      .wr-cb-visual.wr-cb-checked {
        background: #8b5cf6;
        border-color: #8b5cf6;
        box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
      }
      .wr-cb-visual.wr-cb-checked::after {
        content: '';
        width: 5px;
        height: 10px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        margin-top: -2px;
      }

      /* ── Review Tab Dashboard Card Enhancements ───────────────────────────── */
      body[data-wr-enabled="true"] .wr-spaced-stat-card {
        border-radius: 14px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        background: rgba(18, 18, 28, 0.6) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        transition: box-shadow 0.25s ease, border-color 0.25s ease !important;
      }
      body[data-wr-enabled="true"] .wr-spaced-stat-card:hover {
        border-color: rgba(139, 92, 246, 0.3) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
      }
    `;
    document.head.appendChild(style);
  },
};
