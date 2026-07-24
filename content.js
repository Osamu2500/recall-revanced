// Wider Recall v5 — content script (God Mode Update)

const DEFAULTS = { 
  width: 1100, wrap: true, hideSidebar: false, hideOutline: true, grid: true, typo: true, enabled: true,
  zen: false, media: true, tocHover: false, graph: true, hotkeys: true,
  bionic: false, cmd: true, lightbox: true, theme: 'default'
};
let current = { ...DEFAULTS };
let scrollTimeout = null;
let restoreInterval = null;
let enforcementInterval = null;
let lastScrollY = 0;
let mediaObserver = null;
let cmdPalette = null;
let lightboxEl = null;

function getPage() {
  const path = location.pathname;
  if (path.includes('/item/'))             return 'item';
  if (path.includes('/spaced-repetition')) return 'spaced';
  return 'other';
}

function getItemId() {
  const match = location.pathname.match(/\/item\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

function applySettings(opts) {
  const oldBionic = current.bionic;
  const oldZen = current.zen;
  current = { ...current, ...opts };
  
  const body = document.body;
  if (!body) return;

  if (!current.enabled) {
    body.removeAttribute('data-wr-enabled');
  } else {
    body.setAttribute('data-wr-enabled', 'true');
    document.documentElement.style.setProperty('--wr-width', current.width === 3000 ? '100%' : `${current.width}px`);
    body.setAttribute('data-wr-wrap', current.wrap ? 'true' : 'false');
    body.setAttribute('data-wr-hide-sidebar', current.hideSidebar ? 'true' : 'false');
    body.setAttribute('data-wr-hide-outline', current.hideOutline ? 'true' : 'false');
    body.setAttribute('data-wr-grid', current.grid ? 'true' : 'false');
    body.setAttribute('data-wr-typo', current.typo ? 'true' : 'false');
    body.setAttribute('data-wr-zen', current.zen ? 'true' : 'false');
    body.setAttribute('data-wr-toc-hover', current.tocHover ? 'true' : 'false');
    body.setAttribute('data-wr-graph', current.graph ? 'true' : 'false');
    body.setAttribute('data-wr-media', current.media ? 'true' : 'false');
    body.setAttribute('data-wr-theme', current.theme);
    body.setAttribute('data-wr-page', getPage());
  }
  
  enforceDomState();
  setupMediaObserver();
  
  if (oldBionic !== current.bionic) updateBionic();
  if (oldZen !== current.zen) applyCinematicZen();
}

// ── DOM Enforcement ──────────────────────────────────────────────────────────
function enforceDomState() {
  if (!current.enabled) return;

  const shouldHideSidebar = current.hideSidebar || current.zen;

  if (shouldHideSidebar) {
    const navCandidates = document.querySelectorAll('nav, aside, .MuiDrawer-root, .MuiDrawer-paperAnchorLeft, div');
    let sidebar = null;
    for (let el of navCandidates) {
      const rect = el.getBoundingClientRect();
      if (rect.left === 0 && rect.top === 0 && rect.width > 0 && rect.width < 100 && rect.height > window.innerHeight * 0.8) {
        if (getComputedStyle(el).position === 'fixed' || getComputedStyle(el).position === 'sticky' || getComputedStyle(el).position === 'absolute' || el.tagName === 'NAV') {
          sidebar = el;
          break;
        }
      }
    }

    if (sidebar) {
      sidebar.style.display = 'none';
      sidebar.setAttribute('data-wr-hidden-sidebar', 'true');
    }
    
    const mainWrappers = document.querySelectorAll('#navigation-scroll-container, main, #root > div > div, .MuiDrawer-paperAnchorBottom, .MuiModal-backdrop');
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
    const mainWrappers = document.querySelectorAll('#navigation-scroll-container, main, #root > div > div, .MuiDrawer-paperAnchorBottom, .MuiModal-backdrop');
    for (let el of mainWrappers) {
      if (el.style.marginLeft === '0px') el.style.marginLeft = '';
      if (el.style.left === '0px') el.style.left = '';
      if (el.style.paddingLeft === '0px') el.style.paddingLeft = '';
    }
  }
}
setInterval(() => { if (current.enabled) enforceDomState(); }, 500);

// ── Cinematic Zen Mode ───────────────────────────────────────────────────────
function applyCinematicZen() {
  const oldBg = document.getElementById('wr-cinematic-bg');
  if (oldBg) oldBg.remove();
  
  if (!current.enabled || !current.zen) return;
  
  setTimeout(() => {
    const thumb = document.querySelector('img[src*="ytimg"], [class*="summary"] img, article img');
    if (thumb && thumb.src) {
      const bg = document.createElement('div');
      bg.id = 'wr-cinematic-bg';
      bg.style.backgroundImage = `url(${thumb.src})`;
      document.body.appendChild(bg);
    }
  }, 500);
}

// ── Bionic Reading Engine ────────────────────────────────────────────────────
function applyBionicReading(node) {
  if (node.nodeType === 3) { // Text node
    const words = node.nodeValue.split(/(\s+)/);
    if (words.length <= 1 && words[0].trim().length === 0) return;
    
    const fragment = document.createDocumentFragment();
    let changed = false;
    words.forEach(w => {
      if (w.trim().length > 1) {
        changed = true;
        const mid = Math.ceil(w.length / 2);
        const b = document.createElement('b');
        b.className = 'wr-bionic';
        b.textContent = w.slice(0, mid);
        fragment.appendChild(b);
        fragment.appendChild(document.createTextNode(w.slice(mid)));
      } else {
        fragment.appendChild(document.createTextNode(w));
      }
    });
    if (changed) node.parentNode.replaceChild(fragment, node);
  } else if (node.nodeType === 1) { // Element node
    if (node.classList.contains('wr-bionic')) return;
    if (['B', 'STRONG', 'PRE', 'CODE', 'A', 'H1', 'H2', 'H3'].includes(node.tagName)) return;
    Array.from(node.childNodes).forEach(applyBionicReading);
  }
}
function removeBionicReading(root) {
  const bionics = root.querySelectorAll('.wr-bionic');
  bionics.forEach(b => {
    const text = document.createTextNode(b.textContent);
    b.parentNode.replaceChild(text, b);
  });
  root.normalize();
}
function updateBionic() {
  const editor = document.querySelector('.ProseMirror');
  if (!editor) return;
  if (current.bionic && current.enabled) applyBionicReading(editor);
  else removeBionicReading(editor);
}

// ── Command Palette (Ctrl+K) ─────────────────────────────────────────────────
function toggleCommandPalette() {
  if (cmdPalette) {
    cmdPalette.remove();
    cmdPalette = null;
    return;
  }
  
  cmdPalette = document.createElement('div');
  cmdPalette.className = 'wr-cmd-palette';
  cmdPalette.innerHTML = `
    <div class="wr-cmd-overlay"></div>
    <div class="wr-cmd-modal">
      <input type="text" id="wr-cmd-input" placeholder="Type a command... (e.g. Zen, Theme, Grid)" autocomplete="off" />
      <ul id="wr-cmd-list"></ul>
    </div>
  `;
  document.body.appendChild(cmdPalette);
  
  const overlay = cmdPalette.querySelector('.wr-cmd-overlay');
  overlay.onclick = toggleCommandPalette;
  
  const input = cmdPalette.querySelector('#wr-cmd-input');
  const list = cmdPalette.querySelector('#wr-cmd-list');
  
  const commands = [
    { name: 'Toggle Zen Mode', action: () => { current.zen = !current.zen; chrome.storage.sync.set({zen: current.zen}); applySettings(current); } },
    { name: 'Toggle Bionic Reading', action: () => { current.bionic = !current.bionic; chrome.storage.sync.set({bionic: current.bionic}); applySettings(current); } },
    { name: 'Toggle Sidebar', action: () => { current.hideSidebar = !current.hideSidebar; chrome.storage.sync.set({hideSidebar: current.hideSidebar}); applySettings(current); } },
    { name: 'Switch to Notebook', action: () => { document.querySelectorAll('button[role="tab"], #id-item-tabs button')[0]?.click(); } },
    { name: 'Switch to Chat', action: () => { document.querySelectorAll('button[role="tab"], #id-item-tabs button')[1]?.click(); } },
    { name: 'Switch to Quiz', action: () => { document.querySelectorAll('button[role="tab"], #id-item-tabs button')[2]?.click(); } },
    { name: 'Theme: Default Recall', action: () => { current.theme = 'default'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Notion Minimal', action: () => { current.theme = 'notion'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Obsidian Gruvbox', action: () => { current.theme = 'obsidian'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Cyberpunk Neon', action: () => { current.theme = 'cyberpunk'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Dracula', action: () => { current.theme = 'dracula'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Tokyo Night', action: () => { current.theme = 'tokyo'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Nord', action: () => { current.theme = 'nord'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Catppuccin', action: () => { current.theme = 'catppuccin'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Solarized Dark', action: () => { current.theme = 'solarized-dark'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Matrix Hacker', action: () => { current.theme = 'matrix'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
    { name: 'Theme: Monokai', action: () => { current.theme = 'monokai'; chrome.storage.sync.set({theme: current.theme}); applySettings(current); } },
  ];
  
  let selectedIdx = 0;
  
  const render = (query) => {
    list.innerHTML = '';
    const filtered = commands.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    if (selectedIdx >= filtered.length) selectedIdx = 0;
    
    filtered.forEach((c, idx) => {
      const li = document.createElement('li');
      li.textContent = c.name;
      if (idx === selectedIdx) li.className = 'selected';
      li.onmouseenter = () => { selectedIdx = idx; render(query); };
      li.onclick = () => { c.action(); toggleCommandPalette(); };
      list.appendChild(li);
    });
  };
  
  input.oninput = (e) => { selectedIdx = 0; render(e.target.value); };
  input.onkeydown = (e) => {
    if (e.key === 'Escape') toggleCommandPalette();
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedIdx++; render(input.value); }
    if (e.key === 'ArrowUp') { e.preventDefault(); selectedIdx = Math.max(0, selectedIdx - 1); render(input.value); }
    if (e.key === 'Enter') {
      const sel = list.querySelector('.selected');
      if (sel) sel.click();
    }
  };
  
  render('');
  input.focus();
}

// ── Image Lightbox ───────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (!current.enabled || !current.lightbox) return;
  if (e.target.tagName === 'IMG' && e.target.closest('.ProseMirror')) {
    e.preventDefault(); e.stopPropagation();
    if (lightboxEl) lightboxEl.remove();
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'wr-lightbox';
    lightboxEl.innerHTML = `
      <div class="wr-lightbox-bg"></div>
      <img src="${e.target.src}" />
    `;
    document.body.appendChild(lightboxEl);
    lightboxEl.onclick = () => { lightboxEl.remove(); lightboxEl = null; };
  }
});

// ── Keyboard Shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (!current.enabled) return;
  
  if (current.cmd && e.ctrlKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    toggleCommandPalette();
    return;
  }
  
  if (!current.hotkeys) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || e.target.closest('.ProseMirror')) return;
  
  if (e.altKey && e.key === '1') {
    e.preventDefault();
    const tabs = Array.from(document.querySelectorAll('button[role="tab"], #id-item-tabs button'));
    if (tabs.length > 0) tabs[0].click();
  } else if (e.altKey && e.key === '2') {
    e.preventDefault();
    const tabs = Array.from(document.querySelectorAll('button[role="tab"], #id-item-tabs button'));
    if (tabs.length > 1) tabs[1].click();
  } else if (e.altKey && e.key === '3') {
    e.preventDefault();
    const tabs = Array.from(document.querySelectorAll('button[role="tab"], #id-item-tabs button'));
    if (tabs.length > 2) tabs[2].click();
  } else if (e.altKey && e.key.toLowerCase() === 'q') {
    e.preventDefault();
    current.hideSidebar = !current.hideSidebar;
    applySettings(current);
    chrome.storage.sync.set({ hideSidebar: current.hideSidebar });
  } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    current.zen = !current.zen;
    applySettings(current);
    chrome.storage.sync.set({ zen: current.zen });
  }
});

// ── Sticky Media Player (Draggable) ──────────────────────────────────────────
function setupMediaObserver() {
  if (mediaObserver) { mediaObserver.disconnect(); mediaObserver = null; }
  document.querySelectorAll('.wr-floating-media').forEach(el => el.classList.remove('wr-floating-media'));

  if (!current.enabled || !current.media || getPage() !== 'item') return;

  setTimeout(() => {
    const players = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="vimeo.com"], video, audio');
    if (players.length === 0) return;

    const player = players[0].closest('div:has(> iframe), div:has(> video), .css-1xdkvt0') || players[0];
    
    mediaObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && entry.boundingClientRect.bottom < 100) {
          player.classList.add('wr-floating-media');
          makeDraggable(player);
        } else {
          player.classList.remove('wr-floating-media');
          player.style.transform = ''; // reset drag
        }
      });
    }, { threshold: [0, 0.1], rootMargin: "-80px 0px 0px 0px" });

    let anchor = player.previousElementSibling;
    if (!anchor || !anchor.classList.contains('wr-media-anchor')) {
      anchor = document.createElement('div');
      anchor.className = 'wr-media-anchor';
      player.parentNode.insertBefore(anchor, player);
    }
    mediaObserver.observe(anchor);
  }, 1000);
}

