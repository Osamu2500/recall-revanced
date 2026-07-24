'use strict';

/**
 * Wider Recall: Advanced Spaced Repetition Grid Controller
 * Intercepts the Material UI list view and generates a high-fidelity
 * interactive custom grid with virtualized updates and proxy-clicking.
 */

window.WR_PAGES.spaced = {
  observer: null,
  active: false,
  gridContainer: null,
  syncIndicator: null,
  syncIndicator: null,
  cardsData: new Map(), // Stores parsed card data
  orderedCardIds: [], // Stores original order of cards
  isQuestionsTab: false,
  
  injectCss() {
    if (document.getElementById('wr-spaced-repetition-css')) return;
    const style = document.createElement('style');
    style.id = 'wr-spaced-repetition-css';
    style.textContent = `
      /* Hide original card rows EXCEPT the expanded one */
      body[data-wr-grid="true"][data-wr-enabled="true"] .wr-original-row-card:not(.wr-expanded-original-row) {
        display: none !important;
      }

      /* Turn the original container into a fixed right drawer */
      body[data-wr-grid="true"][data-wr-enabled="true"] .wr-original-questions-table {
        position: fixed !important;
        top: 60px !important;
        right: 0 !important;
        width: 470px !important;
        height: calc(100vh - 60px) !important;
        background: var(--bg-panel, rgba(20, 20, 22, 0.95)) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        border-left: 1px solid rgba(255, 255, 255, 0.1) !important;
        z-index: 9999 !important;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
        display: block !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 0 !important;
      }

      /* Strip native borders and backgrounds from the nested inner containers inside the drawer to make it seamless */
      body[data-wr-grid="true"][data-wr-enabled="true"] .wr-original-questions-table .MuiPaper-root,
      body[data-wr-grid="true"][data-wr-enabled="true"] .wr-original-questions-table table {
        border: none !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      /* Open state */
      body[data-wr-grid="true"][data-wr-enabled="true"][data-wr-drawer-open="true"] .wr-original-questions-table {
        transform: translateX(0);
      }

      /* The question rows and active row will render natively as in the original UI */
      body[data-wr-grid="true"][data-wr-enabled="true"] .wr-custom-grid-container {
        display: grid;
        grid-template-columns: repeat(var(--wr-grid-cols, 3), 1fr) !important;
        gap: 20px;
        width: 100%;
        padding: 20px 0;
      }
      body[data-wr-grid="false"] .wr-custom-grid-container, body:not([data-wr-enabled="true"]) .wr-custom-grid-container {
        display: none !important;
      }
      
      /* Make parent containers span full width but reserve 470px on the right for the drawer ALWAYS */
      body[data-wr-grid="true"][data-wr-enabled="true"] .wr-main-container {
        max-width: none !important;
        padding-right: 470px !important; /* ALWAYS leave space for the right drawer */
      }
      
      .wr-grid-card {
        display: flex;
        flex-direction: column;
        background: var(--rp-glass-base, rgba(30, 30, 30, 0.6));
        border: 1px solid var(--rp-glass-border, rgba(255, 255, 255, 0.08));
        border-radius: 12px;
        overflow: hidden;
        position: relative;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        min-height: 220px;
        --mx: 50%;
        --my: 50%;
      }
      
      .wr-grid-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      }
      
      .wr-card-active {
        border-color: #8b5cf6 !important;
        box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3), 0 8px 24px rgba(0,0,0,0.3) !important;
        transform: translateY(-4px);
      }
      
      .wr-grid-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(800px circle at var(--mx) var(--my), rgba(255,255,255,0.06), transparent 40%);
        pointer-events: none;
        z-index: 2;
        opacity: 0;
        transition: opacity 0.3s;
      }
      
      .wr-grid-card:hover::before {
        opacity: 1;
      }
      
      .wr-custom-checkbox {
        position: absolute;
        top: 12px;
        left: 12px;
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 6px;
        background: rgba(0,0,0,0.5);
        z-index: 3;
        transition: 0.2s;
        cursor: pointer;
      }
      
      .wr-custom-checkbox.wr-checked {
        background: #8b5cf6;
        border-color: #8b5cf6;
      }
      
      .wr-custom-checkbox.wr-checked::after {
        content: '';
        position: absolute;
        left: 6px;
        top: 2px;
        width: 4px;
        height: 10px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }
      
      .wr-card-badge {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(0,0,0,0.6);
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        z-index: 3;
        backdrop-filter: blur(4px);
      }
      
      .wr-card-badge.wr-badge-empty {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
      }
      
      .wr-card-image-wrapper {
        width: 100%;
        height: 140px;
        position: relative;
        overflow: hidden;
      }
      
      .wr-card-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s;
      }
      
      .wr-grid-card:hover .wr-card-image {
        transform: scale(1.05);
      }
      
      .wr-card-content {
        padding: 16px;
        flex: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      
      .wr-card-title {
        flex: 1;
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        color: #fff;
      }

      .wr-card-dropdown-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: 0.2s;
        flex-shrink: 0;
      }
      
      .wr-card-dropdown-btn:hover {
        background: rgba(139, 92, 246, 0.8);
      }
      
      .wr-card-dropdown-btn svg {
        width: 16px;
        height: 16px;
        color: white;
      }
      
      .wr-card-active .wr-card-dropdown-btn {
        background: rgba(139, 92, 246, 1);
      }

      .wr-syncing-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(139, 92, 246, 0.9);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
        z-index: 9999;
      }
      
      .wr-syncing-indicator.show {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  },
  
  init() {
    this.injectCss();
    this.active = true;
    console.log('Wider Recall: Initialized Advanced Spaced Repetition Grid');
    
    // Create custom grid container
    this.gridContainer = document.createElement('div');
    this.gridContainer.className = 'wr-custom-grid-container';
    this.gridContainer.style.display = 'none';
    
    // Create sync indicator
    this.syncIndicator = document.createElement('div');
    this.syncIndicator.className = 'wr-syncing-indicator';
    this.syncIndicator.innerHTML = 'Syncing...';
    document.body.appendChild(this.syncIndicator);

    this.startObservation();
    
    // Periodic fallback check in case of SPA transitions missing mutations
    this._fallbackInterval = setInterval(() => {
      if (this.active) this.checkAndInject();
    }, 1000);
  },
  
  cleanup() {
    this.active = false;
    if (this.observer) this.observer.disconnect();
    if (this.gridContainer && this.gridContainer.parentNode) {
      this.gridContainer.parentNode.removeChild(this.gridContainer);
    }
    if (this.syncIndicator && this.syncIndicator.parentNode) {
      this.syncIndicator.parentNode.removeChild(this.syncIndicator);
    }
    if (this._fallbackInterval) {
      clearInterval(this._fallbackInterval);
    }
    
    this.restoreOriginalUI();
    
    console.log('Wider Recall: Cleaned up Spaced Repetition Grid');
  },

  startObservation() {
    if (this.observer) this.observer.disconnect();
    
    let debounceTimer;
    this.observer = new MutationObserver((mutations) => {
      if (!this.active) return;
      
      // Throttle heavy DOM extraction
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.checkAndInject(), 150);
    });

    const root = document.querySelector('main') || document.body;
    this.observer.observe(root, { childList: true, subtree: true, attributes: false });
  },

  restoreOriginalUI() {
    if (this.gridContainer) {
      this.gridContainer.style.display = 'none';
    }
    document.querySelectorAll('.wr-original-questions-table').forEach(el => {
      el.classList.remove('wr-original-questions-table');
    });
    document.querySelectorAll('.wr-main-container').forEach(el => {
      el.classList.remove('wr-main-container');
    });
    document.querySelectorAll('.wr-original-row-card, .wr-original-row-question, .wr-expanded-original-row').forEach(el => {
      el.classList.remove('wr-original-row-card', 'wr-original-row-question', 'wr-expanded-original-row');
    });
    document.body.removeAttribute('data-wr-drawer-open');
  },

  checkAndInject() {
    if (!this.active || window.location.pathname !== '/spaced-repetition') return;

    // Check if the grid feature is explicitly toggled ON
    const isGridEnabled = document.body.getAttribute('data-wr-grid') === 'true' && document.body.getAttribute('data-wr-enabled') === 'true';
    if (!isGridEnabled) {
      this.restoreOriginalUI();
      return;
    }

    // The Review tab is a single flashcard. The Questions tab is a list of items.
    // If we see multiple checkboxes, we are almost certainly on the Questions tab.
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    this.isQuestionsTab = checkboxes.length > 3;
    
    // Check again before injecting to prevent race conditions
    if (this.isQuestionsTab) {
      this.extractAndRenderGrid();
    } else {
      this.restoreOriginalUI();
    }
  },

  findListContainerAndRows() {
    const allCbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    if (allCbs.length < 2) return { container: null, rows: [] };

    // Group checkboxes by their common container
    // The true list container will have multiple direct children (the rows), each containing a checkbox.
    let bestContainer = null;
    let maxRows = 0;
    
    // Check all ancestors of all checkboxes
    const candidates = new Set();
    allCbs.forEach(cb => {
      let p = cb.parentElement;
      while (p && p !== document.body) {
        candidates.add(p);
        p = p.parentElement;
      }
    });

    // Find the container with the most checkbox-containing children
    for (let container of candidates) {
      let rowCount = 0;
      for (let child of container.children) {
        if (child.querySelector('input[type="checkbox"]') || (child.tagName === 'INPUT' && child.type === 'checkbox')) {
          rowCount++;
        }
      }
      if (rowCount > maxRows) {
        maxRows = rowCount;
        bestContainer = container;
      }
    }

    if (!bestContainer || maxRows < 2) {
      return { container: null, rows: [] };
    }

    // The rows are the children that contain a checkbox
    const rows = Array.from(bestContainer.children).filter(child => {
      return child.querySelector('input[type="checkbox"]') || (child.tagName === 'INPUT' && child.type === 'checkbox');
    });
    
    // Find a good wrapper to apply the drawer styling to
    let wrapper = bestContainer;
    
    // If it's inside a standard table, grab the table or its container
    const table = bestContainer.closest('table, [role="table"], .MuiTable-root');
    if (table) {
      wrapper = table.closest('.MuiTableContainer-root') || table;
    } else {
      // For div-based lists, the parent of the row container is usually the scrollable wrapper
      const parent = bestContainer.parentElement;
      if (parent && parent !== document.body && parent.tagName !== 'MAIN') {
         wrapper = parent;
      }
    }

    return { container: wrapper, rows: rows };
  },

  findOriginalTable() {
    const res = this.findListContainerAndRows();
    return res.container;
  },

  extractAndRenderGrid() {
    const { container: originalTable, rows } = this.findListContainerAndRows();
    
    if (!originalTable || rows.length === 0) {
      console.log(`[WIDER RECALL GRID] Could not find original table or rows.`);
      this.restoreOriginalUI();
      return;
    }
    
    console.log(`[WIDER RECALL GRID] Found originalTable, extracted ${rows.length} rows`);

    if (rows.length === 0) return;

    // Hide original table visually
    originalTable.classList.add('wr-original-questions-table');
    
    // Add custom class to the main content container to stretch it safely without breaking sidebar
    const mainContainer = originalTable.closest('.MuiContainer-root, .MuiContainer-maxWidthMd, .MuiContainer-maxWidthLg');
    if (mainContainer) {
      mainContainer.classList.add('wr-main-container');
    }

    // Attach our custom grid as a sibling to the original table if not attached
    if (this.gridContainer.parentNode !== originalTable.parentNode) {
      originalTable.parentNode.insertBefore(this.gridContainer, originalTable.nextSibling);
    }
    
    this.gridContainer.style.display = 'grid';

    // Parse Data
    const newCardsData = new Map();
    let index = 0;
    
    let currentCardId = null;
    let hasQuestions = false;
    this.activeExpandedCardId = null;

    rows.forEach(row => {
      // Skip header rows if they snuck in
      if (row.querySelector('th') || (row.textContent && row.textContent.toUpperCase().includes('QUESTIONS') && row.textContent.toUpperCase().includes('CARD') && !row.querySelector('img'))) return; 
      
      const isCard = !!row.querySelector('img');

      if (isCard) {
        const cardData = this.parseRow(row, index++);
        if (cardData) {
          row.setAttribute('data-wr-proxy-id', cardData.id);
          row.classList.add('wr-original-row-card');
          row.classList.remove('wr-original-row-question');
          row.classList.remove('wr-expanded-original-row');
          currentCardId = cardData.id;
          newCardsData.set(cardData.id, cardData);
        }
      } else {
        row.classList.add('wr-original-row-question');
        row.classList.remove('wr-original-row-card');
        hasQuestions = true;
        if (currentCardId) {
          this.activeExpandedCardId = currentCardId;
          const activeRow = row.parentNode.querySelector(`[data-wr-proxy-id="${currentCardId}"]`);
          if (activeRow) activeRow.classList.add('wr-expanded-original-row');
        }
      }
    });

    if (hasQuestions) {
      document.body.setAttribute('data-wr-drawer-open', 'true');
      // Merge with previous data because React removed the other cards from the DOM
      for (let [id, oldCard] of this.cardsData.entries()) {
        if (!newCardsData.has(id)) {
          newCardsData.set(id, oldCard);
        }
      }
    } else {
      document.body.setAttribute('data-wr-drawer-open', 'false');
      // If we are in the full list, update the ordering
      if (newCardsData.size > 1) {
        this.orderedCardIds = Array.from(newCardsData.keys());
      }
    }

    // Check for changes to avoid useless re-renders
    const currentKeys = Array.from(this.cardsData.keys()).join(',');
    const newKeys = Array.from(newCardsData.keys()).join(',');
    
    let needsUpdate = currentKeys !== newKeys;
    
    if (!needsUpdate) {
      for (let [id, newCard] of newCardsData.entries()) {
        const oldCard = this.cardsData.get(id);
        if (!oldCard || oldCard.checked !== newCard.checked || oldCard.questionCount !== newCard.questionCount) {
          needsUpdate = true;
          break;
        }
      }
    }

    if (needsUpdate) {
      this.cardsData = newCardsData;
      this.renderGrid();
    }
  },

  parseRow(row, fallbackIndex) {
    try {
      // 1. Image
      const imgEl = row.querySelector('img');
      const imgUrl = imgEl ? imgEl.src : 'https://placehold.co/600x400/12121c/3a3a4c?text=No+Thumbnail';

      // 2. Title & Question Count
      let title = "Unknown Card";
      let qCountText = "0 questions";
      
      // Look at all text nodes or elements with text
      const textElements = Array.from(row.querySelectorAll('p, span, div')).filter(el => el.children.length === 0 && el.textContent.trim().length > 0);
      
      for (let el of textElements) {
        const text = el.textContent.trim();
        if (text.toLowerCase().includes('question')) {
          qCountText = text;
        } else if (text.length > 5 && text !== title && !text.match(/^[0-9]+$/)) {
          // Usually the longest string is the title
          if (text.length > title.length || title === "Unknown Card") {
             title = text;
          }
        }
      }

      // 3. ID
      const safeTitle = title === "Unknown Card" ? `idx-${fallbackIndex}` : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
      const id = `wr-card-${safeTitle}`;

      // 4. Checkbox
      const checkboxInput = row.querySelector('input[type="checkbox"]');
      const isChecked = checkboxInput ? checkboxInput.checked : false;

      return {
        id: id,
        image: imgUrl,
        title: title,
        questionCount: qCountText,
        checked: isChecked,
        rowElement: row
      };
    } catch (e) {
      console.warn("Wider Recall: Failed to parse row", e);
      return null;
    }
  },

  renderGrid() {
    this.gridContainer.innerHTML = '';
    
    if (this.cardsData.size === 0) {
      this.gridContainer.innerHTML = `
        <div class="wr-grid-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
          No cards found for spaced repetition.
        </div>
      `;
      return;
    }

    let delay = 0;
    
    const renderedIds = new Set();
    const idsToRender = [];
    if (this.orderedCardIds) {
      for (let id of this.orderedCardIds) {
        if (this.cardsData.has(id)) {
          idsToRender.push(id);
          renderedIds.add(id);
        }
      }
    }
    for (let id of this.cardsData.keys()) {
      if (!renderedIds.has(id)) {
        idsToRender.push(id);
      }
    }

    for (let id of idsToRender) {
      const card = this.cardsData.get(id);
      const cardEl = this.createCardElement(card, delay);
      this.gridContainer.appendChild(cardEl);
      delay += 30; // Staggered entrance
    }
  },

  createCardElement(card, delayMs) {
    const el = document.createElement('div');
    const isActive = card.id === this.activeExpandedCardId;
    el.className = `wr-grid-card ${card.checked ? 'wr-selected' : ''} ${isActive ? 'wr-card-active' : ''}`;
    el.setAttribute('data-proxy-id', card.id);
    el.style.animationDelay = `${delayMs}ms`;

    const qNumberMatch = card.questionCount.match(/\d+/);
    const qCountNum = qNumberMatch ? parseInt(qNumberMatch[0]) : 0;
    const badgeClass = qCountNum === 0 ? 'wr-badge-empty' : '';

    el.innerHTML = `
      <div class="wr-custom-checkbox ${card.checked ? 'wr-checked' : ''}" data-action="toggle"></div>
      
      <div class="wr-card-badge ${badgeClass}">
        ${card.questionCount}
      </div>

      <div class="wr-card-image-wrapper" data-action="navigate">
        <img src="${card.image}" class="wr-card-image" loading="lazy" />
      </div>

      <div class="wr-card-content" data-action="navigate">
        <h3 class="wr-card-title">${card.title}</h3>
        <div class="wr-card-dropdown-btn" data-action="expand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path></svg>
        </div>
      </div>
    `;

    // Add Spotlight Effect Tracking
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--mx', `${x}%`);
      el.style.setProperty('--my', `${y}%`);
    });

    el.addEventListener('mouseleave', () => {
      el.style.setProperty('--mx', '50%');
      el.style.setProperty('--my', '50%');
    });

    // Handle Clicks via Event Delegation
    el.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const action = actionEl.getAttribute('data-action');
      if (action === 'toggle') {
        this.proxyCheckboxClick(card);
      } else if (action === 'navigate') {
        this.proxyRowClick(card);
      } else if (action === 'expand') {
        this.proxyExpandClick(card);
      }
    });

    return el;
  },

  executeOnCard(card, actionCallback) {
    if (document.body.contains(card.rowElement)) {
      actionCallback(card.rowElement);
      return;
    }
    
    // The card is detached because another card is expanded! 
    this.showSyncIndicator();
    if (this.activeExpandedCardId) {
      const activeCard = this.cardsData.get(this.activeExpandedCardId);
      if (activeCard && document.body.contains(activeCard.rowElement)) {
        const activeChevron = activeCard.rowElement.querySelector('svg.lucide-chevron-right, svg.lucide-chevron-down, .lucide-chevron-right, .lucide-chevron-down');
        if (activeChevron) {
          activeChevron.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      }
    }
    
    // Poll to find the new row element when React re-renders the full list
    let attempts = 0;
    const findRowInterval = setInterval(() => {
      attempts++;
      const newRows = Array.from(document.querySelectorAll('tr, [role="row"], .wr-original-row-card'));
      for (let row of newRows) {
        if (row.textContent.includes(card.title) && !!row.querySelector('img')) {
          clearInterval(findRowInterval);
          card.rowElement = row;
          actionCallback(row);
          return;
        }
      }
      
      if (attempts >= 15) { // Stop after ~750ms
        clearInterval(findRowInterval);
        console.warn("Wider Recall: Could not find row for card after collapse", card.title);
      }
    }, 50);
  },

  proxyCheckboxClick(card) {
    this.executeOnCard(card, (rowElement) => {
      const originalCheckbox = rowElement.querySelector('input[type="checkbox"]');
      if (originalCheckbox) {
        // React 16+ intercepts native setters. We must bypass it to trigger onChange programmatically.
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(originalCheckbox, !originalCheckbox.checked);
          originalCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          originalCheckbox.click();
        }
      }
    });
    
    // Optimistic UI Update (always runs immediately for responsiveness)
    card.checked = !card.checked;
    this.updateCardDOMState(card.id, card.checked);
  },

  proxyRowClick(card) {
    this.executeOnCard(card, (rowElement) => {
      const textElements = rowElement.querySelectorAll('p, span');
      let targetEl = null;
      for (let el of textElements) {
        if (el.textContent === card.title) {
          targetEl = el;
          break;
        }
      }
      if (targetEl) {
        targetEl.click();
      } else {
        rowElement.click();
      }
    });
  },

  proxyExpandClick(card) {
    this.executeOnCard(card, (rowElement) => {
      const chevronSvg = rowElement.querySelector('svg.lucide-chevron-right, svg.lucide-chevron-down, .lucide-chevron-right, .lucide-chevron-down');
      if (chevronSvg) {
        chevronSvg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      } else {
        console.warn("Wider Recall: Could not find chevron SVG to click!");
        rowElement.click();
      }
    });
  },

  updateCardDOMState(id, isChecked) {
    // Fast path to update visual state without full re-render
    const cardNodes = this.gridContainer.querySelectorAll('.wr-grid-card');
    // We know order matches, but we can search or rely on index
    // For safety, let's just trigger a re-extract loop quickly
    setTimeout(() => this.checkAndInject(), 50);
  },
  
  showSyncIndicator() {
    this.syncIndicator.classList.add('wr-visible');
    clearTimeout(this._syncTimeout);
    this._syncTimeout = setTimeout(() => {
      this.syncIndicator.classList.remove('wr-visible');
    }, 800);
  }
};
