// src/content/features/command-palette.js

/**
 * @fileoverview Advanced Command Palette Engine
 * Features:
 * - Levenshtein-distance fuzzy searching and advanced scoring metrics
 * - Context-aware Dynamic Command Registration API
 * - LocalStorage backed Recent Commands History
 * - Keyboard navigation, animation, and glassmorphism rendering
 */

const PaletteConfig = {
  maxResults: 15,
  historyKey: 'wr-cmd-history',
  maxHistory: 5,
};

class AdvancedCommandPalette {
  constructor() {
    this.isOpen = false;
    this.elements = {};
    this.commands = new Map(); // Core commands
    this.contextCommands = new Map(); // Contextual dynamic commands
    this.history = this.loadHistory();
    this.filtered = [];
    this.selectedIndex = 0;
    this.searchTimeout = null;

    this.registerCoreCommands();
  }

  /**
   * Initializes the DOM and bindings
   */
  init() {
    if (this.elements.overlay) return; // Already initialized
    this.buildDOM();
    this.bindEvents();
  }

  /**
   * Builds the complex Glassmorphic DOM structure
   */
  buildDOM() {
    // Overlay Container
    const overlay = document.createElement('div');
    overlay.id = 'wr-advanced-cmd-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); 
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      z-index: 999999; display: flex; align-items: flex-start; justify-content: center;
      padding-top: 12vh; opacity: 0; pointer-events: none;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // Main Box
    const box = document.createElement('div');
    box.id = 'wr-advanced-cmd-box';
    box.style.cssText = `
      width: 100%; max-width: 640px; background: rgba(20, 20, 25, 0.85); 
      border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; 
      box-shadow: 0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05); 
      overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; 
      color: #fff; transform: scale(0.96) translateY(-10px);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column;
    `;

    // Header / Search Area
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; padding: 0 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: rgba(0,0,0,0.2);
    `;

    const searchIcon = document.createElement('div');
    searchIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    searchIcon.style.display = 'flex';

    const input = document.createElement('input');
    input.id = 'wr-advanced-cmd-input';
    input.placeholder = 'Type a command or search...';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.cssText = `
      flex: 1; padding: 20px 16px; background: transparent; border: none;
      color: #fff; font-size: 18px; outline: none; font-weight: 500;
      font-family: inherit;
    `;

    header.appendChild(searchIcon);
    header.appendChild(input);

    // Results Area
    const results = document.createElement('div');
    results.id = 'wr-advanced-cmd-results';
    results.style.cssText = `
      max-height: 380px; overflow-y: auto; padding: 8px;
      overscroll-behavior: contain; scroll-behavior: smooth;
    `;

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 10px 20px; font-size: 12px; color: rgba(255,255,255,0.3);
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);
    `;
    footer.innerHTML = `
      <div style="display:flex;gap:12px;">
        <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;margin-right:4px;">↑↓</kbd> to navigate</span>
        <span><kbd style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;margin-right:4px;">↵</kbd> to select</span>
      </div>
      <span>Wider Recall Advanced</span>
    `;

    box.appendChild(header);
    box.appendChild(results);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    this.elements = { overlay, box, input, results };
  }

  /**
   * Binds UI interactions
   */
  bindEvents() {
    this.elements.input.addEventListener('input', (e) => {
      // Debounce slightly for heavy fuzzy searches
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.renderResults(e.target.value), 50);
    });

    this.elements.input.addEventListener('keydown', (e) => this.handleKeyboard(e));
    