function makeDraggable(el) {
  let isDown = false;
  let startX, startY;
  
  el.onmousedown = (e) => {
    if (e.target.tagName === 'IFRAME') return; // let iframe handle its own clicks
    isDown = true;
    startX = e.clientX - (parseInt(el.style.left) || 0);
    startY = e.clientY - (parseInt(el.style.top) || 0);
    el.style.cursor = 'grabbing';
  };
  
  window.onmousemove = (e) => {
    if (!isDown) return;
    el.style.left = (e.clientX - startX) + 'px';
    el.style.top = (e.clientY - startY) + 'px';
    el.style.right = 'auto'; // override CSS right
    el.style.bottom = 'auto'; // override CSS bottom
  };
  
  window.onmouseup = () => {
    isDown = false;
    el.style.cursor = 'grab';
  };
}


// ── State Memory (Scroll & Tabs) ─────────────────────────────────────────────
function getMemoryKey(id) { return `wr-memory-${id}`; }

function saveState(scrollY) {
  const id = getItemId();
  if (!id || !current.enabled) return;
  const activeTabEl = document.querySelector('button[role="tab"][aria-selected="true"], #id-item-tabs button[aria-selected="true"]');
  const activeTab = activeTabEl ? activeTabEl.textContent.trim() : null;
  sessionStorage.setItem(getMemoryKey(id), JSON.stringify({ scroll: scrollY, tab: activeTab }));
}

