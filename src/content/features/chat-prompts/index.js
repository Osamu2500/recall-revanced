// src/content/features/chat-prompts.js
(function() {
  window.WR_InitChatPrompts = function() {
    if (!window.WR_STATE || !window.WR_STATE.enabled) return;
    if (!window.PromptLibraryUI) return; // Ensure core is loaded
    
    // Initialize the shared UI manager
    if (!window.wrPromptUIWeb) {
      window.wrPromptUIWeb = new window.PromptLibraryUI();
      window.wrPromptUIWeb.setupGlobalClickListener();
    }
    
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
        
        if (uploadChip) {
          // Traverse up to find the actual flex row that groups these chips on the left
          let row = uploadChip.parentElement;
          while (row && row !== current) {
            const style = window.getComputedStyle(row);
            // We want a flex row, but NOT the outermost one that spreads everything apart (space-between)
            if (style.display === 'flex' && !style.justifyContent.includes('space-between')) {
              container = row;
              break;
            }
            row = row.parentElement;
          }
          
          if (container) break;
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

    // Use shared PromptLibraryUI to create elements and bind logic
    const btn = window.wrPromptUIWeb.createTriggerButton();
    const popover = window.wrPromptUIWeb.createPopover(chatInput);
    window.wrPromptUIWeb.bindPopoverToButton(btn, popover);

    container.appendChild(btn);
  }
})();
