// src/content/features/focus-mode.js

let focusModeActive = false;

window.WR_InitFocusMode = function() {
  if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.focus) {
    if (focusModeActive) {
      document.body.classList.remove('wr-focus-mode-active');
      const allBlocks = document.querySelectorAll(window.WR_SELECTORS.elements.editorBlocks);
      allBlocks.forEach(b => b.classList.remove('wr-focus-dim', 'wr-focus-highlight'));
      focusModeActive = false;
    }
    return;
  }
  
  if (!focusModeActive) {
    focusModeActive = true;
    document.body.classList.add('wr-focus-mode-active');
    
    // Initial dim of all elements
    const allBlocks = document.querySelectorAll(window.WR_SELECTORS.elements.editorBlocks);
    allBlocks.forEach(b => b.classList.add('wr-focus-dim'));
  }
};

// Event delegation for focus hover
document.addEventListener('mouseover', (e) => {
  if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.focus) return;
  
  const block = e.target.closest(window.WR_SELECTORS.elements.editorBlocks);
  if (block) {
    // Dim everything else
    const allBlocks = document.querySelectorAll(window.WR_SELECTORS.elements.editorBlocks);
    allBlocks.forEach(b => {
      b.classList.add('wr-focus-dim');
      b.classList.remove('wr-focus-highlight');
    });
    
    // Highlight current
    block.classList.remove('wr-focus-dim');
    block.classList.add('wr-focus-highlight');
  }
});
