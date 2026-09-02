'use strict';

/**
 * @fileoverview Wider Recall - code-tools.js
 */
// src/content/features/code-tools.js

window.WR_InitCodeTools = function() {
  if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.codeTools) {
    // Clean up if toggled off
    document.querySelectorAll('.wr-code-copy-btn').forEach(btn => btn.remove());
    document.querySelectorAll('[data-wr-code-tools]').forEach(pre => pre.removeAttribute('data-wr-code-tools'));
    return;
  }
  
  const codeBlocks = document.querySelectorAll(window.WR_SELECTORS.elements.codeBlocks);
  codeBlocks.forEach(pre => {
    if (pre.hasAttribute('data-wr-code-tools')) return;
    pre.setAttribute('data-wr-code-tools', 'true');
    pre.style.position = 'relative';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'wr-code-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = pre.querySelector('code');
      if (code) {
        navigator.clipboard.writeText(code.innerText).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => copyBtn.textContent = 'Copy', 2000);
        });
      }
    };
    pre.appendChild(copyBtn);
  });
};