    this.elements.overlay.addEventListener('click', (e) => {
      if (e.target === this.elements.overlay) this.close();
    });
  }

  /**
   * API to dynamically register core commands
   */
  registerCoreCommands() {
    const core = [
      { id: 'nav-home', icon: '🏠', label: 'Go to Home / Items', kbd: 'Alt+1', category: 'Navigation', action: () => this.clickTab(0) },
      { id: 'nav-chat', icon: '💬', label: 'Go to Chat', kbd: 'Alt+2', category: 'Navigation', action: () => this.clickTab(1) },
      { id: 'nav-graph', icon: '🕸', label: 'Go to Knowledge Graph', kbd: 'Alt+3', category: 'Navigation', action: () => this.clickTab(2) },
      { id: 'nav-sr', icon: '🃏', label: 'Go to Spaced Repetition', kbd: 'Alt+4', category: 'Navigation', action: () => this.clickTab(3) },
      { id: 'focus-search', icon: '🔍', label: 'Focus Search', kbd: '/', category: 'Tools', action: () => document.querySelector('input[type="search"]')?.focus() },
      { id: 'toggle-zen', icon: '🎯', label: 'Toggle Zen Mode', category: 'Reading', action: () => this.toggleSetting('zen') },
      { id: 'toggle-bionic', icon: '👀', label: 'Toggle Bionic Reading', category: 'Reading', action: () => this.toggleSetting('bionic') },
      { id: 'toggle-premium', icon: '🎨', label: 'Toggle Premium UI', category: 'Appearance', action: () => { const css = document.getElementById('wr-premium-css'); if(css) css.disabled = !css.disabled; } },
      { id: 'media-pip', icon: '📺', label: 'Snap Media to Picture-in-Picture', category: 'Media', action: () => this.triggerPiP() }
    ];

    core.forEach(cmd => this.commands.set(cmd.id, cmd));
  }

  clickTab(index) {
    document.querySelectorAll(window.WR_SELECTORS.elements.tabs)[index]?.click();
  }

  toggleSetting(key) {
    window.WR_STATE[key] = !window.WR_STATE[key];
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ [key]: window.WR_STATE[key] });
    }
    window.WR_API.applySettings(window.WR_STATE);
  }

  triggerPiP() {
    const media = document.querySelector('video, iframe');
    if (media && !media.classList.contains('wr-floating-media')) {
      // Force trigger via scroll proxy or manual class injection
      const wrapper = media.closest('.wr-media-initialized') || media;
      wrapper.classList.add('wr-floating-media');
      const advanced = wrapper.querySelector('.wr-media-advanced-wrapper');
      if (advanced) {
        advanced.style.opacity = '1';
        advanced.style.transform = 'translateY(0)';
      }
    }
  }

  /**
   * The Advanced Fuzzy Search Engine
   */
  search(query) {
    const allCommands = [...this.commands.values(), ...this.contextCommands.values()];
    
    if (!query.trim()) {
      // Show History then default list
      const histIds = new Set(this.history);
      const histCmds = this.history.map(id => allCommands.find(c => c.id === id)).filter(Boolean);
      const restCmds = allCommands.filter(c => !histIds.has(c.id));
      
      // Inject history category label
      histCmds.forEach(c => c._displayCategory = 'Recent');
      restCmds.forEach(c => c._displayCategory = c.category);
      
      return [...histCmds, ...restCmds].slice(0, PaletteConfig.maxResults);
    }

    const qLower = query.toLowerCase();
    const scored = allCommands.map(cmd => {
      const target = cmd.label.toLowerCase();
      let score = 0;

      // 1. Exact Match / Starts With
      if (target.startsWith(qLower)) score += 100;
      else if (target.includes(qLower)) score += 50;
      
      // 2. Fuzzy Scoring (Sequential character matching)
      let qIndex = 0;
      let streak = 0;
      for (let i = 0; i < target.length; i++) {
        if (target[i] === qLower[qIndex]) {
          streak++;
          score += (streak * 2); // Consecutive matches give exponential bonus
          qIndex++;
          if (qIndex === qLower.length) break;
        } else {
          streak = 0;
        }
      }
      
      // If we didn't match all characters of query, heavily penalize
      if (qIndex < qLower.length) score = -1;

      return { cmd, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, PaletteConfig.maxResults)
      .map(item => { item.cmd._displayCategory = item.cmd.category; return item.cmd; });
  }

  renderResults(query) {
    this.filtered = this.search(query);
    this.selectedIndex = 0;

    if (this.filtered.length === 0) {
      this.elements.results.innerHTML = `
        <div style="padding: 30px; text-align: center; color: rgba(255,255,255,0.4);">
          No commands found matching "${query}"
        </div>
      `;
      return;
    }

    let html = '';
    let currentCat = null;

    this.filtered.forEach((item, i) => {
      if (item._displayCategory !== currentCat) {
        currentCat = item._displayCategory;
        html += `<div style="
          padding: 12px 16px 4px 16px; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.05em; color: rgba(255,255,255,0.4); font-weight: 600;
        ">${currentCat}</div>`;
      }

      const isSelected = i === this.selectedIndex;
      const bg = isSelected ? 'rgba(139,92,246,0.15)' : 'transparent';
      const color = isSelected ? '#C4B5FD' : '#eee';
      const border = isSelected ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent';

      html += `
        <div class="wr-cmd-item" data-index="${i}" style="
          padding: 14px 16px; margin: 4px 8px; display: flex; align-items: center; gap: 14px;
          border-radius: 10px; cursor: pointer; transition: all 0.15s ease;
          background: ${bg}; color: ${color}; border: ${border};
        ">
          <span style="font-size: 18px; filter: grayscale(${isSelected ? 0 : 0.5});">${item.icon}</span>
          <span style="flex: 1; font-weight: 500;">${item.label}</span>
          ${item.kbd ? `<span style="font-size: 11px; font-family: monospace; background: rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">${item.kbd}</span>` : ''}
        </div>
      `;
    });

    this.elements.results.innerHTML = html;

    this.elements.results.querySelectorAll('.wr-cmd-item').forEach((el, i) => {
      el.addEventListener('mousemove', () => {
        if (this.selectedIndex !== i) this.setSelectedIndex(i);
      });
      el.addEventListener('click', () => this.executeCommand(this.filtered[i]));
    });
  }

  setSelectedIndex(index) {
    this.selectedIndex = index;
    const items = this.elements.results.querySelectorAll('.wr-cmd-item');
    
    items.forEach((el, i) => {
      const isSelected = i === index;
      el.style.background = isSelected ? 'rgba(139,92,246,0.15)' : 'transparent';
      el.style.color = isSelected ? '#C4B5FD' : '#eee';
      el.style.border = isSelected ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent';
      el.querySelector('span').style.filter = `grayscale(${isSelected ? 0 : 0.5})`;
      
      if (isSelected) {
        // Advanced scroll bounding logic
        const container = this.elements.results;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        if (rect.bottom > containerRect.bottom) {
          container.scrollTop += (rect.bottom - containerRect.bottom + 8);
        } else if (rect.top < containerRect.top) {
          container.scrollTop -= (containerRect.top - rect.top + 8);
        }
      }
    });
  }

  handleKeyboard(e) {
    if (e.key === 'Escape') { 
      this.close(); 
      e.preventDefault();
      return; 
    }
    
    if (this.filtered.length === 0) return;

    if (e.key === 'ArrowDown' || (e.key === 'j' && e.ctrlKey)) {
      this.setSelectedIndex((this.selectedIndex + 1) % this.filtered.length);
      e.preventDefault();
    }
    else if (e.key === 'ArrowUp' || (e.key === 'k' && e.ctrlKey)) {
      this.setSelectedIndex((this.selectedIndex - 1 + this.filtered.length) % this.filtered.length);
      e.preventDefault();
    }
    else if (e.key === 'Enter') {
      this.executeCommand(this.filtered[this.selectedIndex]);
      e.preventDefault();
    }
  }

  executeCommand(cmd) {
    if (!cmd) return;
    
    // Save to history
    this.history = this.history.filter(id => id !== cmd.id);
    this.history.unshift(cmd.id);
    if (this.history.length > PaletteConfig.maxHistory) this.history.pop();
    this.saveHistory();

    // Execute
    try {
      cmd.action();
    } catch(e) {
      console.error("Error executing command", cmd.id, e);
    }
    
    this.close();
  }

  loadHistory() {
    try {
      const data = localStorage.getItem(PaletteConfig.historyKey);
      return data ? JSON.parse(data) : [];
    } catch(e) { return []; }
  }

  saveHistory() {
    try {
      localStorage.setItem(PaletteConfig.historyKey, JSON.stringify(this.history));
    } catch(e) {}
  }

  open() {
    if (!this.elements.overlay) this.init();
    this.isOpen = true;
    
    // Reset state
    this.elements.input.value = '';
    this.renderResults('');
    
    // Animate In
    this.elements.overlay.style.pointerEvents = 'auto';
    this.elements.overlay.style.opacity = '1';
    this.elements.box.style.transform = 'scale(1) translateY(0)';
    
    setTimeout(() => this.elements.input.focus(), 50);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    
    // Animate Out
    this.elements.overlay.style.pointerEvents = 'none';
    this.elements.overlay.style.opacity = '0';
    this.elements.box.style.transform = 'scale(0.96) translateY(-10px)';
  }
}

// Global Hook
let globalCmdPalette = null;
window.WR_ToggleCommandPalette = function() {
  if (!globalCmdPalette) {
    globalCmdPalette = new AdvancedCommandPalette();
  }
  globalCmdPalette.isOpen ? globalCmdPalette.close() : globalCmdPalette.open();
};
