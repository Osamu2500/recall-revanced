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
      this.collapsedCategories = new Set();
    }

    // --- State Management ---
    loadPrompts(callback) {
      chrome.storage.local.get([this.STORAGE_KEY, this.OLD_STORAGE_KEY, 'wr_custom_categories'], (result) => {
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
        
        this.savedCategories = result.wr_custom_categories || [];
        this.updateCategories();
        if (callback) callback();
      });
    }

    savePrompts() {
      // Re-order by index inside category
      this.promptsData.forEach((p, i) => p.order = i);
      chrome.storage.local.set({ 
        [this.STORAGE_KEY]: this.promptsData,
        wr_custom_categories: this.categories
      });
      this.updateCategories();
    }

    updateCategories() {
      const cats = new Set(this.promptsData.map(p => p.category));
      (this.savedCategories || []).forEach(c => cats.add(c));
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
      
      // SVG Assets
      const svgExport = `<svg class="wr-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`;
      const svgImport = `<svg class="wr-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
      const svgSearch = `<svg class="wr-icon-svg wr-search-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
      const svgFolder = `<svg class="wr-icon-svg wr-folder-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
      const svgChevron = `<svg class="wr-icon-svg wr-chevron-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
      const svgDrag = `<svg class="wr-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>`;
      const svgTrash = `<svg class="wr-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
      const svgPlus = `<svg class="wr-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      const svgFolderPlus = `<svg class="wr-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>`;
      const svgEdit = `<svg class="wr-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

      // Header
      const header = document.createElement('div');
      header.className = 'wr-prompts-header';
      header.innerHTML = `
        <span>Prompt Library</span>
        <div class="wr-prompts-actions">
          <button class="wr-btn-icon" id="wr-add-cat-btn" title="New Folder">${svgFolderPlus}</button>
          <button class="wr-btn-icon" id="wr-export-btn" title="Export JSON">${svgExport}</button>
          <button class="wr-btn-icon" id="wr-import-btn" title="Import JSON">${svgImport}</button>
        </div>
      `;
      popover.appendChild(header);
      
      header.querySelector('#wr-add-cat-btn').onclick = () => {
        const catName = prompt("Enter new folder name:");
        if (catName && catName.trim()) {
          this.savedCategories.push(catName.trim());
          this.savePrompts();
          this.renderAllPopovers();
        }
      };
      header.querySelector('#wr-export-btn').onclick = () => this.exportPrompts();
      header.querySelector('#wr-import-btn').onclick = () => this.importPrompts();

      // Search Bar
      const searchRow = document.createElement('div');
      searchRow.className = 'wr-prompts-search-row';
      searchRow.innerHTML = svgSearch;
      
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

        const isCollapsed = this.collapsedCategories.has(cat) && !this.searchQuery;

        const isGeneral = cat === 'General';
        
        let actionsHTML = '';
        if (!isGeneral) {
          actionsHTML = `
            <div class="wr-cat-actions">
              <button class="wr-cat-action-btn wr-cat-edit" title="Rename folder">${svgEdit}</button>
              <button class="wr-cat-action-btn wr-cat-del" title="Delete folder">${svgTrash}</button>
            </div>
          `;
        }

        const catHeader = document.createElement('div');
        catHeader.className = 'wr-prompts-cat-header';
        
        const inner = document.createElement('div');
        inner.className = 'wr-cat-header-inner' + (isCollapsed ? ' collapsed' : '');
        inner.innerHTML = `${svgFolder} <span class="wr-cat-name">${cat}</span> ${actionsHTML} ${svgChevron}`;
        catHeader.appendChild(inner);
        
        catHeader.onclick = () => {
          if (this.searchQuery) return; // Disabled while searching
          if (this.collapsedCategories.has(cat)) this.collapsedCategories.delete(cat);
          else this.collapsedCategories.add(cat);
          this.renderAllPopovers();
        };

        if (!isGeneral) {
          const editBtn = inner.querySelector('.wr-cat-edit');
          const delBtn = inner.querySelector('.wr-cat-del');
          
          editBtn.onclick = (e) => {
            e.stopPropagation();
            const newName = prompt("Enter new folder name:", cat);
            if (newName && newName.trim() && newName.trim() !== cat) {
              const trimmed = newName.trim();
              const sIdx = this.savedCategories.indexOf(cat);
              if (sIdx !== -1) this.savedCategories[sIdx] = trimmed;
              else this.savedCategories.push(trimmed);
              
              this.promptsData.forEach(p => {
                if (p.category === cat) p.category = trimmed;
              });
              
              if (this.collapsedCategories.has(cat)) {
                this.collapsedCategories.delete(cat);
                this.collapsedCategories.add(trimmed);
              }
              this.savePrompts();
              this.renderAllPopovers();
            }
          };
          
          delBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Delete folder "${cat}" and all its prompts?`)) {
              this.savedCategories = this.savedCategories.filter(c => c !== cat);
              this.promptsData = this.promptsData.filter(p => p.category !== cat);
              if (this.collapsedCategories.has(cat)) this.collapsedCategories.delete(cat);
              this.savePrompts();
              this.renderAllPopovers();
            }
          };
        }

        // Setup Drag & Drop for category header (Drop target)
        catHeader.ondragover = (e) => { e.preventDefault(); inner.style.background = 'rgba(139, 92, 246, 0.2)'; };
        catHeader.ondragleave = (e) => { inner.style.background = ''; };
        catHeader.ondrop = (e) => {
          inner.style.background = '';
          this.handleDrop(e, cat);
        };
        
        list.appendChild(catHeader);

        if (isCollapsed) return; // Skip rendering items if collapsed

        grouped[cat].sort((a, b) => a.order - b.order).forEach(prompt => {
          const item = document.createElement('div');
          item.className = 'wr-prompt-item';
          item.draggable = true;
          item.dataset.id = prompt.id;
          
          item.ondragstart = (e) => {
            this.draggedItem = prompt;
            e.dataTransfer.effectAllowed = 'move';
            // setTimeout prevents the drag image from disappearing in some browsers
            setTimeout(() => item.classList.add('dragging'), 0);
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

          const handle = document.createElement('div');
          handle.className = 'wr-drag-handle';
          handle.innerHTML = svgDrag;
          item.appendChild(handle);

          const textSpan = document.createElement('span');
          textSpan.className = 'wr-prompt-text';
          
          let displayText = prompt.text;
          // Highlight variables
          displayText = displayText.replace(/\[(.*?)\]/g, '<span class="wr-prompt-var">[$1]</span>');
          
          // Highlight search matches
          if (this.searchQuery) {
             const regex = new RegExp(`(${this.searchQuery})`, 'gi');
             // We only replace outside of tags to prevent breaking the var spans
             displayText = displayText.replace(/(?![^<]*>)(.*?)(?=<|$)/g, (match) => {
               return match.replace(regex, '<span class="wr-search-highlight">$1</span>');
             });
          }
          
          textSpan.innerHTML = displayText;
          
          textSpan.onclick = () => {
            this.injectText(popover.chatInput, prompt.text);
            popover.style.display = 'none';
          };
          item.appendChild(textSpan);

          const actions = document.createElement('div');
          actions.className = 'wr-prompt-actions';

          const delBtn = document.createElement('button');
          delBtn.className = 'wr-prompt-del';
          delBtn.title = 'Delete';
          delBtn.innerHTML = svgTrash;
          delBtn.onclick = (e) => {
            e.stopPropagation();
            this.promptsData = this.promptsData.filter(p => p.id !== prompt.id);
            this.savePrompts();
            this.renderAllPopovers();
          };
          actions.appendChild(delBtn);
          
          item.appendChild(actions);
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
      addBtn.title = 'Add Prompt';
      addBtn.innerHTML = svgPlus;
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
