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
      this.activeCategory = 'General';
      
      // V5 state
      this.selectedPrompts = new Set();
      this.popoverSize = { width: null, height: null };
    }

    // --- State Management ---
    loadPrompts(callback) {
      chrome.storage.local.get([this.STORAGE_KEY, this.OLD_STORAGE_KEY, 'wr_custom_categories', 'wr_popover_size'], (result) => {
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
        if (result.wr_popover_size) {
           this.popoverSize = result.wr_popover_size;
        }
        
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
      // Preserve saved custom order
      const cats = new Set(this.savedCategories || []);
      // Add any dynamic ones found in prompts that aren't saved yet
      this.promptsData.forEach(p => cats.add(p.category));
      
      this.categories = Array.from(cats);
      // Ensure 'General' is always first
      this.categories = this.categories.filter(c => c !== 'General');
      this.categories.unshift('General');
      
      // Update saved categories so it includes newly discovered ones
      this.savedCategories = [...this.categories];
    }

    // --- DOM Injection Logic ---
    injectText(editorElement, text) {
      editorElement.focus();
      
      let finalText = text;
      
      // Auto-replace smart context variables
      finalText = finalText.replace(/\[selection\]/gi, window.getSelection().toString() || '');
      finalText = finalText.replace(/\[url\]/gi, window.location.href);

      const regex = /\[(.*?)\]/g;
      let match;
      while ((match = regex.exec(finalText)) !== null) {
         const val = prompt(`Fill in variable for [${match[1]}]:`);
         if (val === null) return; // User cancelled
         finalText = finalText.replace(match[0], val);
         regex.lastIndex = 0; // Reset index since string length changed
      }
      
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', finalText);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dataTransfer, bubbles: true, cancelable: true
      });
      editorElement.dispatchEvent(pasteEvent);
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

    openEditorModal(promptObj, onSave) {
      const existing = document.getElementById('wr-prompt-editor-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'wr-prompt-editor-modal';
      modal.className = 'wr-modal-overlay';
      
      const isNew = !promptObj.id;
      const initialText = promptObj.text || '';
      
      modal.innerHTML = `
        <div class="wr-modal-content">
          <div class="wr-modal-header">
            <h3>${isNew ? 'Create Prompt' : 'Edit Prompt'}</h3>
            <button class="wr-modal-close">&times;</button>
          </div>
          <div class="wr-modal-body">
            <textarea id="wr-modal-textarea" placeholder="Write your prompt here...&#10;Use [variable] for fill-in-the-blanks.&#10;Use [selection] or [url] for auto-context.">${initialText}</textarea>
          </div>
          <div class="wr-modal-footer">
            <button class="wr-btn wr-btn-secondary" id="wr-modal-cancel">Cancel</button>
            <button class="wr-btn wr-btn-primary" id="wr-modal-save">Save Prompt</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const textarea = modal.querySelector('#wr-modal-textarea');
      // Set initial height to content if editing
      if (!isNew) {
         textarea.style.height = 'auto';
         textarea.style.height = (textarea.scrollHeight) + 'px';
      }
      textarea.focus();
      
      const close = () => modal.remove();
      
      modal.querySelector('.wr-modal-close').onclick = close;
      modal.querySelector('#wr-modal-cancel').onclick = close;
      
      modal.querySelector('#wr-modal-save').onclick = () => {
        const val = textarea.value.trim();
        if (val) {
           onSave(val);
           close();
        }
      };
      
      modal.onmousedown = (e) => {
         if (e.target === modal) close();
      };
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
      
      // Load saved dimensions
      if (this.popoverSize && this.popoverSize.width) {
        popover.style.width = this.popoverSize.width + 'px';
        popover.style.height = this.popoverSize.height + 'px';
      }
      
      // Save dimensions on resize
      let resizeTimeout;
      new ResizeObserver((entries) => {
         for (let entry of entries) {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
               if (popover.style.display !== 'none') {
                  this.popoverSize = {
                     width: entry.contentRect.width,
                     height: entry.contentRect.height
                  };
                  chrome.storage.local.set({ wr_popover_size: this.popoverSize });
               }
            }, 500);
         }
      }).observe(popover);
      
      // Slash Command Shortcut (/)
      if (!chatInput.hasAttribute('data-slash-bound')) {
         chatInput.setAttribute('data-slash-bound', 'true');
         chatInput.addEventListener('keydown', (e) => {
           if (e.key === '/' && popover.style.display !== 'flex') {
             if (popover.associatedBtn) {
                // Short timeout to allow the slash to be typed first
                setTimeout(() => {
                   popover.associatedBtn.click();
                }, 10);
             }
           }
         });
      }
      
      return popover;
    }

    renderAllPopovers() {
      // Garbage collection: remove dead popovers to prevent memory leaks
      for (const p of this.popovers) {
        const root = p.getRootNode();
        const isAttached = document.contains(p) || (root instanceof ShadowRoot && document.contains(root.host));
        if (!isAttached) {
          this.popovers.delete(p);
        }
      }
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
      const svgStar = `<svg class="wr-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

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
      searchInput.addEventListener('keydown', (e) => {
         if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const items = Array.from(popover.querySelectorAll('.wr-prompt-item'));
            if (items.length === 0) return;
            
            let focusedIdx = items.findIndex(el => el.classList.contains('focused'));
            if (e.key === 'ArrowDown') focusedIdx = (focusedIdx + 1) % items.length;
            else if (e.key === 'ArrowUp') focusedIdx = focusedIdx <= 0 ? items.length - 1 : focusedIdx - 1;
            
            items.forEach(el => el.classList.remove('focused'));
            items[focusedIdx].classList.add('focused');
            items[focusedIdx].scrollIntoView({ block: 'nearest' });
         } else if (e.key === 'Enter') {
            const focused = popover.querySelector('.wr-prompt-item.focused');
            if (focused) focused.querySelector('.wr-prompt-text').click();
         }
      });
      searchRow.appendChild(searchInput);
      popover.appendChild(searchRow);

      // List container
      const list = document.createElement('div');
      list.className = 'wr-prompts-list';

      const isTagSearch = this.searchQuery.startsWith('#');
      let searchWord = this.searchQuery;
      if (isTagSearch) searchWord = this.searchQuery.substring(1);
      
      const filtered = this.promptsData.filter(p => {
         if (!this.searchQuery) return true;
         if (isTagSearch) {
            // Strict tag search: must have `#tag` exactly
            const tagRegex = new RegExp(`(^|\\s)#${searchWord}(\\s|$)`, 'i');
            return tagRegex.test(p.text);
         } else {
            return p.text.toLowerCase().includes(this.searchQuery) || p.category.toLowerCase().includes(this.searchQuery);
         }
      });
      // Sort: Starred first, then by order
      const sortedPrompts = [...filtered].sort((a, b) => {
        const aStar = a.starred ? 1 : 0;
        const bStar = b.starred ? 1 : 0;
        if (aStar !== bStar) return bStar - aStar;
        return (a.order || 0) - (b.order || 0);
      });

      // Group by category
      const grouped = {};
      this.categories.forEach(c => grouped[c] = []);
      sortedPrompts.forEach(p => {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
      });

      Object.keys(grouped).forEach(cat => {
        if (grouped[cat].length === 0 && this.searchQuery) return; // Hide empty cats while searching

        // Hide non-active categories unless we are searching
        if (!this.searchQuery && cat !== this.activeCategory) return;

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
              if (this.activeCategory === cat) {
                this.activeCategory = trimmed;
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
              if (this.activeCategory === cat) {
                this.activeCategory = 'General';
              }
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
            const bounding = item.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY - offset > 0) {
              item.style.borderBottom = '2px solid #f05622';
              item.style.borderTop = '';
            } else {
              item.style.borderTop = '2px solid #f05622';
              item.style.borderBottom = '';
            }
          };
          item.ondragleave = () => {
            item.style.borderTop = '';
            item.style.borderBottom = '';
          };
          item.ondrop = (e) => {
            e.preventDefault();
            item.style.borderTop = '';
            item.style.borderBottom = '';
            
            const bounding = item.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            const insertAfter = (e.clientY - offset > 0);
            
            this.handleDrop(e, cat, prompt.id, insertAfter);
          };

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'wr-prompt-cb';
          cb.checked = this.selectedPrompts.has(prompt.id);
          cb.onclick = (e) => {
             e.stopPropagation();
             if (cb.checked) this.selectedPrompts.add(prompt.id);
             else this.selectedPrompts.delete(prompt.id);
             this.renderAllPopovers();
          };
          item.appendChild(cb);

          const handle = document.createElement('div');
          handle.className = 'wr-drag-handle';
          handle.innerHTML = svgDrag;
          item.appendChild(handle);

          const textSpan = document.createElement('span');
          textSpan.className = 'wr-prompt-text';
          
          let displayText = prompt.text;
          
          // Escape HTML first for safety
          displayText = displayText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          
          // Inline Markdown Rendering
          displayText = displayText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          displayText = displayText.replace(/\*(.*?)\*/g, '<em>$1</em>');
          displayText = displayText.replace(/`(.*?)`/g, '<code>$1</code>');
          
          // Tag rendering (#tag)
          displayText = displayText.replace(/(^|\s)#(\w+)/g, '$1<span class="wr-prompt-tag">#$2</span>');
          
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

          const starBtn = document.createElement('button');
          starBtn.className = 'wr-prompt-star wr-prompt-action-btn';
          starBtn.title = 'Favorite';
          starBtn.innerHTML = svgStar;
          if (prompt.starred) {
            starBtn.style.fill = '#f05622';
            starBtn.style.color = '#f05622';
          }
          starBtn.onclick = (e) => {
            e.stopPropagation();
            prompt.starred = !prompt.starred;
            this.savePrompts();
            this.renderAllPopovers();
          };
          actions.appendChild(starBtn);

          const editBtn = document.createElement('button');
          editBtn.className = 'wr-prompt-edit wr-prompt-action-btn';
          editBtn.title = 'Edit';
          editBtn.innerHTML = svgEdit;
          editBtn.onclick = (e) => {
            e.stopPropagation();
            this.openEditorModal(prompt, (newText) => {
               if (newText !== prompt.text) {
                  prompt.text = newText;
                  this.savePrompts();
                  this.renderAllPopovers();
               }
            });
          };
          actions.appendChild(editBtn);

          const delBtn = document.createElement('button');
          delBtn.className = 'wr-prompt-del wr-prompt-action-btn';
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
      
      if (filtered.length === 0) {
         const emptyState = document.createElement('div');
         emptyState.className = 'wr-empty-state';
         emptyState.innerHTML = `
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
             <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
           </svg>
           <div>No prompts found</div>
         `;
         list.appendChild(emptyState);
      }
      
      popover.appendChild(list);

      // Add new row
      const addRow = document.createElement('div');
      addRow.className = 'wr-prompts-add-row';
      
      // Custom Dropdown UI
      const catSelectWrapper = document.createElement('div');
      catSelectWrapper.className = 'wr-custom-select';
      
      const catSelectValue = document.createElement('div');
      catSelectValue.className = 'wr-custom-select-val';
      catSelectValue.innerHTML = `<span>${this.activeCategory}</span> ${svgChevron}`;
      
      const catSelectMenu = document.createElement('div');
      catSelectMenu.className = 'wr-custom-select-menu';
      
      this.categories.forEach(c => {
        const opt = document.createElement('div');
        opt.className = 'wr-custom-select-opt';
        if (c === this.activeCategory) opt.classList.add('selected');
        opt.textContent = c;
        
        // Folder Reordering
        if (c !== 'General') {
          opt.draggable = true;
          opt.ondragstart = (e) => {
            this.draggedCategory = c;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => opt.classList.add('dragging'), 0);
          };
          opt.ondragend = () => {
            this.draggedCategory = null;
            opt.classList.remove('dragging');
          };
          opt.ondragover = (e) => {
            e.preventDefault();
            const bounding = opt.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY - offset > 0) {
              opt.style.borderBottom = '2px solid #f05622';
              opt.style.borderTop = '';
            } else {
              opt.style.borderTop = '2px solid #f05622';
              opt.style.borderBottom = '';
            }
          };
          opt.ondragleave = () => {
            opt.style.borderTop = '';
            opt.style.borderBottom = '';
          };
          opt.ondrop = (e) => {
            e.preventDefault();
            opt.style.borderTop = '';
            opt.style.borderBottom = '';
            
            if (!this.draggedCategory || this.draggedCategory === c) return;
            
            const bounding = opt.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            const insertAfter = (e.clientY - offset > 0);
            
            const draggedIdx = this.savedCategories.indexOf(this.draggedCategory);
            const targetIdx = this.savedCategories.indexOf(c);
            
            if (draggedIdx > -1 && targetIdx > -1) {
              this.savedCategories.splice(draggedIdx, 1);
              const newTargetIdx = this.savedCategories.indexOf(c);
              const insertAt = insertAfter ? newTargetIdx + 1 : newTargetIdx;
              this.savedCategories.splice(insertAt, 0, this.draggedCategory);
              
              this.savePrompts();
              this.renderAllPopovers();
            }
          };
        }

        opt.onclick = (e) => {
           e.stopPropagation();
           this.activeCategory = c;
           this.renderAllPopovers();
        };
        catSelectMenu.appendChild(opt);
      });
      
      catSelectWrapper.appendChild(catSelectValue);
      catSelectWrapper.appendChild(catSelectMenu);
      
      catSelectValue.onclick = (e) => {
         e.stopPropagation();
         const isOpen = catSelectMenu.classList.contains('show');
         document.querySelectorAll('.wr-custom-select-menu').forEach(m => m.classList.remove('show'));
         if (!isOpen) catSelectMenu.classList.add('show');
      };

      popover.addEventListener('click', (e) => {
         if (!catSelectWrapper.contains(e.target)) {
             catSelectMenu.classList.remove('show');
         }
      });
      
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Click to create rich-text prompt...';
      input.className = 'wr-prompts-input';
      input.readOnly = true;
      input.style.cursor = 'pointer';
      
      const addBtn = document.createElement('button');
      addBtn.className = 'wr-prompts-add-btn';
      addBtn.title = 'Add Prompt';
      addBtn.innerHTML = svgPlus;
      
      const handleAdd = () => {
         this.openEditorModal({ text: '' }, (val) => {
            let category = this.activeCategory;
            // Support fast category creation via "Cat: text" format
            if (val.includes(':') && val.split(':')[0].length < 15) {
              const parts = val.split(':');
              category = parts[0].trim();
              val = parts.slice(1).join(':').trim();
            }
            this.promptsData.push({
              id: 'prompt_' + Date.now(),
              text: val,
              category: category,
              order: this.promptsData.length
            });
            this.activeCategory = category;
            this.savePrompts();
            this.renderAllPopovers();
         });
      };
      
      input.onclick = handleAdd;
      addBtn.onclick = handleAdd;

      addRow.appendChild(catSelectWrapper);
      addRow.appendChild(input);
      addRow.appendChild(addBtn);
      popover.appendChild(addRow);
      
      // Bulk Actions Bar
      if (this.selectedPrompts.size > 0) {
         const bulkBar = document.createElement('div');
         bulkBar.className = 'wr-bulk-actions-bar';
         
         const countSpan = document.createElement('span');
         countSpan.textContent = `${this.selectedPrompts.size} selected`;
         
         const actionsDiv = document.createElement('div');
         
         // Move Dropdown inside Bulk Bar
         const moveSelect = document.createElement('select');
         moveSelect.className = 'wr-bulk-move-select';
         const defaultOpt = document.createElement('option');
         defaultOpt.textContent = 'Move to...';
         defaultOpt.value = '';
         moveSelect.appendChild(defaultOpt);
         this.categories.forEach(c => {
             const opt = document.createElement('option');
             opt.value = c;
             opt.textContent = c;
             moveSelect.appendChild(opt);
         });
         moveSelect.onchange = (e) => {
             const targetCat = e.target.value;
             if (targetCat) {
                 this.promptsData.forEach(p => {
                     if (this.selectedPrompts.has(p.id)) p.category = targetCat;
                 });
                 this.selectedPrompts.clear();
                 this.savePrompts();
                 this.renderAllPopovers();
             }
         };
         
         const delBulkBtn = document.createElement('button');
         delBulkBtn.className = 'wr-bulk-del-btn';
         delBulkBtn.textContent = 'Delete';
         delBulkBtn.onclick = () => {
             if (confirm(`Delete ${this.selectedPrompts.size} prompts?`)) {
                 this.promptsData = this.promptsData.filter(p => !this.selectedPrompts.has(p.id));
                 this.selectedPrompts.clear();
                 this.savePrompts();
                 this.renderAllPopovers();
             }
         };
         
         const cancelBtn = document.createElement('button');
         cancelBtn.className = 'wr-bulk-cancel-btn';
         cancelBtn.textContent = 'Cancel';
         cancelBtn.onclick = () => {
             this.selectedPrompts.clear();
             this.renderAllPopovers();
         };
         
         actionsDiv.appendChild(moveSelect);
         actionsDiv.appendChild(delBulkBtn);
         actionsDiv.appendChild(cancelBtn);
         
         bulkBar.appendChild(countSpan);
         bulkBar.appendChild(actionsDiv);
         popover.appendChild(bulkBar);
      }
      
      // Maintain focus if typing
      if (popover.style.display === 'flex') {
        const activeInput = popover.querySelector('.wr-prompts-search-input');
        if (activeInput && this.searchQuery) activeInput.focus();
      }
      
      // Add custom resizer grip
      const grip = document.createElement('div');
      grip.className = 'wr-resize-grip';
      grip.innerHTML = `<svg viewBox="0 0 12 12"><path d="M10 2L2 10M10 6L6 10M10 10L9.9 10"/></svg>`;
      popover.appendChild(grip);
    }

    handleDrop(e, targetCategory, targetPromptId = null, insertAfter = false) {
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
        // Re-find target index since splice might have shifted elements
        const newTargetIndex = this.promptsData.findIndex(p => p.id === targetPromptId);
        const insertAt = insertAfter ? newTargetIndex + 1 : newTargetIndex;
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

    updatePosition(popover) {
      if (!popover.associatedBtn || popover.style.display !== 'flex') return;
      // Skip if popover is positioned relatively in a container (e.g. inside the Widget)
      if (popover.style.bottom === '100%' || popover.style.top === '100%') return;
      
      const btn = popover.associatedBtn;
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
    }

    bindPopoverToButton(btn, popover) {
      popover.associatedBtn = btn;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Close others
        this.popovers.forEach(p => { if (p !== popover) p.style.display = 'none'; });

        if (popover.style.display === 'none') {
          // Clear search query when opening
          this.searchQuery = '';
          
          this.loadPrompts(() => {
            this.renderPopoverContent(popover);
            
            popover.style.visibility = 'hidden';
            popover.style.display = 'flex';
            
            this.updatePosition(popover);
            
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

        // Update active popover positions on scroll/resize for the main web app
        const updateAllPositions = () => {
          this.popovers.forEach(p => {
             if (p.style.display === 'flex') this.updatePosition(p);
          });
        };
        
        window.addEventListener('scroll', updateAllPositions, { passive: true });
        window.addEventListener('resize', updateAllPositions, { passive: true });
      }
    }
  };
})();
