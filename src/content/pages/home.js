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
    this._watchForCards();
    if (typeof window.WR_EnhanceCards === 'function') {
      window.WR_EnhanceCards();
    }
  },
  
  cleanup() {
    this._active = false;
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    console.log('[WR] Home Page cleaned up');
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
