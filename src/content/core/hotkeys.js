'use strict';

/**
 * @fileoverview Wider Recall - Keyboard Shortcuts
 */

function initHotkeys() {
  document.addEventListener('keydown', (e) => {
    if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.hotkeys) return;

    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      // Allow Ctrl+K to still work if not in the command palette input itself
      if (!(e.ctrlKey && e.key.toLowerCase() === 'k') || e.target.id === 're-cmd-input') {
        return;
      }
    }

    // Ctrl + K -> Command Palette
    if (e.ctrlKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (window.WR_STATE.cmd && typeof window.WR_ToggleCommandPalette === 'function') {
        window.WR_ToggleCommandPalette();
      }
    }
    
    // Alt + Q -> Toggle Sidebar
    if (e.altKey && e.key.toLowerCase() === 'q') {
      e.preventDefault();
      window.WR_STATE.hideSidebar = !window.WR_STATE.hideSidebar;
      if (chrome && chrome.storage && chrome.storage.sync) chrome.storage.sync.set({ hideSidebar: window.WR_STATE.hideSidebar });
      if (window.WR_API) window.WR_API.applySettings(window.WR_STATE);
    }
    
    // Ctrl + Shift + F -> Toggle Zen Mode
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      window.WR_STATE.zen = !window.WR_STATE.zen;
      if (chrome && chrome.storage && chrome.storage.sync) chrome.storage.sync.set({ zen: window.WR_STATE.zen });
      if (window.WR_API) window.WR_API.applySettings(window.WR_STATE);
    }
  });
}

initHotkeys();
