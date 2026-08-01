// src/content/features/chat-prompts.js

(function() {
  let promptsData = [];
  const STORAGE_KEY = 'wr_custom_prompts';
  
  // Load prompts
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

  // Inject text into React/Vue controlled textarea or Slate.js contenteditable
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

  window.WR_InitChatPrompts = function() {
    if (!window.WR_STATE || !window.WR_STATE.enabled) return;
    
    // Find all chat editors (Slate.js contenteditable or textareas)
    const editors = document.querySelectorAll('[data-slate-editor="true"], [contenteditable="true"], textarea');
    
    for (const editor of editors) {
      // For textarea, check placeholder. For contenteditable, we can assume it's a chat input if it's inside #chat-input-container or similar
      const isChat = editor.id === 'chat-input' || 
                     editor.closest('#chat-input-container, [data-chat-input-container="true"]') ||
                     (editor.placeholder && (editor.placeholder.toLowerCase().includes('ask anything') || editor.placeholder.includes('@')));
                     
      if (isChat) {
        initChatPromptForTextarea(editor);
      }
    }
  };

  function initChatPromptForTextarea(chatInput) {
    if (chatInput.hasAttribute('data-wr-prompts-init')) return;
    chatInput.setAttribute('data-wr-prompts-init', 'true');

    // Robustly find the row containing the "Upload" button/chip
    let container = null;
    let current = chatInput;
    
    for (let i = 0; i < 8; i++) {
      if (!current) break;
      
      const elements = Array.from(current.querySelectorAll('*'));
      // Find deepest element containing "Upload" or "Context" text
      const targetEl = elements.find(el => {
        const text = el.textContent || '';
        const match = text.includes('Upload') || text.includes('Context');
        return match && !Array.from(el.children).some(c => c.textContent && (c.textContent.includes('Upload') || c.textContent.includes('Context')));
      });
      
      if (targetEl) {
        // Traverse up slightly to find the clickable chip wrapper
        let node = targetEl;
        let uploadChip = null;
        for (let j = 0; j < 4; j++) {
          if (!node || node === current) break;
          const style = window.getComputedStyle(node);
          if (node.tagName === 'BUTTON' || node.getAttribute('role') === 'button' || node.className.includes('MuiChip') || (style && style.cursor === 'pointer')) {
            uploadChip = node;
            break;
          }
          node = node.parentElement;
        }
        
        if (uploadChip && uploadChip.parentElement) {
          container = uploadChip.parentElement;
          break;
        }
      }
      current = current.parentElement;
    }

    // Fallback if not found
    if (!container) {
      container = chatInput.parentElement.parentElement || chatInput.parentElement;
    }
    
    // We already marked the chatInput, but let's also mark the container so we don't duplicate
    if (container.hasAttribute('data-wr-prompts-injected')) return;
    container.setAttribute('data-wr-prompts-injected', 'true');

    if (window.getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    // Clean up old popovers if any for this specific container? 
    // Actually, React re-renders might orphan old popovers in document.body.
    // We handle cleanup by relying on the global click listener or general cleanup.

    // Create the toggle button
    const btn = document.createElement('button');
    btn.className = 'wr-prompts-btn';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M12 7v6"></path><path d="M9 10h6"></path></svg> <span>Prompts</span>`;
    
    // Create the popover modal
    const popover = document.createElement('div');
    popover.className = 'wr-prompts-popover';
    popover.style.display = 'none';

    function renderPrompts() {
      popover.innerHTML = '';
      
      const header = document.createElement('div');
      header.className = 'wr-prompts-header';
      header.textContent = 'Quick Prompts';
      popover.appendChild(header);

      const list = document.createElement('div');
      list.className = 'wr-prompts-list';
      
      promptsData.forEach((promptText, index) => {
        const item = document.createElement('div');
        item.className = 'wr-prompt-item';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'wr-prompt-text';
        textSpan.textContent = promptText;
        textSpan.onclick = () => {
          injectText(chatInput, promptText);
          popover.style.display = 'none';
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'wr-prompt-del';
        delBtn.innerHTML = '×';
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
      input.type = 'text';
      input.placeholder = 'New prompt...';
      input.className = 'wr-prompts-input';
      
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
          popover.style.display = 'flex';
          
          // Force layout calculation
          const popoverHeight = popover.offsetHeight;
          const popoverWidth = popover.offsetWidth;
          const btnRect = btn.getBoundingClientRect();
          
          // Position it absolutely on the MAIN document (Portal technique)
          popover.style.position = 'absolute';
          
          let targetTop = btnRect.top + window.scrollY - popoverHeight - 8;
          const targetLeft = btnRect.right + window.scrollX - popoverWidth;
          
          // Smart collision detection
          if (targetTop < window.scrollY) {
            targetTop = btnRect.bottom + window.scrollY + 8;
            popover.style.transformOrigin = 'top right';
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

    // Close when clicking outside
    if (!document.wrPromptsListenerAddedWeb) {
      document.wrPromptsListenerAddedWeb = true;
      document.addEventListener('click', (e) => {
        const path = e.composedPath();
        const popovers = document.querySelectorAll('.wr-prompts-popover');
        
        popovers.forEach(p => {
          if (!path.includes(p) && !path.some(node => node.classList && node.classList.contains('wr-prompts-btn'))) {
            p.style.display = 'none';
          }
        });
      });
    }

    container.appendChild(btn);
    // Portaling the popover to the Light DOM
    document.body.appendChild(popover);
  }
})();