window.addEventListener('scroll', (e) => {
  if (!current.enabled) return;
  let st = (e.target === document || e.target === window) ? (window.scrollY || document.documentElement.scrollTop) : (e.target.scrollTop || 0);
  if (e.target.tagName === 'PRE' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'CODE') return;
  
  lastScrollY = st;
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => { saveState(st); }, 100);
}, true);

document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('button[role="tab"], #id-item-tabs button');
  if (tabBtn) setTimeout(() => saveState(lastScrollY), 50);
});

function restoreState() {
  const id = getItemId();
  if (!id || !current.enabled) return;
  
  const stateStr = sessionStorage.getItem(getMemoryKey(id));
  if (!stateStr) return;
  
  try {
    const state = JSON.parse(stateStr);
    if (state.tab) {
      const tabs = Array.from(document.querySelectorAll('button[role="tab"], #id-item-tabs button'));
      const targetTab = tabs.find(t => t.textContent.trim() === state.tab);
      const activeTabEl = document.querySelector('button[role="tab"][aria-selected="true"], #id-item-tabs button[aria-selected="true"]');
      if (targetTab && activeTabEl && activeTabEl !== targetTab) targetTab.click();
    }
    
    if (state.scroll > 0) {
      clearInterval(restoreInterval);
      let attempts = 0;
      restoreInterval = setInterval(() => {
        attempts++;
        const scrollContainer = document.getElementById('navigation-scroll-container') || document.querySelector('main');
        const target = scrollContainer || window;
        target.scrollTo({ top: state.scroll, behavior: 'instant' });
        
        const currentScroll = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
        if (Math.abs(currentScroll - state.scroll) < 10 || attempts > 20) {
          clearInterval(restoreInterval);
        }
      }, 150);
    }
  } catch (e) {
    console.error('Wider Recall: Failed to restore state', e);
  }
}

