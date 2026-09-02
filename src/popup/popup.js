'use strict';

/**
 * @fileoverview Wider Recall - Popup UI Controller
 * Manages the extension's popup dashboard state, UI updates, and message broadcasting.
 */

const DEFAULTS = Object.freeze({ 
  width: 1100, wrap: true, hideSidebar: false, hideOutline: true, grid: true, gridCols: 3, typo: true, enabled: true,
  zen: false, media: true, tocHover: false, graph: true, hotkeys: true,
  bionic: false, cmd: true, lightbox: true, theme: 'default', focus: false, toc: false, codeTools: true,
  animations: true, spotlight: true, premiumUi: true, immersiveCards: true, chatMultiSelect: true
});

/**
 * Helper to fetch DOM elements by ID
 * @param {string} id - The element ID
 * @returns {HTMLElement}
 */
const $ = id => document.getElementById(id);

// UI Elements caching
const UI = {
  navItems: document.querySelectorAll('.nav-item'),
  panels: document.querySelectorAll('.panel'),
  presetBtns: document.querySelectorAll('.pb'),
  themeBtns: document.querySelectorAll('.theme-btn'),
  pageLabel: $('pageLabel'),
  statusDot: $('statusDot'),
  widthRange: $('widthRange'),
  wvalEl: $('wval'),
  gridColsRange: $('gridColsRange'),
  gvalEl: $('gval'),
  checkboxes: {
    enabled:        $('enabledCb'),
    hideSidebar:    $('hideSidebarCb'),
    grid:           $('gridCb'),
    typo:           $('typoCb'),
    media:          $('mediaCb'),
    graph:          $('graphCb'),
    lightbox:       $('lightboxCb'),
    animations:     $('animationsCb'),
    spotlight:      $('spotlightCb'),
    premiumUi:      $('premiumUiCb'),
    immersiveCards: $('immersiveCardsCb'),
    chatMultiSelect:$('chatMultiSelectCb'),
    zen:            $('zenCb'),
    toc:            $('tocCb'),
    codeTools:      $('codeToolsCb')
  }
};

let currentState = { ...DEFAULTS };

/**
 * Handles switching between dashboard tabs
 */
function initTabs() {
  UI.navItems.forEach(item => {
    item.addEventListener('click', () => {
      UI.navItems.forEach(n => n.classList.remove('active'));
      UI.panels.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      
      const targetPanel = $(item.dataset.target);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
}

/**
 * Synchronizes the UI elements with the current state object
 */
function syncUI() {
  // Sync Checkboxes
  Object.keys(UI.checkboxes).forEach(key => {
    if (UI.checkboxes[key] && currentState[key] !== undefined) {
      UI.checkboxes[key].checked = currentState[key];
    }
  });

  // Sync Width Slider
  if (UI.widthRange && UI.wvalEl) {
    UI.widthRange.value = currentState.width;
    UI.wvalEl.textContent = currentState.width === 3000 ? 'Full' : `${currentState.width}px`;
  }

  // Sync Grid Cols Slider
  if (UI.gridColsRange && UI.gvalEl) {
    UI.gridColsRange.value = currentState.gridCols;
    UI.gvalEl.textContent = currentState.gridCols;
  }

  // Sync Presets & Themes
  UI.presetBtns.forEach(b => b.classList.toggle('active', +b.dataset.w === currentState.width));
  UI.themeBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === currentState.theme));
  
  // Toggle global disabled state visual
  document.body.classList.toggle('off', !currentState.enabled);

  // Sync status dot in header
  if (UI.statusDot) {
    UI.statusDot.classList.toggle('inactive', !currentState.enabled);
  }
}

/**
 * Saves current state to Chrome sync storage
 */
function saveState() { 
  chrome.storage.sync.set(currentState); 
}

/**
 * Broadcasts the current state to the active tab to trigger immediate DOM updates
 */
function broadcastState() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const activeTab = tabs[0];
    if (!activeTab?.id) return;
    
    // Send full state update
    chrome.tabs.sendMessage(activeTab.id, { type: 'WIDER_RECALL_UPDATE', ...currentState });
    
    // Request page type for the footer indicator
    chrome.tabs.sendMessage(activeTab.id, { type: 'WIDER_RECALL_GETPAGE' }, res => {
      if (chrome.runtime.lastError || !res) return;
      if (UI.pageLabel) UI.pageLabel.textContent = res.page;
      if (UI.statusDot) UI.statusDot.style.background = res.page === 'Unknown page' ? '#555' : '#22c55e';
    });
  });
}

/**
 * Core update pipeline
 */
function applyChanges() { 
  syncUI(); 
  saveState(); 
  broadcastState(); 
}

/**
 * Binds all event listeners to inputs
 */
function initEventListeners() {
  // Bind Checkboxes
  Object.keys(UI.checkboxes).forEach(key => {
    const cb = UI.checkboxes[key];
    if (cb) {
      cb.addEventListener('change', () => { 
        currentState[key] = cb.checked; 
        applyChanges(); 
      });
    }
  });

  // Bind Themes
  UI.themeBtns.forEach(btn => {
    btn.addEventListener('click', () => { 
      currentState.theme = btn.dataset.theme; 
      applyChanges(); 
    });
  });

  // Bind Width Slider
  if (UI.widthRange) {
    UI.widthRange.addEventListener('input', () => {
      currentState.width = parseInt(UI.widthRange.value, 10);
      if (UI.wvalEl) UI.wvalEl.textContent = currentState.width === 3000 ? 'Full' : `${currentState.width}px`;
      applyChanges();
    });
  }

  // Bind Grid Cols Slider
  if (UI.gridColsRange) {
    UI.gridColsRange.addEventListener('input', () => {
      currentState.gridCols = parseInt(UI.gridColsRange.value, 10);
      if (UI.gvalEl) UI.gvalEl.textContent = currentState.gridCols;
      applyChanges();
    });
  }

  // Bind Width Presets
  UI.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => { 
      currentState.width = +btn.dataset.w; 
      applyChanges(); 
    });
  });
}

/**
 * Initializes the popup by fetching saved state and probing the active tab
 */
function initPopup() {
  initTabs();
  initEventListeners();

  // Initial tab probe for page indicator
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const activeTab = tabs[0];
    if (!activeTab?.id) return;
    
    chrome.tabs.sendMessage(activeTab.id, { type: 'WIDER_RECALL_GETPAGE' }, res => {
      if (chrome.runtime.lastError || !res) {
        if (UI.pageLabel) UI.pageLabel.textContent = 'app.recall.it';
        return;
      }
      if (UI.pageLabel) UI.pageLabel.textContent = res.page;
      if (UI.statusDot) {
        UI.statusDot.style.background = res.page === 'Unknown page' ? '#555' : '#22c55e';
        if (res.page !== 'Unknown page') {
          UI.statusDot.style.boxShadow = '0 0 6px rgba(34,197,94,0.6)';
        }
      }
    });
  });

  // Load saved state
  chrome.storage.sync.get(DEFAULTS, saved => { 
    currentState = { ...DEFAULTS, ...saved }; 
    syncUI(); 
  });
}

// Boot
document.addEventListener('DOMContentLoaded', initPopup);
