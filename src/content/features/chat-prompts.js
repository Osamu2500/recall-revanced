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

  // Inject text into React/Vue controlled textarea
  function injectText(textarea, text) {
    textarea.focus();
    
    // Check if we can use execCommand
    const success = document.execCommand('insertText', false, text);
    
    if (!success) {
      // Fallback for React 15/16+
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(textarea, textarea.value + (textarea.value ? '\n' : '') + text);
      
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  window.WR_InitChatPrompts = function() {
    if (!window.WR_STATE || !window.WR_STATE.enabled) return;
    
    // Find all chat textareas
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (ta.placeholder && (ta.placeholder.toLowerCase().includes('ask anything') || ta.placeholder.includes('@'))) {
        initChatPromptForTextarea(ta);
      }
    }
  };

  function initChatPromptForTextarea(chatInput) {
    // The container of the textarea is usually relative and houses the pills or action buttons
    const container = chatInput.parentElement;
    if (!container || container.hasAttribute('data-wr-prompts-init')) return;
    
    container.setAttribute('data-wr-prompts-init', 'true');
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
