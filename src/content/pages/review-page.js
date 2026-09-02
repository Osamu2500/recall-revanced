'use strict';

/**
 * @fileoverview Wider Recall - Review Page Module
 */

window.WR_PAGES.review = {
  _active: false,
  _observer: null,

  init() {
    this._active = true;
    console.log('[WR] Review Page initialized');
    this._applyStyles();
    this._setupObservers();
  },
  
  cleanup() {
    this._active = false;
    console.log('[WR] Review Page cleaned up');
    this._removeStyles();
    this._teardownObservers();
  },

  _applyStyles() {
    document.body.classList.add('wr-page-review');
    const cards = document.querySelectorAll(window.WR_SELECTORS.spaced.reviewCard);
    cards.forEach(card => {
      card.classList.add('wr-spaced-stat-card'); // reuse styling class
    });
  },

  _removeStyles() {
    document.body.classList.remove('wr-page-review');
    document.querySelectorAll('.wr-spaced-stat-card').forEach(card => {
      card.classList.remove('wr-spaced-stat-card');
    });
  },

  _setupObservers() {
    // Scaffold for dynamic element observing (e.g., flashcards, quizzes)
    this._observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
          // Look for flashcard elements
          const cards = document.querySelectorAll('.flashcard-container:not([data-wr-styled])');
          cards.forEach(card => {
            card.setAttribute('data-wr-styled', 'true');
            // Attach click listener for 3D flip if not handled by React
            card.addEventListener('click', () => card.classList.toggle('is-flipped'));
          });
        }
      });
    });

    this._observer.observe(document.body, { childList: true, subtree: true });
  },

  _teardownObservers() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }
};
