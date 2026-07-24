// src/content/core/hotkeys.js

document.addEventListener('keydown', (e) => {
  if (!window.WR_STATE || !window.WR_STATE.enabled) return;
  
  if (window.WR_STATE.cmd && e.ctrlKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (window.WR_ToggleCommandPalette) window.WR_ToggleCommandPalette();
    return;
  }
  
  if (!window.WR_STATE.hotkeys) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || e.target.closest(window.WR_SELECTORS.elements.editor)) return;
  
  if (e.altKey && e.key === '1') {
    e.preventDefault();
    const tabs = Array.from(document.querySelectorAll('button[role="tab"], #id-item-tabs button'));
    if (tabs.length > 0) tabs[0].click();
  } else if (e.altKey && e.key === '2') {
    e.preventDefault();
    const tabs = Array.from(document.querySelectorAll(window.WR_SELECTORS.elements.tabs));
    if (tabs.length > 1) tabs[1].click();
  } else if (e.altKey && e.key === '3') {
    e.preventDefault();
    const tabs = Array.from(document.querySelectorAll(window.WR_SELECTORS.elements.tabs));
    if (tabs.length > 2) tabs[2].click();
  } else if (e.altKey && e.key.toLowerCase() === 'q') {
    e.preventDefault();
    window.WR_STATE.hideSidebar = !window.WR_STATE.hideSidebar;
    window.WR_API.applySettings(window.WR_STATE);
    chrome.storage.sync.set({ hideSidebar: window.WR_STATE.hideSidebar });
  } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    window.WR_STATE.zen = !window.WR_STATE.zen;
    window.WR_API.applySettings(window.WR_STATE);
    chrome.storage.sync.set({ zen: window.WR_STATE.zen });
  }

  // Update 2.0: Spaced Repetition Hotkeys
  if (window.WR_API && window.WR_API.getPage() === 'spaced') {
    if (e.key === ' ') { // Spacebar to flip card
      e.preventDefault();
      const flipBtn = document.querySelector(window.WR_SELECTORS.elements.flipCardBtn) || Array.from(document.querySelectorAll(window.WR_SELECTORS.elements.allButtons)).find(b => b.textContent.toLowerCase().includes('show answer'));
      if (flipBtn) flipBtn.click();
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      // Recall uses different buttons based on state, but we attempt to find the bottom action buttons by assuming they are a row of buttons
      const actionRow = document.querySelector(window.WR_SELECTORS.elements.spacedRepetitionActionRow) || document.querySelector(window.WR_SELECTORS.elements.spacedRepetitionActionRowFallback);
      if (actionRow) {
        const allBtns = actionRow.parentElement.querySelectorAll(window.WR_SELECTORS.elements.allButtons);
        const idx = parseInt(e.key) - 1;
        if (allBtns.length >= idx + 1) allBtns[idx].click();
      }
    }
  }
});
