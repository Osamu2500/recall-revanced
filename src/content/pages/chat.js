'use strict';

/**
 * @fileoverview Wider Recall - Chat Page Module
 * Implements multi-select capability for chat history in the sidebar,
 * allowing bulk Pin, Rename, and Delete actions.
 */

window.WR_ChatMultiSelect = {
  selectedChats: new Set(),
  observer: null,
  
  init() {
    console.log('[WR] Initializing Chat Multi-Select');
    this.selectedChats.clear();
    this.setupObserver();
    this.injectBulkBar();
    this.scanForChats();
  },

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.selectedChats.clear();
    const bar = document.getElementById('wr-chat-bulk-bar');
    if (bar) bar.remove();
    
    // Remove injected checkboxes and attributes
    document.querySelectorAll('.wr-chat-checkbox').forEach(cb => cb.remove());
    document.querySelectorAll('[data-wr-multi-select-init]').forEach(el => {
      el.removeAttribute('data-wr-multi-select-init');
      el.classList.remove('wr-chat-selected');
    });
  },

  setupObserver() {
    this.observer = new MutationObserver(() => {
      if (this._scanTimeout) clearTimeout(this._scanTimeout);
      this._scanTimeout = setTimeout(() => this.scanForChats(), 250);
    });
    
    // Observe body because React might remount the entire sidebar <nav>
    if (document.body) {
      this.observer.observe(document.body, { childList: true, subtree: true });
    }
  },

  scanForChats() {
    // Check if feature is disabled
    if (window.WR_STATE && window.WR_STATE.chatMultiSelect === false) {
       document.querySelectorAll('.wr-chat-checkbox-wrap').forEach(el => el.remove());
       this.selectedChats.clear();
       this.updateBulkBar();
       return;
    }

    // Find all links that point to a specific chat inside the sidebar only
    const allLinks = Array.from(document.querySelectorAll('nav a[href*="/chat/"]'));
    
    // Filter to likely chat rows
    const chatLinks = allLinks.filter(el => {
      // Skip if the href doesn't have an ID (e.g. exactly /chat or /chat/)
      const href = el.getAttribute('href') || '';
      if (href === '/chat' || href === '/chat/') return false;
      // Skip the "New chat" button at the very top (usually has no ID in href)
      return true;
    });

    if (chatLinks.length === 0) return;
    
    chatLinks.forEach(link => {
      const row = link.closest('div, li') || link;
      if (row.hasAttribute('data-wr-multi-select-init')) return;
      
      row.setAttribute('data-wr-multi-select-init', 'true');
      
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'wr-chat-checkbox';
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', (e) => {
        this.toggleSelection(row, link, cb.checked);
      });
      
      row.style.position = 'relative';
      if (row.firstChild) {
        row.insertBefore(cb, row.firstChild);
      } else {
        row.appendChild(cb);
      }
      
      const id = link.getAttribute('href');
      if (this.selectedChats.has(id)) {
        cb.checked = true;
        row.classList.add('wr-chat-selected');
      }
    });
  },

  toggleSelection(rowElement, linkElement, isSelected) {
    const id = linkElement.getAttribute('href');
    if (!id) return;

    if (isSelected) {
      this.selectedChats.add(id);
      rowElement.classList.add('wr-chat-selected');
    } else {
      this.selectedChats.delete(id);
      rowElement.classList.remove('wr-chat-selected');
    }

    this.updateBulkBar();
  },

  updateBulkBar() {
    let bar = document.getElementById('wr-chat-bulk-bar');
    if (!bar) {
      this.injectBulkBar();
      bar = document.getElementById('wr-chat-bulk-bar');
    }
    if (!bar) return;

    const count = this.selectedChats.size;
    if (count > 0) {
      bar.classList.add('wr-bulk-bar-visible');
      bar.querySelector('.wr-bulk-count').textContent = `${count} chat${count !== 1 ? 's' : ''} selected`;
      
      const allLinksCount = Array.from(document.querySelectorAll('nav a[href*="/chat/"]')).filter(el => {
          const href = el.getAttribute('href') || '';
          return href !== '/chat' && href !== '/chat/';
      }).length;
      
      const selectBtn = bar.querySelector('[data-action="select-all"], [data-action="deselect-all"]');
      if (selectBtn) {
          if (count >= allLinksCount && allLinksCount > 0) {
              selectBtn.textContent = 'Deselect All';
              selectBtn.setAttribute('data-action', 'deselect-all');
          } else {
              selectBtn.textContent = 'Select All';
              selectBtn.setAttribute('data-action', 'select-all');
          }
      }
    } else {
      bar.classList.remove('wr-bulk-bar-visible');
    }
  },

  injectBulkBar() {
    if (document.getElementById('wr-chat-bulk-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'wr-chat-bulk-bar';
    bar.className = 'wr-chat-bulk-bar';
    bar.innerHTML = `
      <div class="wr-bulk-count">0 chats selected</div>
      <div class="wr-bulk-actions">
        <button class="wr-bulk-btn" data-action="select-all">Select All</button>
        <button class="wr-bulk-btn wr-bulk-btn-danger" data-action="delete">Delete</button>
      </div>
    `;

    document.body.appendChild(bar);

    bar.querySelectorAll('.wr-bulk-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = e.target.getAttribute('data-action');
        if (action === 'select-all') {
            this.selectAllChats(true);
        } else if (action === 'deselect-all') {
            this.selectAllChats(false);
        } else {
            this.performBulkAction(action);
        }
      });
    });
  },

  selectAllChats(select) {
      const allLinks = Array.from(document.querySelectorAll('nav a[href*="/chat/"]')).filter(el => {
          const href = el.getAttribute('href') || '';
          if (href === '/chat' || href === '/chat/') return false;
          return true;
      });
      
      allLinks.forEach(link => {
          const row = link.closest('div, li') || link;
          const cb = row.querySelector('.wr-chat-checkbox');
          if (cb) {
              if (select && !cb.checked) {
                  cb.checked = true;
                  this.toggleSelection(row, link, true);
              } else if (!select && cb.checked) {
                  cb.checked = false;
                  this.toggleSelection(row, link, false);
              }
          }
      });
  },

  ghostHover(el) {
      if (!el) return;
      for (const evt of ['pointerenter', 'mouseover', 'mouseenter', 'mousemove']) {
          el.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
      }
  },

  ghostClick(el) {
      if (!el) return false;
      
      // A standard native click sequence is perfectly reliable in React 17+ 
      // as long as bubbles is true. Doing .click() AND dispatchEvent can cause a double-click
      // which instantly closes the popup menu we are trying to open!
      el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      
      return true;
  },

  async performBulkAction(action) {
    if (action !== 'delete') return;
    
    const chatIds = Array.from(this.selectedChats);
    if (chatIds.length === 0) return;

    console.log(`[WR] Performing bulk action: ${action} on ${chatIds.length} chats`);
    const successfulIds = [];

    for (const id of chatIds) {
      const link = document.querySelector(`a[href="${id}"]`);
      if (!link) continue;
      
      const row = link.closest('div, li') || link;
      
      // Simulate ghost hover
      this.ghostHover(link);
      this.ghostHover(row);
      
      await new Promise(r => setTimeout(r, 200));

      // Try to find the 3-dot menu button
      const buttons = Array.from(row.querySelectorAll('button, [role="button"], [aria-haspopup]'));
      const menuBtnCandidates = buttons.filter(b => {
          if (b === link || link.contains(b)) return false;
          if (b.textContent.trim().length > 5) return false;
          return true;
      });
      let menuBtn = menuBtnCandidates[menuBtnCandidates.length - 1];

      // Fallback to SVG
      if (!menuBtn) {
          const svgs = Array.from(row.querySelectorAll('svg'));
          if (svgs.length > 1) {
              const svg = svgs[svgs.length - 1];
              menuBtn = svg.closest('button, [role="button"]') || svg;
          }
      }

      if (menuBtn) {
        this.ghostClick(menuBtn);
      } else {
        link.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 0, clientY: 0 }));
      }
      
      await new Promise(r => setTimeout(r, 250));

      // Find "Delete" in the newly appeared menu
      const allElements = Array.from(document.querySelectorAll('button, [role="menuitem"], li, a, div, span'));
      allElements.reverse();
      
      const targetItem = allElements.find(item => {
         // Must not be a huge container
         if (item.children.length > 3) return false;
         
         const text = item.textContent.trim().toLowerCase();
         if (text === 'delete' || text === 'delete chat') {
             // Strict visibility check
             const rect = item.getBoundingClientRect();
             if (rect.width > 0 && rect.height > 0) return true;
         }
         return false;
      });

      if (targetItem) {
        // Ensure we click the interactive wrapper, not just the text span
        const clickTarget = targetItem.closest('button, [role="menuitem"], li, a') || targetItem;
        this.ghostClick(clickTarget);
        
        // We found the menu item and clicked it, so assume success
        successfulIds.push(id);
        
        // Wait for potential modal/dialog to appear
        await new Promise(r => setTimeout(r, 400));

        // Find Confirmation button
        const allDialogBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
        allDialogBtns.reverse();
        const confirmBtn = allDialogBtns.find(b => {
            const text = b.textContent.trim().toLowerCase();
            if (text === 'delete' || text === 'confirm' || text === 'yes' || text === 'delete chat') {
                const rect = b.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            }
            return false;
        });
        
        if (confirmBtn) {
            this.ghostClick(confirmBtn);
            await new Promise(r => setTimeout(r, 400));
        } else {
            console.log("[WR] Confirm button not found (might not require confirmation)");
        }
      } else {
        // Dismiss menu
        const backdrop = document.querySelector('.MuiBackdrop-root, [role="presentation"]');
        if (backdrop) this.ghostClick(backdrop);
        else this.ghostClick(document.body);
      }

      // Cleanup hover
      const outEvent = new MouseEvent('mouseout', { bubbles: true });
      const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
      link.dispatchEvent(outEvent);
      row.dispatchEvent(outEvent);
      link.dispatchEvent(leaveEvent);
      row.dispatchEvent(leaveEvent);
    }

    // Clear selection ONLY for successful items
    successfulIds.forEach(id => {
       this.selectedChats.delete(id);
       const link = document.querySelector(`a[href="${id}"]`);
       if (link) {
           const cb = link.closest('div, li')?.querySelector('.wr-chat-checkbox');
           if (cb) cb.checked = false;
           link.closest('div, li')?.classList.remove('wr-chat-selected');
       }
    });
    this.updateBulkBar();
  }
};

window.WR_PAGES.chat = {
  _active: false,

  init() {
    this._active = true;
    console.log('[WR] Chat Page initialized');
    window.WR_ChatMultiSelect.init();
  },
  
  cleanup() {
    this._active = false;
    console.log('[WR] Chat Page cleaned up');
    window.WR_ChatMultiSelect.cleanup();
  }
};
