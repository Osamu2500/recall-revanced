'use strict';

/**
 * @fileoverview Wider Recall - Memory & Scroll State
 * Manages saving and restoring user scroll positions and active tabs
 * using sessionStorage, preventing loss of context during SPA navigations.
 */

Object.assign(window.WR_API, {
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
