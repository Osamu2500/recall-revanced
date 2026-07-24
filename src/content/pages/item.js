'use strict';

/**
 * @fileoverview Wider Recall - Item Page Module
 */

window.WR_PAGES.item = {
  _active: false,
  _tabObserver: null,

  init() {
    this._active = true;
    console.log('[WR] Item Detail Page initialized');
    
    // Set up media observer
    if (typeof window.WR_SetupMediaObserver === 'function') {
      window.WR_SetupMediaObserver();
    }
    
    // Bionic Reading setup
    if (typeof window.WR_UpdateBionic === 'function') {
      window.WR_UpdateBionic();
    }
    
    // Minimap / TOC setup
    if (typeof window.WR_InitMinimap === 'function') {
      window.WR_InitMinimap();
    }

    this._watchTabSwitches();
  },
  
  cleanup() {
    this._active = false;
    console.log('[WR] Item Detail Page cleaned up');
    
    if (this._tabObserver) {
      this._tabObserver.disconnect();
      this._tabObserver = null;
    }
    
    if (window.WR_MediaObserverInstance) {
      window.WR_MediaObserverInstance.disconnect();
      window.WR_MediaObserverInstance = null;
    }
  },

  _watchTabSwitches() {
    if (this._tabObserver) this._tabObserver.disconnect();

    const tabList = document.querySelector('[role="tablist"]');
    if (!tabList) {
      setTimeout(() => { if (this._active) this._watchTabSwitches(); }, 500);
      return;
    }

    this._tabObserver = new MutationObserver(() => {
      if (this._active && window.WR_STATE && window.WR_STATE.enabled) {
        // Re-apply subpage attribute
        const activeTabEl = document.querySelector('[role="tab"][aria-selected="true"]');
        if (activeTabEl) {
          document.body.setAttribute('data-wr-subpage', activeTabEl.textContent.trim().toLowerCase());
        }
      }
    });

    this._tabObserver.observe(tabList, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    });
  }
};
