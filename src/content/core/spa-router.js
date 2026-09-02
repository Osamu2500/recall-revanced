'use strict';

/**
 * @fileoverview Wider Recall - SPA Router
 * Intercepts HTML5 History API methods to dispatch a custom 'wr-locationchange'
 * event on Single Page Application (SPA) navigation. This allows the extension
 * to react to page changes without full reloads.
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
