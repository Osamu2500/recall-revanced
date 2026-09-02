'use strict';

/**
 * @fileoverview Wider Recall - Home Page Module
 */

window.WR_PAGES.home = {
  _observer: null,
  _active: false,

  init() {
    this._active = true;
    console.log('[WR] Home Page initialized');
    this._applyStyles();
    this._watchForCards();
    if (typeof window.WR_EnhanceCards === 'function') {
      window.WR_EnhanceCards();
    }
    if (window.WR_HOME_CARDS) {
      window.WR_HOME_CARDS.init();
    }
  },
  
  cleanup() {
    this._active = false;
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    if (window.WR_HOME_CARDS) {
      window.WR_HOME_CARDS.cleanup();
    }
    this._removeStyles();
    console.log('[WR] Home Page cleaned up');
  },

  _applyStyles() {
    document.body.classList.add('wr-page-home');
  },

  _removeStyles() {
    document.body.classList.remove('wr-page-home');
  },

  _watchForCards() {
    if (this._observer) this._observer.disconnect();

    const target = document.querySelector('main') || document.body;
    let debounce;

    this._observer = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (this._active && typeof window.WR_EnhanceCards === 'function') {
          window.WR_EnhanceCards();
        }
      }, 150);
    });

    this._observer.observe(target, { childList: true, subtree: true });
  }
};
