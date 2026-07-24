'use strict';

/**
 * @fileoverview Wider Recall — Spaced Repetition Page Handler (v1.2)
 *
 * KEY INSIGHT (from live page analysis):
 * The /spaced-repetition page has TWO tabs:
 *   - "Review"    → Dashboard showing stats, streak, activity (no card grid)
 *   - "Questions" → A NATIVE card grid already rendered by Recall
 *
 * This module NO LONGER replaces the native grid DOM.
 * Instead it ENHANCES the existing native cards on the Questions tab with:
 *   - Glassmorphism styles
 *   - Entrance animations
 *   - Spotlight hover effect
 *   - Styled checkboxes
 *
 * This approach is far more stable because we're decorating existing elements,
 * not fighting React's reconciler with a parallel DOM tree.
 */

window.WR_PAGES.spaced = {
  _observer: null,
  _tabObserver: null,
  _active: false,
  _currentTab: null, // 'review' | 'questions'
  _enhancedCards: new WeakSet(), // Track which cards already have our enhancements

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  init() {
    this._active = true;
    this._injectStyles();
    this._detectTabAndApply();
    this._watchTabSwitches();

    // Periodic check to catch delayed React renders
    this._fallbackTimer = setInterval(() => {
      if (this._active) this._detectTabAndApply();
    }, 1200);

    console.log('[WR Spaced] Initialized');
  },

  cleanup() {
    this._active = false;
    clearInterval(this._fallbackTimer);
    if (this._observer)    { this._observer.disconnect();    this._observer    = null; }
    if (this._tabObserver) { this._tabObserver.disconnect(); this._tabObserver = null; }
    this._restoreAll();
    console.log('[WR Spaced] Cleaned up');
  },

  // ─── Tab Detection ──────────────────────────────────────────────────────────

  /**
   * Reads which tab is currently active by checking [role="tab"][aria-selected="true"]
   * Returns 'questions', 'review', or null.
   */
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
      // Same tab — just apply enhancements to any new cards that appeared
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

  // ─── Tab Switch Watcher ─────────────────────────────────────────────────────

  _watchTabSwitches() {
    if (this._tabObserver) this._tabObserver.disconnect();

    // Watch for aria-selected attribute changes on tab elements
    const tabList = document.querySelector('[role="tablist"]');
    if (!tabList) {
      // Retry after a short delay — React may not have rendered the tabs yet
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

  // ─── Review Tab ────────────────────────────────────────────────────────────

  _onReviewTabActivated() {
    // Clean up Questions tab enhancements
    this._restoreAll();
    // The Review tab is the dashboard — no custom grid, just apply subtle polish
    this._enhanceReviewDashboard();
    console.log('[WR Spaced] Review tab active');
  },

  _enhanceReviewDashboard() {
    // Enhance the stat cards on the review dashboard
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

  // ─── Questions Tab ──────────────────────────────────────────────────────────

  _onQuestionsTabActivated() {
    const isGridEnabled = this._isGridEnabled();
    if (!isGridEnabled) {
      this._restoreAll();
      return;
    }

    this._enhanceQuestionsTab();
    this._watchForNewCards();
    console.log('[WR Spaced] Questions tab active — enhancing native grid');
  },

  _isGridEnabled() {
    return (
      document.body.getAttribute('data-wr-grid') === 'true' &&
      document.body.getAttribute('data-wr-enabled') === 'true'
    );
  },

  /**
   * Finds native card elements and applies our visual enhancements.
   * We look for elements containing an image AND a question count text.
   * We DO NOT manipulate their position, layout, or parent containers.
   */
  _enhanceQuestionsTab() {
    if (!this._isGridEnabled()) {
      this._restoreAll();
      return;
    }

    const cards = this._findNativeCards();
    if (cards.length === 0) return;

    let delay = 0;
    cards.forEach((card) => {
      if (this._enhancedCards.has(card)) return; // Already done
      this._enhancedCards.add(card);

      // Add glassmorphism + animation classes
      card.classList.add('wr-spaced-card-enhanced');
      card.style.animationDelay = `${delay}ms`;
      delay = Math.min(delay + 40, 400);

      // Spotlight mouse-tracking effect
      this._addSpotlight(card);

      // Style the native checkbox
      this._styleNativeCheckbox(card);
    });
  },

  /**
   * Finds the native card elements on the Questions tab.
   * Strategy: Find all elements with an image AND sibling text containing "question".
   * We avoid looking for generated class names.
   */
  _findNativeCards() {
    const candidates = [];

    // Strategy 1: Any element that contains an img and a text node with "question"
    const allImgContainers = document.querySelectorAll('img');
    const seen = new Set();

    allImgContainers.forEach(img => {
      // Walk up to find the card container (usually 3-5 levels up)
      let el = img.parentElement;
      let depth = 0;
      while (el && depth < 6 && el !== document.body) {
        if (
          el.textContent.toLowerCase().includes('question') &&
          el.querySelector('img') &&
          !seen.has(el) &&
          // Exclude very large containers (the whole page)
          el.children.length < 20
        ) {
          // This is likely a card
          seen.add(el);
          candidates.push(el);
          break;
        }
        el = el.parentElement;
        depth++;
      }
    });

    // Deduplicate — if a candidate is an ancestor of another, keep the smaller one
    return candidates.filter(card => {
      return !candidates.some(other => other !== card && card.contains(other));
    });
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

  /**
   * Styles the native checkbox inside a card row.
   * We add a visual overlay instead of replacing the checkbox (which would
   * break React's onChange handler).
   */
  _styleNativeCheckbox(card) {
    const nativeCb = card.querySelector('input[type="checkbox"]');
    if (!nativeCb || nativeCb.getAttribute('data-wr-styled')) return;

    nativeCb.setAttribute('data-wr-styled', 'true');

    // Create a visual overlay that sits on top of the native checkbox
    const visualCb = document.createElement('div');
    visualCb.className = 'wr-cb-visual';
    visualCb.setAttribute('aria-hidden', 'true');

    // Sync state
    const syncVisual = () => {
      visualCb.classList.toggle('wr-cb-checked', nativeCb.checked);
    };
    syncVisual();

    // When visual is clicked, trigger the native checkbox (React-compatible)
    visualCb.addEventListener('click', (e) => {
      e.stopPropagation();
      nativeCb.click(); // .click() fires React's synthetic event properly
    });

    // Watch for React state changes
    nativeCb.addEventListener('change', syncVisual);

    // Hide native, insert visual overlay next to it
    nativeCb.style.cssText = 'position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0;';
    nativeCb.parentElement.style.position = 'relative';
    nativeCb.after(visualCb);
  },

  // ─── New Card Observer ───────────────────────────────────────────────────────

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

  // ─── Cleanup / Restore ───────────────────────────────────────────────────────

  _restoreAll() {
    // Remove all our enhancement classes from native elements
    document.querySelectorAll('.wr-spaced-card-enhanced').forEach(card => {
      card.classList.remove('wr-spaced-card-enhanced');
      card.style.animationDelay = '';
    });
    document.querySelectorAll('.wr-spaced-stat-card').forEach(card => {
      card.classList.remove('wr-spaced-stat-card');
    });

    // Restore native checkboxes
    document.querySelectorAll('[data-wr-styled="true"]').forEach(cb => {
      cb.removeAttribute('data-wr-styled');
      cb.style.cssText = '';
      const visual = cb.nextElementSibling;
      if (visual && visual.classList.contains('wr-cb-visual')) {
        visual.remove();
      }
    });

    this._enhancedCards = new WeakSet();
  },

  // ─── CSS Injection ───────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('wr-spaced-styles')) return;

    const style = document.createElement('style');
    style.id = 'wr-spaced-styles';
    style.textContent = `
      /* ── Enhanced native card on the Questions tab ──────────────────────── */
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-spaced-card-enhanced {
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
      }

      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-spaced-card-enhanced:hover {
        transform: translateY(-5px) scale(1.01) !important;
        border-color: rgba(139, 92, 246, 0.45) !important;
        box-shadow: 0 16px 32px rgba(0,0,0,0.4), 0 0 20px rgba(139,92,246,0.15) !important;
      }

      /* Spotlight radial gradient (mouse-tracked via JS --mx/--my) */
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-spaced-card-enhanced::before {
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
      body[data-wr-enabled="true"][data-wr-grid="true"] .wr-spaced-card-enhanced:hover::before {
        opacity: 1;
      }

      @keyframes wr-card-enter {
        from { opacity: 0; transform: translateY(18px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* ── Custom Checkbox Overlay ──────────────────────────────────────────── */
      .wr-cb-visual {
        position: absolute;
        top: 10px;
        left: 10px;
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
