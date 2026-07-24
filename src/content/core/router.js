'use strict';

/**
 * @fileoverview Wider Recall - Page Router (v1.2)
 * Routes SPA navigation events to page handler modules.
 * Supports sub-page context so modules can respond to tab changes
 * within the same top-level page (e.g. Spaced Rep: Review vs Questions).
 */

window.WR_Router = {
  currentPageId: null,
  _subPageObserver: null,

  init() {
    this.route(window.location.pathname);

    window.addEventListener('wr-locationchange', () => {
      this.route(window.location.pathname);
    });
  },

  route(path) {
    const sel = window.WR_SELECTORS && window.WR_SELECTORS.pages;
    if (!sel) return;

    let newPageId = 'unknown';
    if (sel.isItemDetail(path))       newPageId = 'item';
    else if (sel.isSpacedRepetition(path)) newPageId = 'spaced';
    else if (sel.isHomeGrid(path))    newPageId = 'home';
    else if (sel.isSettings(path))    newPageId = 'settings';
    else if (sel.isGraph(path))       newPageId = 'graph';
    else if (sel.isSearch(path))      newPageId = 'search';
    else if (sel.isChat(path))        newPageId = 'chat';
    else if (sel.isReview(path))      newPageId = 'review';

    const pageChanged = this.currentPageId !== newPageId;

    // Cleanup old page module
    if (pageChanged && this.currentPageId) {
      const oldPage = window.WR_PAGES && window.WR_PAGES[this.currentPageId];
      if (oldPage && typeof oldPage.cleanup === 'function') {
        try { oldPage.cleanup(); } catch (e) {
          console.warn('[WR Router] cleanup error for', this.currentPageId, e);
        }
      }
      this._teardownSubPageObserver();
    }

    this.currentPageId = newPageId;

    // Init new page module — delay slightly for React to render
    const pageModule = window.WR_PAGES && window.WR_PAGES[newPageId];
    if (pageModule && typeof pageModule.init === 'function') {
      setTimeout(() => {
        if (!window.WR_STATE || !window.WR_STATE.enabled) return;
        try {
          pageModule.init();
        } catch (e) {
          console.warn('[WR Router] init error for', newPageId, e);
        }
      }, 250);
    }
  },

  _teardownSubPageObserver() {
    if (this._subPageObserver) {
      this._subPageObserver.disconnect();
      this._subPageObserver = null;
    }
  },
};

// Global page registry — modules register themselves here
window.WR_PAGES = window.WR_PAGES || {};
