// src/content/features/chat-prompts-global.js
(function() {
  const hn = window.location.hostname;
  if (hn === 'app.recall.it' || hn === 'app.getrecall.ai') {
    return; // The main web app is handled by chat-prompts.js
  }

  function initChatPromptsGlobal() {
    if (!window.PromptLibraryUI) return; // Ensure core is loaded
    
    // Initialize the shared UI manager
    if (!window.wrPromptUIGlobal) {
      window.wrPromptUIGlobal = new window.PromptLibraryUI();
      window.wrPromptUIGlobal.setupGlobalClickListener();
    }

    function findChatInput(root) {
      const container = root.querySelector('#chat-input-container');
      if (container) {
        const editor = container.querySelector('[data-slate-editor="true"], [contenteditable="true"]');
        if (editor) return editor;
      }
      
      const editors = root.querySelectorAll('[data-slate-editor="true"], .slate-editor');
      if (editors.length > 0) {
        return editors[editors.length - 1];
      }
      return root.querySelector('#chat-input');
    }

    function scanShadowDOM(rootNode) {
      if (rootNode.shadowRoot) {
        processRoot(rootNode.shadowRoot);
      }
      const children = rootNode.children || [];
      for (let i = 0; i < children.length; i++) {
        scanShadowDOM(children[i]);
      }
    }

    function processRoot(rootNode) {
      const chatInput = findChatInput(rootNode);
      if (!chatInput) return;
      if (chatInput.hasAttribute('data-wr-prompts-init')) return;
      chatInput.setAttribute('data-wr-prompts-init', 'true');

      // Robustly find the row containing the "Upload" or "Context" button/chip
      let container = null;
      let current = chatInput;
      
      for (let i = 0; i < 8; i++) {
        if (!current || !current.querySelectorAll) break;
        
        const elements = Array.from(current.querySelectorAll('*'));
        const targetEl = elements.find(el => {
          const text = el.textContent || '';
          const match = text.includes('Upload') || text.includes('Context');
          return match && !Array.from(el.children).some(c => c.textContent && (c.textContent.includes('Upload') || c.textContent.includes('Context')));
        });
        
        if (targetEl) {
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
      
      if (container.hasAttribute('data-wr-prompts-injected')) return;
      container.setAttribute('data-wr-prompts-injected', 'true');

      if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }

      // Use shared PromptLibraryUI to create elements and bind logic
      const btn = window.wrPromptUIGlobal.createTriggerButton();
      const popover = window.wrPromptUIGlobal.createPopover(chatInput);
      
      // The popover needs to be in the same root context for ShadowDOM portaling
      // so we override the default Light DOM portaling.
      window.wrPromptUIGlobal.bindPopoverToButton(btn, popover);
      
      // Override default document.body attachment for Shadow DOM
      if (rootNode.shadowRoot || rootNode.host) {
         popover.remove(); // Remove from light DOM document.body
         const shadowTarget = rootNode.shadowRoot || rootNode;
         shadowTarget.appendChild(popover);
         
         // Inject wider.css into the Shadow DOM so our elements are styled
         if (!shadowTarget.querySelector('#wr-prompts-css')) {
            const link = document.createElement('link');
            link.id = 'wr-prompts-css';
            link.rel = 'stylesheet';
            // Use chrome.runtime.getURL to load the extension's CSS file
            link.href = chrome.runtime.getURL('wider.css');
            shadowTarget.appendChild(link);
         }
      }

      container.appendChild(btn);
    }

    // Process Shadow DOMs (like the Recall Widget)
    scanShadowDOM(document.body);
  }

  // Run on page load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initChatPromptsGlobal();
  } else {
    document.addEventListener('DOMContentLoaded', initChatPromptsGlobal);
  }

  // Watch for dynamic widget injection
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      initChatPromptsGlobal();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
