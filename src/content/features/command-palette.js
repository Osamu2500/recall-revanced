// src/content/features/command-palette.js

class CommandPalette {
  constructor() {
    this._open = false;
    this._el = null;
    this._input = null;
    this._selected = 0;
    this._items = [
      { icon: '🏠', label: 'Go to Home / Items', kbd: 'Alt+1', action: () => document.querySelectorAll(window.WR_SELECTORS.elements.tabs)[0]?.click() },
      { icon: '💬', label: 'Go to Chat', kbd: 'Alt+2', action: () => document.querySelectorAll(window.WR_SELECTORS.elements.tabs)[1]?.click() },
      { icon: '🕸', label: 'Go to Knowledge Graph', kbd: 'Alt+3', action: () => document.querySelectorAll(window.WR_SELECTORS.elements.tabs)[2]?.click() },
      { icon: '🃏', label: 'Go to Spaced Repetition', kbd: 'Alt+4', action: () => document.querySelectorAll(window.WR_SELECTORS.elements.tabs)[3]?.click() },
      { icon: '🔍', label: 'Focus Search', kbd: '/', action: () => document.querySelector('input[type="search"], input[placeholder*="Search"]')?.focus() },
      { icon: '🎯', label: 'Toggle Zen Mode', action: () => { window.WR_STATE.zen = !window.WR_STATE.zen; chrome.storage.sync.set({zen: window.WR_STATE.zen}); window.WR_API.applySettings(window.WR_STATE); } },
      { icon: '👀', label: 'Toggle Bionic Reading', action: () => { window.WR_STATE.bionic = !window.WR_STATE.bionic; chrome.storage.sync.set({bionic: window.WR_STATE.bionic}); window.WR_API.applySettings(window.WR_STATE); } },
      { icon: '🎨', label: 'Toggle Premium UI', action: () => { const css = document.getElementById('wr-premium-css'); if(css) css.disabled = !css.disabled; } },
    ];
  }

  init() {
    this._build();
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.id = 're-cmd-overlay';
    
    // Using inline styles for quick injection, overriding from wider.css if needed
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      z-index: 999999; display: none; align-items: flex-start; justify-content: center;
      padding-top: 15vh;
    `;

    const box = document.createElement('div');
    box.id = 're-cmd-box';
    box.style.cssText = `
      width: 100%; max-width: 600px; background: #13131a; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); overflow: hidden;
      font-family: 'Inter', sans-serif; color: #fff;
    `;

    const input = document.createElement('input');
    input.id = 're-cmd-input';
    input.placeholder = 'Jump to... (type a command)';
    input.style.cssText = `
      width: 100%; padding: 16px 20px; background: transparent; border: none;
      border-bottom: 1px solid rgba(255,255,255,0.06); color: #fff; font-size: 18px; outline: none;
    `;
    input.addEventListener('input', () => this._render(input.value));
    input.addEventListener('keydown', e => this._onKey(e));

    const results = document.createElement('div');
    results.id = 're-cmd-results';
    results.style.cssText = 'max-height: 400px; overflow-y: auto; padding: 8px;';

    box.appendChild(input);
    box.appendChild(results);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });

    this._el = overlay;
    this._input = input;
    this._results = results;
    this._render('');
  }

  _render(q) {
    const filtered = this._items.filter(item =>
      !q || item.label.toLowerCase().includes(q.toLowerCase())
    );

    this._filtered = filtered;
    this._selected = 0;

    this._results.innerHTML = filtered.map((item, i) => `
      <div class="re-cmd-item" data-index="${i}" style="
        padding: 12px 16px; display: flex; align-items: center; gap: 12px;
        border-radius: 8px; cursor: pointer; transition: all 0.1s;
        ${i === 0 ? 'background: rgba(139,92,246,0.15); color: #C4B5FD;' : 'color: #ccc;'}
      ">
        <span style="font-size: 16px;">${item.icon}</span>
        <span style="flex: 1; font-weight: 500;">${item.label}</span>
        ${item.kbd ? `<span style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${item.kbd}</span>` : ''}
      </div>
    `).join('');

    this._results.querySelectorAll('.re-cmd-item').forEach((el, i) => {
      el.addEventListener('mouseenter', () => this._setSelect(i));
      el.addEventListener('click', () => { this._filtered[i]?.action(); this.close(); });
    });
  }

  _setSelect(index) {
    this._selected = index;
    this._results.querySelectorAll('.re-cmd-item').forEach((el, i) => {
      if (i === index) {
        el.style.background = 'rgba(139,92,246,0.15)';
        el.style.color = '#C4B5FD';
      } else {
        el.style.background = 'transparent';
        el.style.color = '#ccc';
      }
    });
  }

  _onKey(e) {
    if (e.key === 'Escape') { this.close(); return; }
    if (e.key === 'ArrowDown') { this._move(1); e.preventDefault(); }
    if (e.key === 'ArrowUp') { this._move(-1); e.preventDefault(); }
    if (e.key === 'Enter') {
      this._filtered?.[this._selected]?.action();
      this.close();
    }
  }

  _move(dir) {
    const max = (this._filtered?.length || 0) - 1;
    this._selected = Math.max(0, Math.min(max, this._selected + dir));
    this._setSelect(this._selected);
    
    // Ensure selected is in view
    const selectedEl = this._results.children[this._selected];
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  open() {
    this._open = true;
    this._el.style.display = 'flex';
    this._input.value = '';
    this._render('');
    requestAnimationFrame(() => this._input.focus());
  }

  close() {
    this._open = false;
    this._el.style.display = 'none';
  }
}

// Attach globally
let globalCmdPalette = null;
window.WR_ToggleCommandPalette = function() {
  if (!globalCmdPalette) {
    globalCmdPalette = new CommandPalette();
    globalCmdPalette.init();
  }
  globalCmdPalette._open ? globalCmdPalette.close() : globalCmdPalette.open();
};
