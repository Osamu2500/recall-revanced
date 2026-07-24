'use strict';

/**
 * @fileoverview Wider Recall - Review Page Module
 */

window.WR_PAGES.review = {
  _active: false,

  init() {
    this._active = true;
    console.log('[WR] Review Page initialized');
    this._applyStyles();
  },
  
  cleanup() {
    this._active = false;
    console.log('[WR] Review Page cleaned up');
    this._removeStyles();
  },

  _applyStyles() {
    // We use CSS in wider.css and theme-premium for the review page,
    // this module can orchestrate specific animations if needed.
    const cards = document.querySelectorAll(window.WR_SELECTORS.spaced.reviewCard);
    cards.forEach(card => {
      card.classList.add('wr-spaced-stat-card'); // reuse styling class
    });
  },

  _removeStyles() {
    document.querySelectorAll('.wr-spaced-stat-card').forEach(card => {
      card.classList.remove('wr-spaced-stat-card');
    });
  }
};
