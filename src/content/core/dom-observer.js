// src/content/core/dom-observer.js

let domEnforceTimeout = null;

window.WR_EnforceDomState = function() {
  if (domEnforceTimeout) cancelAnimationFrame(domEnforceTimeout);
  
  domEnforceTimeout = requestAnimationFrame(() => {
    try {
      if (!window.WR_STATE || !window.WR_STATE.enabled) return;
      const shouldHideSidebar = window.WR_STATE.hideSidebar || window.WR_STATE.zen;

      if (shouldHideSidebar) {
        const navCandidates = document.querySelectorAll(window.WR_SELECTORS.elements.sidebarCandidates);
        let sidebar = null;
        for (let el of navCandidates) {
          const rect = el.getBoundingClientRect();
          if (rect.left === 0 && rect.top === 0 && rect.width > 0 && rect.width < 100 && rect.height > window.innerHeight * 0.8) {
            const pos = getComputedStyle(el).position;
            if (pos === 'fixed' || pos === 'sticky' || pos === 'absolute' || el.tagName === 'NAV') {
              sidebar = el; break;
            }
          }
        }

        if (sidebar) {
          sidebar.style.display = 'none';
          sidebar.setAttribute('data-wr-hidden-sidebar', 'true');
        }

        // Aggressively hide any floating icons (like settings, gift, profile) left behind at the bottom left
        const possibleIcons = document.querySelectorAll('button, a, [role="button"], img, svg');
        for (let icon of possibleIcons) {
          const rect = icon.getBoundingClientRect();
          // If the element is small and located in the bottom-left 80x250 region
          if (rect.left >= 0 && rect.left < 80 && rect.bottom > window.innerHeight - 250 && rect.width > 0 && rect.width < 60) {
            // Ensure we are hiding the container of the icon if it has one
            const target = (icon.tagName === 'SVG' || icon.tagName === 'IMG') ? icon.closest('button, a, [role="button"]') || icon : icon;
            target.style.display = 'none';
            target.setAttribute('data-wr-hidden-icon', 'true');
          }
        }
        
        const mainWrappers = document.querySelectorAll(window.WR_SELECTORS.elements.mainWrappers);
        for (let el of mainWrappers) {
          const style = getComputedStyle(el);
          if (style.marginLeft === '52px') el.style.setProperty('margin-left', '0px', 'important');
          if (style.left === '52px') el.style.setProperty('left', '0px', 'important');
          if (style.paddingLeft === '52px') el.style.setProperty('padding-left', '0px', 'important');
        }
      } else {
        const hiddenSidebar = document.querySelector('[data-wr-hidden-sidebar="true"]');
        if (hiddenSidebar) {
          hiddenSidebar.style.display = '';
          hiddenSidebar.removeAttribute('data-wr-hidden-sidebar');
        }
        const mainWrappers = document.querySelectorAll(window.WR_SELECTORS.elements.mainWrappers);
        for (let el of mainWrappers) {
          if (el.style.marginLeft === '0px') el.style.marginLeft = '';
          if (el.style.left === '0px') el.style.left = '';
          if (el.style.paddingLeft === '0px') el.style.paddingLeft = '';
        }
      }
    } catch (e) {
      console.warn("Wider Recall: Error in EnforceDomState", e);
    }
  });
};

setInterval(() => { 
  if (window.WR_STATE && window.WR_STATE.enabled && window.WR_EnforceDomState) window.WR_EnforceDomState(); 
}, 1000); // Reduced polling frequency in favor of MutationObserver

let mutationDebounce = null;
const observer = new MutationObserver(() => {
  if (mutationDebounce) clearTimeout(mutationDebounce);
  mutationDebounce = setTimeout(() => {
    try {
      if (document.body && !document.body.hasAttribute('data-wr-page') && window.WR_STATE && window.WR_STATE.enabled) {
        if (window.WR_API) {
          window.WR_API.applySettings(window.WR_STATE);
          setTimeout(() => window.WR_API.restoreState(), 150);
        }
      }
      
      // Hook for new 2.0 dynamic elements
      if (window.WR_InitFocusMode) window.WR_InitFocusMode();
      if (window.WR_InitMinimap) window.WR_InitMinimap();
      if (window.WR_InitCodeTools) window.WR_InitCodeTools();
      if (window.WR_EnhanceCards) window.WR_EnhanceCards();

    } catch (e) {
      console.warn("Wider Recall: Error in MutationObserver", e);
    }
  }, 100); // 100ms debounce
});

window.WR_EnhanceCards = function() {
  if (!window.WR_STATE || !window.WR_STATE.enabled) return;
  
  const cards = document.querySelectorAll('article:not([data-re-animated]), [class*="MuiCard"]:not([data-re-animated])');
  cards.forEach((card, i) => {
    card.setAttribute('data-re-animated', 'true');
    card.classList.add('re-card-enter');
    card.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
    
    // Add spotlight effect
    card.setAttribute('data-re-spotlight', 'true');
    card.classList.add('re-spotlight');

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mx', `${x}%`);
      card.style.setProperty('--my', `${y}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '50%');
    });
  });
};


if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true, attributes: false });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
  });
}
