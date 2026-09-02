// src/content/features/code-tools.js

window.WR_InitCodeTools = function() {
  if (!window.WR_STATE || !window.WR_STATE.enabled) return;
  
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
