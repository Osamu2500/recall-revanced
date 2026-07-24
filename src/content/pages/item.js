'use strict';

window.WR_PAGES.item = {
  init() {
    console.log('Wider Recall: Initialized Item Detail Page');
    // We already have generic observers in main/state-manager, 
    // but item-specific lifecycle hooks go here
    if (window.WR_SetupMediaObserver) window.WR_SetupMediaObserver();
  },
  
  cleanup() {
    console.log('Wider Recall: Cleaned up Item Detail Page');
    // Cleanup media observer if we navigate away
    if (window.WR_MediaObserverInstance) {
      window.WR_MediaObserverInstance.disconnect();
      window.WR_MediaObserverInstance = null;
    }
  }
};
