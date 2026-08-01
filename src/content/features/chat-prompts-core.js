// src/content/features/chat-prompts-core.js
(function() {
  if (window.PromptLibraryUI) return; // Prevent double injection

  window.PromptLibraryUI = class PromptLibraryUI {
    constructor() {
      this.STORAGE_KEY = 'wr_custom_prompts_v2';
      this.OLD_STORAGE_KEY = 'wr_custom_prompts';
      this.promptsData = [];
      this.categories = [];
      this.searchQuery = "";
      this.popovers = new Set();
      this.draggedItem = null;
    }

    // --- State Management ---
    loadPrompts(callback) {
      chrome.storage.local.get([this.STORAGE_KEY, this.OLD_STORAGE_KEY], (result) => {
        if (result[this.STORAGE_KEY]) {
          this.promptsData = result[this.STORAGE_KEY];
        } else if (result[this.OLD_STORAGE_KEY]) {
          // Migration from old flat array to v2 structure
          this.promptsData = result[this.OLD_STORAGE_KEY].map((text, i) => ({
            id: 'prompt_' + Date.now() + '_' + i,
            text: text,
            category: 'General',
            order: i
          }));
          this.savePrompts();
        } else {
          // Defaults
          this.promptsData = [
            { id: 'p1', text: 'Summarize this in 3 bullet points.', category: 'Summarization', order: 0 },
            { id: 'p2', text: 'Explain this like I am [age].', category: 'Learning', order: 1 },
            { id: 'p3', text: 'Extract the key action items.', category: 'Productivity', order: 2 }
          ];
        }
        this.updateCategories();
        if (callback) callback();
      });
    }

    savePrompts() {
      // Re-order by index inside category
      this.promptsData.forEach((p, i) => p.order = i);
      chrome.storage.local.set({ [this.STORAGE_KEY]: this.promptsData });
      this.updateCategories();
    }

    updateCategories() {
      const cats = new Set(this.promptsData.map(p => p.category));
      this.categories = Array.from(cats).sort();
      if (!this.categories.includes('General')) this.categories.unshift('General');
    }

    // --- DOM Injection Logic ---
    injectText(editorElement, text) {
      editorElement.focus();
      
      // If there is a variable placeholder like [something]
      const varRegex = /\[(.*?)\]/;
      const match = text.match(varRegex);
      
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer, bubbles: true, cancelable: true
      });
      editorElement.dispatchEvent(pasteEvent);

      // If we find a variable placeholder, wait for render and select it (if possible natively)
      // Usually, selecting text in a contenteditable requires Window.getSelection()
      if (match) {
        setTimeout(() => {
          this.highlightTextInEditor(editorElement, match[0]);
        }, 50);
      }
    }

    highlightTextInEditor(editorElement, textToFind) {
      // Basic approach to highlight the first instance of textToFind
      const sel = window.getSelection();
      // Only works reliably if we can traverse text nodes. Since React Slate handles its own selection,
      // it might overwrite this, but it's a good effort fallback.
      const findTextNode = (node) => {
        if (node.nodeType === 3 && node.textContent.includes(textToFind)) return node;
        for (let child of node.childNodes) {
          const res = findTextNode(child);
          if (res) return res;
        }
        return null;
      };
      const textNode = findTextNode(editorElement);
      if (textNode) {
        const range = document.createRange();
        const start = textNode.textContent.indexOf(textToFind);
        range.setStart(textNode, start);
        range.setEnd(textNode, start + textToFind.length);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    // --- Import / Export ---
    exportPrompts() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.promptsData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "recall_prompts.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }

    importPrompts() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
          try {
            const imported = JSON.parse(event.target.result);
            if (Array.isArray(imported)) {
              // Merge
              const currentIds = new Set(this.promptsData.map(p => p.id));
              imported.forEach(p => {
                if (!currentIds.has(p.id)) this.promptsData.push(p);
              });
              this.savePrompts();
              this.renderAllPopovers();
            }
          } catch (err) {
            console.error("Failed to parse prompt JSON", err);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }

    // --- UI Rendering ---
    createPopover(chatInput) {
      const popover = document.createElement('div');
      popover.className = 'wr-prompts-popover wr-prompts-pro';
      popover.style.display = 'none';
      popover.chatInput = chatInput;
      this.popovers.add(popover);
      this.renderPopoverContent(popover);
      document.body.appendChild(popover);
      return popover;
    }

    renderAllPopovers() {
      this.popovers.forEach(p => this.renderPopoverContent(p));
    }

    renderPopoverContent(popover) {
      popover.innerHTML = '';
      
      // Header
      const header = document.createElement('div');
      header.className = 'wr-prompts-header';
      header.innerHTML = `
        <span>Prompt Library</span>
        <div class="wr-prompts-actions">
          <button class="wr-btn-icon" id="wr-export-btn" title="Export JSON">📤</button>
          <button class="wr-btn-icon" id="wr-import-btn" title="Import JSON">📥</button>
        </div>
      `;
      popover.appendChild(header);
      
      header.querySelector('#wr-export-btn').onclick = () => this.exportPrompts();
      header.querySelector('#wr-import-btn').onclick = () => this.importPrompts();

      // Search Bar
      const searchRow = document.createElement('div');
      searchRow.className = 'wr-prompts-search-row';
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search prompts...';
      searchInput.className = 'wr-prompts-search-input';
      searchInput.value = this.searchQuery;
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderAllPopovers();
      };
      searchRow.appendChild(searchInput);
      popover.appendChild(searchRow);

      // List container
      const list = document.createElement('div');
      list.className = 'wr-prompts-list';

      const filtered = this.promptsData.filter(p => p.text.toLowerCase().includes(this.searchQuery) || p.category.toLowerCase().includes(this.searchQuery));

      // Group by category
      const grouped = {};
      this.categories.forEach(c => grouped[c] = []);
      filtered.forEach(p => {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
      });

      Object.keys(grouped).forEach(cat => {
        if (grouped[cat].length === 0 && this.searchQuery) return; // Hide empty cats while searching

        const catHeader = document.createElement('div');
        catHeader.className = 'wr-prompts-cat-header';
        catHeader.textContent = cat;
        catHeader.dataset.category = cat;
        
        // Setup Drag & Drop for category header (Drop target)
        catHeader.ondragover = (e) => e.preventDefault();
        catHeader.ondrop = (e) => this.handleDrop(e, cat);
        list.appendChild(catHeader);

        grouped[cat].sort((a, b) => a.order - b.order).forEach(prompt => {
          const item = document.createElement('div');
          item.className = 'wr-prompt-item';
          item.draggable = true;
          item.dataset.id = prompt.id;
          
          item.ondragstart = (e) => {
            this.draggedItem = prompt;
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('dragging');
          };
          item.ondragend = () => {
            this.draggedItem = null;
            item.classList.remove('dragging');
          };
          item.ondragover = (e) => {
            e.preventDefault();
            item.classList.add('drag-over');
          };
          item.ondragleave = () => item.classList.remove('drag-over');
          item.ondrop = (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            this.handleDrop(e, cat, prompt.id);
          };

          const textSpan = document.createElement('span');
          textSpan.className = 'wr-prompt-text';
          // Highlight variables visually
          textSpan.innerHTML = prompt.text.replace(/\[(.*?)\]/g, '<span class="wr-prompt-var">[$1]</span>');
          textSpan.onclick = () => {
            this.injectText(popover.chatInput, prompt.text);
            popover.style.display = 'none';
          };

          const delBtn = document.createElement('button');
          delBtn.className = 'wr-prompt-del';
          delBtn.innerHTML = '×';
          delBtn.onclick = (e) => {
            e.stopPropagation();
            this.promptsData = this.promptsData.filter(p => p.id !== prompt.id);
            this.savePrompts();
            this.renderAllPopovers();
          };

          item.appendChild(textSpan);
          item.appendChild(delBtn);
          list.appendChild(item);
        });
      });
      popover.appendChild(list);

      // Add new row
      const addRow = document.createElement('div');
      addRow.className = 'wr-prompts-add-row';
      
      const catSelect = document.createElement('select');
      catSelect.className = 'wr-prompts-cat-select';
      this.categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        catSelect.appendChild(opt);
      });
      
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'New prompt...';
      input.className = 'wr-prompts-input';
      
      const addBtn = document.createElement('button');
      addBtn.className = 'wr-prompts-add-btn';
      addBtn.textContent = '+';
      addBtn.onclick = () => {
        const val = input.value.trim();
        if (val) {
          let category = catSelect.value;
          // Support fast category creation via "Cat: text" format
          if (val.includes(':') && val.split(':')[0].length < 15) {
            const parts = val.split(':');
            category = parts[0].trim();
            input.value = parts.slice(1).join(':').trim();
          }
          this.promptsData.push({
            id: 'prompt_' + Date.now(),
            text: input.value.trim() || val,
            category: category,
            order: this.promptsData.length
          });
          this.savePrompts();
          this.renderAllPopovers();
        }
      };
      
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addBtn.click();
      });

      addRow.appendChild(catSelect);
      addRow.appendChild(input);
      addRow.appendChild(addBtn);
      popover.appendChild(addRow);
      
      // Maintain focus if typing
      if (popover.style.display === 'flex') {
        const activeInput = popover.querySelector('.wr-prompts-search-input');
        if (activeInput && this.searchQuery) activeInput.focus();
      }
    }

    handleDrop(e, targetCategory, targetPromptId = null) {
      if (!this.draggedItem) return;
      
      const draggedId = this.draggedItem.id;
      if (draggedId === targetPromptId) return;

      const draggedIndex = this.promptsData.findIndex(p => p.id === draggedId);
      const targetIndex = targetPromptId ? this.promptsData.findIndex(p => p.id === targetPromptId) : -1;

      // Update category
      this.promptsData[draggedIndex].category = targetCategory;

      // Reorder array
      const item = this.promptsData.splice(draggedIndex, 1)[0];
      if (targetIndex === -1) {
        // Appended to category
        this.promptsData.push(item);
      } else {
        // Insert at target index
        const insertAt = draggedIndex < targetIndex ? targetIndex : targetIndex;
        this.promptsData.splice(insertAt, 0, item);
      }
      
      this.savePrompts();
      this.renderAllPopovers();
    }

    // --- Trigger Button Logic ---
    createTriggerButton() {
      const btn = document.createElement('button');
      btn.className = 'wr-prompts-btn';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M12 7v6"></path><path d="M9 10h6"></path></svg> <span>Prompts</span>`;
      return btn;
    }

    bindPopoverToButton(btn, popover) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Close others
        this.popovers.forEach(p => { if (p !== popover) p.style.display = 'none'; });

        if (popover.style.display === 'none') {
          this.loadPrompts(() => {
            this.renderPopoverContent(popover);
            
            popover.style.visibility = 'hidden';
            popover.style.display = 'flex';
            
            // Positioning
            const popoverHeight = popover.offsetHeight;
            const popoverWidth = popover.offsetWidth;
            const btnRect = btn.getBoundingClientRect();
            
            popover.style.position = 'absolute';
            let targetTop = btnRect.top + window.scrollY - popoverHeight - 8;
            const targetLeft = btnRect.right + window.scrollX - popoverWidth;
            
            if (targetTop < window.scrollY) {
              targetTop = btnRect.bottom + window.scrollY + 8;
              popover.style.transformOrigin = 'top right';
            } else {
              popover.style.transformOrigin = 'bottom right';
            }
            
            popover.style.top = targetTop + 'px';
            popover.style.left = targetLeft + 'px';
            popover.style.visibility = 'visible';
            
            // Focus search
            const searchInput = popover.querySelector('.wr-prompts-search-input');
            if (searchInput) searchInput.focus();
          });
        } else {
          popover.style.display = 'none';
        }
      });
    }

    setupGlobalClickListener() {
      if (!window.WR_PromptsGlobalListenerAdded) {
        window.WR_PromptsGlobalListenerAdded = true;
        document.addEventListener('click', (e) => {
          const path = e.composedPath();
          this.popovers.forEach(p => {
            if (!path.includes(p) && !path.some(node => node.classList && node.classList.contains('wr-prompts-btn'))) {
              p.style.display = 'none';
            }
          });
        });
      }
    }
  };
})();
