'use strict';

/**
 * @fileoverview Wider Recall - Core Entry Point
 * Initializes the extension state by fetching from Chrome storage, 
 * applying initial settings, and listening for dashboard message broadcasts.
 */

(function initializeWiderRecall() {
  /**
   * Core initialization function. Applies settings and triggers initial DOM sweeps.
   */
  const boot = () => {
    try {
      if (typeof window.WR_API !== 'object') {
        console.warn('Wider Recall: WR_API is not loaded. Ensure scripts are injected correctly.');
        return;
      }
      
      window.WR_API.applySettings(window.WR_STATE);
      
      if (window.WR_STATE && window.WR_STATE.enabled && document.body) {
        // Delay restore state to allow React DOM to settle
        if (typeof window.WR_API.restoreState === 'function') {
           setTimeout(() => window.WR_API.restoreState(), 150);
        }
        
        // Initialize the Router to start page scripts (like spaced repetition grid)
        if (window.WR_Router && typeof window.WR_Router.init === 'function') {
           window.WR_Router.init();
        }
        
        // Trigger Bionic Reading if active
        setTimeout(() => { 
          if (typeof window.WR_UpdateBionic === 'function') {
            window.WR_UpdateBionic(); 
          }
        }, 500); 
      }
    } catch (e) {
      console.error('Wider Recall: Boot failure', e);
    }
  };

  // Fetch initial state from chrome storage
  chrome.storage.sync.get(window.WR_DEFAULTS || {}, (opts) => {
    window.WR_STATE = { ...(window.WR_DEFAULTS || {}), ...opts };
    
    // Ensure body exists before booting
    if (document.body) {
      boot();
    } else {
      document.addEventListener('DOMContentLoaded', boot);
    }
  });

  // Listen for broadcast updates from the dashboard popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.type === 'WIDER_RECALL_UPDATE') {
        if (typeof window.WR_API === 'object') {
          window.WR_API.applySettings(msg);
        }
        return false; // No response needed
      }
      
      if (msg.type === 'WIDER_RECALL_GETPAGE') {
        const path = window.location.pathname;
        let page = 'Unknown page';
        
        // Use the router's current page if available
        if (window.WR_Router && window.WR_Router.currentPageId) {
          const id = window.WR_Router.currentPageId;
          // Capitalize first letter for display
          page = id.charAt(0).toUpperCase() + id.slice(1);
          if (id === 'spaced') page = 'Spaced Repetition';
          if (id === 'item') page = 'Item Detail';
          if (id === 'home') page = 'Home / Grid';
        } else {
          // Fallback logic
          if (path.includes('/item/')) page = 'Item Detail';
          else if (path.includes('/spaced-repetition')) page = 'Spaced Repetition';
          else if (path === '/' || path === '') page = 'Home / Grid';
        }
        
        sendResponse({ page });
        return true; // Keep message channel open for async sendResponse
      }
    } catch (e) {
      console.error('Wider Recall: Error processing message', e);
    }
    
    return false;
  });
})();
