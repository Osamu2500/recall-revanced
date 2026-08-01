// src/content/features/chat-prompts-global.js
(function() {
  console.log('[Wider Recall] Global chat prompts script initialized on:', window.location.href);
  const STORAGE_KEY = 'wr_custom_prompts';
  let promptsData = [];
  let isInitializing = false;

  function loadPrompts(callback) {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      promptsData = result[STORAGE_KEY] || [
        "Summarize this in 3 bullet points.",
        "Explain this like I'm 5.",
        "What are the key takeaways?"
      ];
      if (callback) callback();
    });
  }

  function savePrompts() {
    chrome.storage.local.set({ [STORAGE_KEY]: promptsData });
  }

  // Inject CSS globally but isolated to our UI, handling Shadow DOMs
  function injectStyles(rootNode) {
    if (rootNode.querySelector('#wr-prompts-global-style')) return;
    const style = document.createElement('style');
    style.id = 'wr-prompts-global-style';
    style.textContent = `
      .wr-prompts-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e4e4e7;
        padding: 0px 12px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 400;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: 8px;
        height: 28px;
        vertical-align: middle;
        z-index: 100000;
        font-family: inherit;
        box-sizing: border-box;
      }
      .wr-prompts-btn:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .wr-prompts-btn svg {
        width: 16px;
        height: 16px;
        color: #a1a1aa;
      }
      .wr-prompts-popover {
        position: absolute;
        width: 320px;
        background: #18181b;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        z-index: 2147483647;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: wr-pop-up 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        transform-origin: bottom right;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      @keyframes wr-pop-up {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      .wr-prompts-header {
        padding: 12px 16px;
        font-size: 11px;
        font-weight: 600;
        color: #a1a1aa;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: rgba(255,255,255, 0.02);
      }
      .wr-prompts-list {
        max-height: 250px;
        overflow-y: auto;
        padding: 4px 0;
      }
      .wr-prompts-list::-webkit-scrollbar {
        width: 6px;
      }
      .wr-prompts-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
      .wr-prompt-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 16px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .wr-prompt-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .wr-prompt-text {
        flex: 1;
        font-size: 14px;
        color: #e4e4e7;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wr-prompt-del {
        background: none;
        border: none;
        color: #52525b;
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
        line-height: 1;
        border-radius: 4px;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .wr-prompt-del:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }
      .wr-prompts-add-row {
        display: flex;
        padding: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        background: rgba(0, 0, 0, 0.2);
        gap: 8px;
      }
      .wr-prompts-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #fff;
        padding: 8px 12px;
        border-radius: 8px;
        outline: none;
        font-size: 13px;
        transition: border-color 0.2s;
      }
      .wr-prompts-input::placeholder {
        color: #71717a;
      }
      .wr-prompts-input:focus {
        border-color: rgba(255, 255, 255, 0.3);
      }
      .wr-prompts-add-btn {
        background: rgba(255, 255, 255, 0.1);
        color: #e4e4e7;
        border: 1px solid rgba(255, 255, 255, 0.05);
        padding: 0 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        font-size: 18px;
        transition: all 0.2s;
      }
      .wr-prompts-add-btn:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    `;
    if (rootNode === document || rootNode === document.body) {
      document.head.appendChild(style);
    } else {
      rootNode.appendChild(style);
    }
  }

  function injectText(editorElement, text) {
    editorElement.focus();
    
    // Modern React editors (like Slate.js) ignore direct DOM modifications 
    // because their internal state doesn't update.
    // The most reliable way to inject text is to simulate a paste event.
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);
    
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });
    
    editorElement.dispatchEvent(pasteEvent);
  }

  function initializeFeature() {
    let chatInput = null;
    let rootNode = document;
    
    // Check main document first
    function findChatInput(root) {
      const container = root.querySelector('#chat-input-container');
      if (container) {
        const editor = container.querySelector('[data-slate-editor="true"], [contenteditable="true"]');
        if (editor) return editor;
      }
      
      // Fallback if ID is missing: get the last editor (chat is usually at the bottom, notebook at top)
      const editors = root.querySelectorAll('[data-slate-editor="true"], .slate-editor');
      if (editors.length > 0) {
        return editors[editors.length - 1]; 
      }
      return null;
    }

    chatInput = findChatInput(document);
    
    if (!chatInput) {
      // Find all shadow roots in the page
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.shadowRoot) {
          const found = findChatInput(el.shadowRoot);
          if (found) {
            chatInput = found;
            rootNode = el.shadowRoot;
            break;
          }
        }
      }
    }

    if (!chatInput) {
      console.log('[Wider Recall] Could not find chatInput in main document or any shadow roots.');
      return;
    }
    
    // Find a good place to inject the button.
    const chatInputContainer = rootNode.querySelector('#chat-input-container');
    if (!chatInputContainer || chatInputContainer.hasAttribute('data-wr-prompts-init')) return;
    
    // Attempt to find the flex row containing the summary buttons
    // chat-input-container -> first child -> first child (contains the summary buttons)
    let summaryRow = null;
    if (chatInputContainer.firstElementChild && chatInputContainer.firstElementChild.firstElementChild) {
      summaryRow = chatInputContainer.firstElementChild.firstElementChild;
    }
    
    if (!summaryRow) {
      // Fallback
      summaryRow = chatInputContainer;
    }
    
    chatInputContainer.setAttribute('data-wr-prompts-init', 'true');
    console.log('[Wider Recall] Injected Prompts button into:', summaryRow);
    
    // Clean up any previously injected popovers from previous React renders to prevent memory leaks
    // Since we now portal to document.body, we query the main document
    const existingPopovers = document.querySelectorAll('.wr-prompts-popover');
    existingPopovers.forEach(p => p.remove());

    if (window.getComputedStyle(chatInputContainer).position === 'static') {
      chatInputContainer.style.position = 'relative';
    }

    // Ensure styles are injected into BOTH the shadow root (for the button) 
    // AND the main document (for the portaled popover)
    injectStyles(rootNode);
    if (rootNode !== document) {
      injectStyles(document);
    }

    // Create the toggle button
    const btn = document.createElement('button');
    btn.className = 'wr-prompts-btn';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M12 7v6"></path><path d="M9 10h6"></path></svg> <span>Prompts</span>`;
    
    // We will place it statically inline with the summary buttons
    btn.style.position = 'static';
    btn.style.margin = '0 0 0 8px'; 

    const popover = document.createElement('div');
    popover.className = 'wr-prompts-popover';
    popover.style.display = 'none';

    function renderPrompts() {
      popover.innerHTML = '';
      
      const header = document.createElement('div');
      header.className = 'wr-prompts-header';
      header.textContent = 'QUICK PROMPTS';
      popover.appendChild(header);

      const list = document.createElement('div');
      list.className = 'wr-prompts-list';
      
      promptsData.forEach((prompt, index) => {
        const item = document.createElement('div');
        item.className = 'wr-prompt-item';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'wr-prompt-text';
        textSpan.textContent = prompt;
        textSpan.title = prompt;
        
        textSpan.onclick = () => {
          injectText(chatInput, prompt);
          popover.style.display = 'none';
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'wr-prompt-del';
        delBtn.innerHTML = '×';
        delBtn.title = 'Delete prompt';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          promptsData.splice(index, 1);
          savePrompts();
          renderPrompts();
        };

        item.appendChild(textSpan);
        item.appendChild(delBtn);
        list.appendChild(item);
      });
      popover.appendChild(list);

      const addRow = document.createElement('div');
      addRow.className = 'wr-prompts-add-row';
      
      const input = document.createElement('input');
      input.className = 'wr-prompts-input';
      input.type = 'text';
      input.placeholder = 'New prompt...';
      
      const addBtn = document.createElement('button');
      addBtn.className = 'wr-prompts-add-btn';
      addBtn.textContent = '+';
      
      addBtn.onclick = () => {
        const val = input.value.trim();
        if (val) {
          promptsData.push(val);
          savePrompts();
          renderPrompts();
        }
      };

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addBtn.click();
      });

      addRow.appendChild(input);
      addRow.appendChild(addBtn);
      popover.appendChild(addRow);
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Close other open popovers if any
      const allPopovers = document.querySelectorAll('.wr-prompts-popover');
      allPopovers.forEach(p => { if (p !== popover) p.style.display = 'none'; });

      if (popover.style.display === 'none') {
        loadPrompts(() => {
          renderPrompts();
          
          popover.style.visibility = 'hidden';
          popover.style.display = 'flex'; // Use flex to maintain inner layout
          
          // Force layout calculation
          const popoverHeight = popover.offsetHeight;
          const popoverWidth = popover.offsetWidth;
          const btnRect = btn.getBoundingClientRect();
          
          // Position it absolutely on the MAIN document (Portal technique)
          // This entirely escapes Shadow DOM scaling/transform/clipping bugs!
          popover.style.position = 'absolute';
          
          let targetTop = btnRect.top + window.scrollY - popoverHeight - 8;
          const targetLeft = btnRect.right + window.scrollX - popoverWidth;
          
          // Smart collision detection: if it goes off the top of the screen, flip it below the button
          if (targetTop < window.scrollY) {
            targetTop = btnRect.bottom + window.scrollY + 8;
            popover.style.transformOrigin = 'top right'; // Adjust animation origin
          } else {
            popover.style.transformOrigin = 'bottom right';
          }
          
          popover.style.top = targetTop + 'px';
          popover.style.left = targetLeft + 'px';
          
          popover.style.visibility = 'visible';
        });
      } else {
        popover.style.display = 'none';
      }
    });

    // We store the listener on the document but make sure we don't leak them
    if (!document.wrPromptsListenerAdded) {
      document.wrPromptsListenerAdded = true;
      document.addEventListener('click', (e) => {
        // Use composedPath() to penetrate shadow DOM boundaries
        const path = e.composedPath();
        
        // Find all portaled popovers
        const popovers = document.querySelectorAll('.wr-prompts-popover');
        
        popovers.forEach(p => {
          // If click is not inside this popover AND not on ANY prompts button
          if (!path.includes(p) && !path.some(node => node.classList && node.classList.contains('wr-prompts-btn'))) {
            p.style.display = 'none';
          }
        });
      });
    }

    summaryRow.appendChild(btn);
    // Portaling the popover to the Light DOM (document.body) to guarantee it 
    // isn't clipped, z-indexed behind, or coordinate-skewed by the Shadow DOM!
    document.body.appendChild(popover);
  }

  // Run periodically to catch the widget opening on any site
  setInterval(() => {
    if (!isInitializing) {
      isInitializing = true;
      try {
        initializeFeature();
      } catch (e) {
        console.error('[Wider Recall] Error initializing:', e);
      }
      isInitializing = false;
    }
  }, 1000);

})();
