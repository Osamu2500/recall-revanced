'use strict';

/**
 * @fileoverview Wider Recall - DOM State Enforcer (v1.2)
 *
 * Handles ONLY sidebar show/hide enforcement via CSS classes and inline style fixes.
 * The dangerous "pixel-based icon hiding" has been removed entirely.
 * Sidebar hiding is primarily handled by CSS using [data-wr-hide-sidebar="true"]
 * on body, but inline style overrides for margin/padding require JS.
 */

// Throttle enforcement to avoid layout thrashing
let _enforceRaf = null;

window.WR_EnforceDomState = function () {
  if (_enforceRaf) cancelAnimationFrame(_enforceRaf);
  _enforceRaf = requestAnimationFrame(_doEnforce);
};

function _doEnforce() {
  try {
    if (!window.WR_STATE || !window.WR_STATE.enabled) return;

    const shouldHide = window.WR_STATE.hideSidebar || window.WR_STATE.zen;

    if (shouldHide) {
      _hideSidebar();
    } else {
      _showSidebar();
    }
  } catch (e) {
    console.warn('[WR] EnforceDomState error:', e);
  }
}

function _hideSidebar() {
  // CSS on body[data-wr-hide-sidebar="true"] handles visibility.
  // JS handles the leftover margin/padding on the scroll container.
  const scrollers = document.querySelectorAll(
    window.WR_SELECTORS.elements.mainWrappers
  );
  scrollers.forEach(el => {
    const style = getComputedStyle(el);
    // Recall sets margin-left: 52px on main to account for the sidebar width
    if (style.marginLeft === '52px') el.style.setProperty('margin-left', '0px', 'important');
    if (style.left === '52px')        el.style.setProperty('left', '0px', 'important');
    if (style.paddingLeft === '52px') el.style.setProperty('padding-left', '0px', 'important');
  });
}

function _showSidebar() {
  const scrollers = document.querySelectorAll(
    window.WR_SELECTORS.elements.mainWrappers
  );
  scrollers.forEach(el => {
    // Only reset what WE set — don't touch Recall's own inline styles
    if (el.style.marginLeft === '0px')  el.style.marginLeft = '';
    if (el.style.left === '0px')        el.style.left = '';
    if (el.style.paddingLeft === '0px') el.style.paddingLeft = '';
  });
}

// Polling fallback (1s) — primarily for cases where React re-renders wipe out our state
setInterval(() => {
  if (window.WR_STATE && window.WR_STATE.enabled && window.WR_EnforceDomState) {
    window.WR_EnforceDomState();
  }
}, 1500);

// MutationObserver — re-apply settings when React unmounts/remounts large DOM sections
let _mutationDebounce = null;

const _pageObserver = new MutationObserver(() => {
  if (_mutationDebounce) clearTimeout(_mutationDebounce);
  _mutationDebounce = setTimeout(() => {
    try {
      // If body lost its WR attributes (e.g. after React hydration), re-apply
      if (
        document.body &&
        !document.body.hasAttribute('data-wr-page') &&
        window.WR_STATE &&
        window.WR_STATE.enabled &&
        window.WR_API
      ) {
        window.WR_API.applySettings(window.WR_STATE);
        setTimeout(() => window.WR_API.restoreState(), 150);
      }

      // Run feature hooks that depend on new DOM elements
      if (typeof window.WR_InitFocusMode  === 'function') window.WR_InitFocusMode();
      if (typeof window.WR_InitMinimap    === 'function') window.WR_InitMinimap();
      if (typeof window.WR_InitCodeTools  === 'function') window.WR_InitCodeTools();
      if (typeof window.WR_EnhanceCards   === 'function') window.WR_EnhanceCards();
    } catch (e) {
      console.warn('[WR] MutationObserver callback error:', e);
    }
  }, 200);
});

// Card entrance animation + spotlight hover effect
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

// Start observing
if (document.body) {
  _pageObserver.observe(document.body, { childList: true, subtree: true, attributes: false });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    _pageObserver.observe(document.body, { childList: true, subtree: true, attributes: false });
  });
}
