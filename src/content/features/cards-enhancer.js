'use strict';

/**
 * @fileoverview Wider Recall - Cards Enhancer
 * Adds staggered entrance animations and mouse-tracking spotlight effects
 * to knowledge cards on the home feed and search results.
 */

window.WR_EnhanceCards = function () {
  if (!window.WR_STATE || !window.WR_STATE.enabled) return;

  const cards = document.querySelectorAll(
    'article:not([data-wr-enhanced]), div[class*="MuiCard-root"]:not([data-wr-enhanced])'
  );

  cards.forEach((card, i) => {
    card.setAttribute('data-wr-enhanced', 'true');
    card.classList.add('re-card-enter');
    card.style.animationDelay = `${Math.min(i * 40, 500)}ms`;

    // Spotlight mouse-tracking effect
    if (window.WR_STATE.spotlight !== false) {
      card.classList.add('re-spotlight');
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        card.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
      });
    }
  });
};
