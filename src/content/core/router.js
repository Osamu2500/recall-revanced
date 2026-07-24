'use strict';

/**
 * @fileoverview Wider Recall - Page Router
 * Routes SPA navigation events to specific page handler modules.
 */

window.WR_Router = {
  currentPageId: null,
  
  init() {
    this.route(window.location.pathname);
    window.addEventListener('wr-locationchange', () => {
      this.route(window.location.pathname);
    });
  },
  
  route(path) {
    let newPageId = 'unknown';
    
    if (window.WR_SELECTORS.pages.isItemDetail(path)) newPageId = 'item';
    else if (window.WR_SELECTORS.pages.isSpacedRepetition(path)) newPageId = 'spaced';
    else if (window.WR_SELECTORS.pages.isHomeGrid(path)) newPageId = 'home';
    else if (window.WR_SELECTORS.pages.isSettings(path)) newPageId = 'settings';
    else if (window.WR_SELECTORS.pages.isGraph(path)) newPageId = 'graph';
    else if (window.WR_SELECTORS.pages.isSearch(path)) newPageId = 'search';
    else if (window.WR_SELECTORS.pages.isChat(path)) newPageId = 'chat';
    else if (window.WR_SELECTORS.pages.isReview(path)) newPageId = 'review';
    
    if (this.currentPageId === newPageId) return; // No change
    
    // Cleanup old page
    if (this.currentPageId && window.WR_PAGES[this.currentPageId] && window.WR_PAGES[this.currentPageId].cleanup) {
      window.WR_PAGES[this.currentPageId].cleanup();
    }
    
    this.currentPageId = newPageId;
    
    // Init new page
    if (window.WR_PAGES[newPageId] && window.WR_PAGES[newPageId].init) {
      // Delay slightly to let React render the page
      setTimeout(() => {
        if (window.WR_STATE && window.WR_STATE.enabled) {
          window.WR_PAGES[newPageId].init();
        }
      }, 200);
    }
  }
};

window.WR_PAGES = {}; // Register pages here
