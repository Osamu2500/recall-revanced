'use strict';

/**
 * @fileoverview Wider Recall - State Manager (v1.2)
 * Handles the core state of the extension, local storage synchronization, 
 * and Single Page Application (SPA) navigation interception.
 */

window.WR_DEFAULTS = Object.freeze({ 
  width: 1100, wrap: true, hideSidebar: false, hideOutline: true, grid: true, gridCols: 3, typo: true, enabled: true,
  zen: false, media: true, tocHover: false, graph: true, hotkeys: true,
  bionic: false, cmd: true, lightbox: true, theme: 'default', focus: false, toc: false,
  animations: true, spotlight: true, premiumUi: true, immersiveCards: true, chatMultiSelect: true
});

window.WR_STATE = { ...window.WR_DEFAULTS };

/**
 * Wider Recall Core API
 * Exposes methods to apply settings to the DOM and manage session scroll state.
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
   * Extracts the unique item ID from the URL if viewing a specific note.
   * @returns {string|null} The item ID or null.
   */
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
        ['data-wr-chat-multi-select', window.WR_STATE.chatMultiSelect !== false]
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
    if (typeof window.WR_ApplyCinematicZen === 'function' && oldZen !== window.WR_STATE.zen) window.WR_ApplyCinematicZen();
  },

  /**
   * Returns the sessionStorage key for a given item ID.
   * @param {string} id - The note item ID.
   * @returns {string} The storage key.
   */
  getMemoryKey(id) { 
    return `wr-memory-${id}`; 
  },
  
  /**
   * Saves the user's current scroll position and active tab to sessionStorage.
   * @param {number} scrollY - The current scroll position.
   */
  saveState(scrollY) {
    const id = this.getItemId();
    if (!id || !window.WR_STATE.enabled) return;
    
    try {
      const activeTabEl = document.querySelector(window.WR_SELECTORS.memory.activeTab);
      const activeTab = activeTabEl ? activeTabEl.textContent.trim() : null;
      sessionStorage.setItem(this.getMemoryKey(id), JSON.stringify({ scroll: scrollY, tab: activeTab }));
    } catch (e) {
      console.warn('Wider Recall: Failed to save scroll state', e);
    }
  },

  /**
   * Restores the user's scroll position and active tab from sessionStorage.
   */
  restoreState() {
    const id = this.getItemId();
    if (!id || !window.WR_STATE.enabled) return;
    
    const stateStr = sessionStorage.getItem(this.getMemoryKey(id));
    if (!stateStr) return;
    
    try {
      const state = JSON.parse(stateStr);
      
      // Restore Tab
      if (state.tab) {
        const tabs = Array.from(document.querySelectorAll(window.WR_SELECTORS.memory.tabs));
        const targetTab = tabs.find(t => t.textContent.trim() === state.tab);
        const activeTabEl = document.querySelector(window.WR_SELECTORS.memory.activeTab);
        if (targetTab && activeTabEl && activeTabEl !== targetTab) {
          targetTab.click();
        }
      }
      
      // Restore Scroll
      if (typeof state.scroll === 'number' && state.scroll > 0) {
        if (window.WR_restoreInterval) clearInterval(window.WR_restoreInterval);
        
        let attempts = 0;
        window.WR_restoreInterval = setInterval(() => {
          attempts++;
          const scrollContainer = document.querySelector(window.WR_SELECTORS.memory.scrollContainer) || document.querySelector(window.WR_SELECTORS.memory.fallbackScroll);
          const target = scrollContainer || window;
          target.scrollTo({ top: state.scroll, behavior: 'instant' });
          
          const currentScroll = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
          if (Math.abs(currentScroll - state.scroll) < 10 || attempts > 20) {
            clearInterval(window.WR_restoreInterval);
          }
        }, 150);
      }
    } catch (e) {
      console.warn('Wider Recall: Failed to parse or restore state', e);
    }
  }
};

/**
 * Intercepts HTML5 History API methods to dispatch a custom event on SPA navigation.
 */
const injectHistoryInterceptor = () => {
  if (document.getElementById('wr-history-interceptor')) return;
  const script = document.createElement('script');
  script.id = 'wr-history-interceptor';
  script.textContent = `
    (function() {
      const pushState = history.pushState;
      const replaceState = history.replaceState;
      
      history.pushState = function() {
        const res = pushState.apply(history, arguments);
        window.dispatchEvent(new Event('wr-locationchange'));
        return res;
      };
      
      history.replaceState = function() {
        const res = replaceState.apply(history, arguments);
        window.dispatchEvent(new Event('wr-locationchange'));
        return res;
      };
      
      window.addEventListener('popstate', () => { 
        window.dispatchEvent(new Event('wr-locationchange')); 
      });
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // execute and remove
};
injectHistoryInterceptor();

// Listen to custom SPA navigation events
window.addEventListener('wr-locationchange', () => {
  if (window.WR_STATE && window.WR_STATE.enabled) {
    window.WR_API.applySettings(window.WR_STATE);
    setTimeout(() => window.WR_API.restoreState(), 150);
  }
});

// Scroll memory listener with debouncing
let scrollTimeout = null;
let lastScrollY = 0;

window.addEventListener('scroll', (e) => {
  if (!window.WR_STATE || !window.WR_STATE.enabled) return;
  
  // Ignore scrolling inside pre/textarea blocks
  if (e.target && (e.target.tagName === 'PRE' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'CODE')) {
    return;
  }
  
  const scrollPos = (e.target === document || e.target === window) 
    ? (window.scrollY || document.documentElement.scrollTop) 
    : (e.target.scrollTop || 0);
    
  lastScrollY = scrollPos;
  
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => { 
    window.WR_API.saveState(scrollPos); 
  }, 100);
}, true); // Use capture phase to catch all internal scrolling

// Save state immediately on tab change
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest) {
    const tabBtn = e.target.closest(window.WR_SELECTORS.memory.tabs);
    if (tabBtn) {
      setTimeout(() => window.WR_API.saveState(lastScrollY), 50);
    }
  }
});
