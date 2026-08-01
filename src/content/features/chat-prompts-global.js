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

      const chatInputContainer = rootNode.querySelector('#chat-input-container');
      if (!chatInputContainer) return;

      let summaryRow = null;
      // In the widget, the input container has a first child wrapper.
      if (chatInputContainer.firstElementChild && chatInputContainer.firstElementChild.firstElementChild) {
        summaryRow = chatInputContainer.firstElementChild.firstElementChild;
      }
      
      if (!summaryRow) {
        summaryRow = chatInputContainer;
      }

      if (summaryRow.hasAttribute('data-wr-prompts-injected')) return;
      
      chatInput.setAttribute('data-wr-prompts-init', 'true');
      summaryRow.setAttribute('data-wr-prompts-injected', 'true');

      if (window.getComputedStyle(summaryRow).position === 'static') {
        summaryRow.style.position = 'relative';
      }

      // Use shared PromptLibraryUI to create elements and bind logic
      const btn = window.wrPromptUIGlobal.createTriggerButton();
      
      // Some specific adjustments for the global widget styling
      btn.style.marginLeft = '12px';
      
      const popover = window.wrPromptUIGlobal.createPopover(chatInput);
      window.wrPromptUIGlobal.bindPopoverToButton(btn, popover);

      summaryRow.appendChild(btn);
    }

    // Process regular DOM
    processRoot(document);
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
