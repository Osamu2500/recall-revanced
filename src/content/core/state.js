'use strict';

/**
 * @fileoverview Wider Recall - State Manager
 * Handles the core state of the extension, defaults, and applying
 * attributes to the DOM to trigger CSS changes.
 */

window.WR_DEFAULTS = Object.freeze({ 
  width: 1100, wrap: true, hideSidebar: false, hideOutline: true, grid: true, gridCols: 3, typo: true, enabled: true,
  zen: false, media: true, tocHover: false, graph: true, hotkeys: true,
  bionic: false, cmd: true, lightbox: true, theme: 'default', focus: false, toc: false, codeTools: true,
  animations: true, spotlight: true, premiumUi: true, immersiveCards: true, chatMultiSelect: true
});

window.WR_STATE = { ...window.WR_DEFAULTS };

/**
 * Wider Recall Core API
 */
window.WR_API = {
  /**
   * Determines the current page type based on the URL.
   * @returns {'item'|'spaced'|'home'|'settings'|'graph'|'search'|'chat'|'review'|'other'}
   */
  getPage() {
    const path = window.location.pathname;
    if (window.WR_SELECTORS && window.WR_SELECTORS.pages) {
      if (window.WR_SELECTORS.pages.isItemDetail(path)) return 'item';
      if (window.WR_SELECTORS.pages.isSpacedRepetition(path)) return 'spaced';
      if (window.WR_SELECTORS.pages.isHomeGrid(path)) return 'home';
      if (window.WR_SELECTORS.pages.isSettings(path)) return 'settings';
      if (window.WR_SELECTORS.pages.isGraph(path)) return 'graph';
      if (window.WR_SELECTORS.pages.isSearch(path)) return 'search';
      if (window.WR_SELECTORS.pages.isChat(path)) return 'chat';
      if (window.WR_SELECTORS.pages.isReview(path)) return 'review';
    }
    return 'other';
  },
  
  /**
   * Safely simulates a native click sequence for React components
   */
  ghostClick(el) {
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
  },

  /**
   * Safely simulates a native hover sequence for React components
   */
  ghostHover(el) {
      if (!el) return false;
      for (const evt of ['pointerenter', 'mouseover', 'mouseenter', 'mousemove']) {
          el.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
      }
      return true;
  },

  getItemId() {
    const match = window.location.pathname.match(/\/item\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  },

  /**
   * Applies the provided settings object to the DOM by setting data-attributes.
   * Triggers downstream feature updates.
   * @param {Object} opts - The settings object to apply.
   */
  applySettings(opts) {
    if (!opts || typeof opts !== 'object') return;

    const oldBionic = window.WR_STATE.bionic;
    const oldZen = window.WR_STATE.zen;
    window.WR_STATE = { ...window.WR_STATE, ...opts };
    
    const body = document.body;
    if (!body) return;

    if (!window.WR_STATE.enabled) {
      body.removeAttribute('data-wr-enabled');
      // If disabled, we might want to clean up UI elements, handled by features observing this
    } else {
      body.setAttribute('data-wr-enabled', 'true');
      const widthVal = window.WR_STATE.width === 3000 ? '100%' : `${window.WR_STATE.width}px`;
      document.documentElement.style.setProperty('--wr-width', widthVal);
      document.documentElement.style.setProperty('--wr-grid-cols', window.WR_STATE.gridCols || 3);
      
      const attrs = [
        ['data-wr-wrap', window.WR_STATE.wrap],
        ['data-wr-hide-sidebar', window.WR_STATE.hideSidebar],
        ['data-wr-hide-outline', window.WR_STATE.hideOutline],
        ['data-wr-grid', window.WR_STATE.grid],
        ['data-wr-typo', window.WR_STATE.typo],
        ['data-wr-zen', window.WR_STATE.zen],
        ['data-wr-toc-hover', window.WR_STATE.tocHover],
        ['data-wr-graph', window.WR_STATE.graph],
        ['data-wr-media', window.WR_STATE.media],
        ['data-wr-immersive-cards', window.WR_STATE.immersiveCards],
        ['data-wr-chat-multi-select', window.WR_STATE.chatMultiSelect !== false],
        ['data-wr-toc', window.WR_STATE.toc],
        ['data-wr-code-tools', window.WR_STATE.codeTools]
      ];

      attrs.forEach(([attr, val]) => {
        body.setAttribute(attr, val ? 'true' : 'false');
      });

      body.setAttribute('data-wr-theme', window.WR_STATE.theme || 'default');
      body.setAttribute('data-wr-page', this.getPage());
      
      // Determine subpage context
      const activeTabEl = document.querySelector('[role="tab"][aria-selected="true"]');
      if (activeTabEl) {
        body.setAttribute('data-wr-subpage', activeTabEl.textContent.trim().toLowerCase());
      } else {
        body.removeAttribute('data-wr-subpage');
      }
    }
    
    // Trigger feature lifecycle hooks if they exist
    if (typeof window.WR_EnforceDomState === 'function') window.WR_EnforceDomState();
    if (typeof window.WR_SetupMediaObserver === 'function') window.WR_SetupMediaObserver();
    if (typeof window.WR_UpdateBionic === 'function' && oldBionic !== window.WR_STATE.bionic) window.WR_UpdateBionic();
  }
};