// ── SPA Navigation Watcher ───────────────────────────────────────────────────
const injectHistoryInterceptor = () => {
  const script = document.createElement('script');
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
      window.addEventListener('popstate', () => { window.dispatchEvent(new Event('wr-locationchange')); });
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
};
injectHistoryInterceptor();

window.addEventListener('wr-locationchange', () => {
  if (current.enabled) {
    applySettings(current);
    setTimeout(restoreState, 150);
  }
});

const observer = new MutationObserver(() => {
  if (document.body && !document.body.hasAttribute('data-wr-page') && current.enabled) {
    applySettings(current);
    setTimeout(restoreState, 150);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
chrome.storage.sync.get(DEFAULTS, (opts) => {
  current = { ...DEFAULTS, ...opts };
  const init = () => {
    applySettings(current);
    if (current.enabled && document.body) {
      observer.observe(document.body, { childList: true, subtree: false });
      setTimeout(restoreState, 150);
      setTimeout(updateBionic, 500); // Wait for editor
    }
  };
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'WIDER_RECALL_UPDATE') return;
  applySettings(msg);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'WIDER_RECALL_GETPAGE') {
    const path = location.pathname;
    let page = 'Unknown page';
    if (path.includes('/item/'))              page = 'Item Detail';
    else if (path.includes('/spaced-repetition')) page = 'Spaced Repetition';
    else if (path === '/' || path === '')     page = 'Home / Grid';
    sendResponse({ page });
    return true;
  }
});
