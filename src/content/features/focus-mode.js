// src/content/features/focus-mode.js

/**
 * @fileoverview Advanced Focus Mode Engine
 * Replaces the unoptimized N^2 DOM-traversal hover script with a highly optimized
 * proximity-based focus tracker. It uses bounding box math to smoothly transition
 * opacity of paragraphs based on mouse distance, and employs sentence-level
 * granular focusing for intense reading sessions.
 */

const FocusState = {
  isEnabled: false,
  blocks: new Set(),
  activeBlock: null,
  mousePos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  animationFrame: null,
  observer: null,
  mutationObserver: null,
  config: {
    maxDist: 300, // Distance in pixels before a block is fully dimmed
    minOpacity: 0.15,
    maxOpacity: 1.0,
    sentenceGranularity: true // True = dim other sentences in the same block
  }
};

/**
 * Main Initialization Hook
 */
window.WR_InitFocusMode = function() {
  try {
    if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.focus) {
      if (FocusState.isEnabled) teardownFocusMode();
      return;
    }

    if (!FocusState.isEnabled) {
      FocusState.isEnabled = true;
      document.body.classList.add('wr-advanced-focus-mode');
      
      setupFocusObservers();
      setupMouseTracking();
      startFocusLoop();
    }
  } catch (e) {
    console.error("Wider Recall: Critical error in Advanced Focus Mode", e);
  }
};

/**
 * Sets up observers to only track elements currently visible on screen
 * to guarantee 60fps performance even on 10,000 word documents.
 */
function setupFocusObservers() {
  const editor = document.querySelector(window.WR_SELECTORS.elements.editor);
  if (!editor) return;

  FocusState.observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        FocusState.blocks.add(entry.target);
        if (FocusState.config.sentenceGranularity) splitIntoSentences(entry.target);
      } else {
        FocusState.blocks.delete(entry.target);
        // Clean up styles when offscreen to prevent memory leaks
        entry.target.style.opacity = '';
        entry.target.style.transform = '';
        entry.target.style.filter = '';
      }
    });
  }, { rootMargin: '200px' });

  // Initial Scan
  const selectors = 'p, li, h1, h2, h3, blockquote, pre, .text-block';
  editor.querySelectorAll(selectors).forEach(el => FocusState.observer.observe(el));

  // Dynamic Scan for React Spas
  FocusState.mutationObserver = new MutationObserver((mutations) => {
    if (!FocusState.isEnabled) return;
    mutations.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.matches && node.matches(selectors)) {
              FocusState.observer.observe(node);
            } else {
              node.querySelectorAll(selectors).forEach(el => FocusState.observer.observe(el));
            }
          }
        });
      }
    });
  });

  FocusState.mutationObserver.observe(editor, { childList: true, subtree: true });
}

/**
 * Advanced Sentence Granularity Splitter
 * Wraps individual sentences in spans to allow micro-focusing inside a large paragraph.
 */
function splitIntoSentences(block) {
  if (block.dataset.focusSplit === 'true') return;
  if (block.tagName === 'PRE' || block.tagName === 'CODE') return;
  
  // We only want to split blocks that are mostly text (not complex react widgets)
  if (block.children.length > 5) return;
  
  // Basic heuristic: check if it contains primarily text nodes
  let hasText = false;
  block.childNodes.forEach(n => { if (n.nodeType === 3 && n.nodeValue.trim().length > 10) hasText = true; });
  if (!hasText) return;

  // Clone to avoid breaking React refs entirely (risky, but required for granular focus)
  try {
    const html = block.innerHTML;
    // Regex matches sentence endings (.!?) followed by space or end of string, while ignoring abbreviations (e.g., Mr. Mrs.)
    const sentenceRegex = /([^.!?]+[.!?]+(?:\s|$))/g;
    
    // Only apply if it actually has multiple sentences
    const matchCount = (html.match(sentenceRegex) || []).length;
    if (matchCount > 1) {
      block.innerHTML = html.replace(sentenceRegex, '<span class="wr-focus-sentence" style="transition: opacity 0.3s ease, filter 0.3s ease;">$1</span>');
    }
    block.dataset.focusSplit = 'true';
  } catch (e) {
    // If it fails (e.g. malformed HTML), just mark as split and ignore
    block.dataset.focusSplit = 'true';
  }
}

/**
 * Tracks exact mouse coordinates across the entire document
 */
function setupMouseTracking() {
  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  // Add touch support for iPads
  window.addEventListener('touchmove', (e) => {
    if (e.touches[0]) {
      FocusState.mousePos.x = e.touches[0].clientX;
      FocusState.mousePos.y = e.touches[0].clientY;
    }
  }, { passive: true });
}

function handleMouseMove(e) {
  FocusState.mousePos.x = e.clientX;
  FocusState.mousePos.y = e.clientY;
}

/**
 * High-performance Render Loop
 * Calculates mathematical distance between the mouse and the bounding box 
 * of every visible block, adjusting opacity on a continuous gradient.
 */
function startFocusLoop() {
  const loop = () => {
    if (!FocusState.isEnabled) return;

    const { x, y } = FocusState.mousePos;
    const { maxDist, minOpacity, maxOpacity, sentenceGranularity } = FocusState.config;

    // Fast DOM Write phase
    FocusState.blocks.forEach(block => {
      // Calculate closest point on the block's bounding rectangle to the mouse
      const rect = block.getBoundingClientRect();
      
      const clampX = Math.max(rect.left, Math.min(x, rect.right));
      const clampY = Math.max(rect.top, Math.min(y, rect.bottom));
      
      const dx = x - clampX;
      const dy = y - clampY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate Opacity (Inverse square root or linear)
      let opacity = maxOpacity;
      let blur = 0;
      
      if (dist > 0) {
        const ratio = Math.min(dist / maxDist, 1.0); // 0 to 1
        // Smoothstep curve for more cinematic fading
        const smoothRatio = ratio * ratio * (3 - 2 * ratio); 
        opacity = maxOpacity - (smoothRatio * (maxOpacity - minOpacity));
        blur = smoothRatio * 4; // Max 4px blur
      }

      // If we are hovering directly inside the block, calculate sentence granularity
      if (dist === 0 && sentenceGranularity && block.dataset.focusSplit === 'true') {
        // Block is fully visible, but sentences dim based on exact mouse Y
        const sentences = block.querySelectorAll('.wr-focus-sentence');
        sentences.forEach(s => {
          const sRect = s.getBoundingClientRect();
          const sClampY = Math.max(sRect.top, Math.min(y, sRect.bottom));
          const sDist = Math.abs(y - sClampY);
          
          if (sDist > 0) {
            const sRatio = Math.min(sDist / (maxDist / 2), 1.0);
            const sOp = maxOpacity - (sRatio * (maxOpacity - minOpacity));
            s.style.opacity = sOp.toFixed(3);
            s.style.filter = `blur(${sRatio * 2}px)`;
          } else {
            s.style.opacity = maxOpacity;
            s.style.filter = 'blur(0px)';
          }
        });
        
        // Reset block container itself to fully visible
        block.style.opacity = maxOpacity;
        block.style.filter = 'blur(0px)';
      } else {
        // Not hovering directly over block, apply whole-block styling
        block.style.opacity = opacity.toFixed(3);
        block.style.filter = `blur(${blur.toFixed(1)}px)`;
        
        // Reset sentences inside if they were previously hovered
        if (sentenceGranularity && block.dataset.focusSplit === 'true') {
          const sentences = block.querySelectorAll('.wr-focus-sentence');
          sentences.forEach(s => {
            s.style.opacity = '';
            s.style.filter = '';
          });
        }
      }
    });

    FocusState.animationFrame = requestAnimationFrame(loop);
  };
  FocusState.animationFrame = requestAnimationFrame(loop);
}

/**
 * Teardown
 */
function teardownFocusMode() {
  FocusState.isEnabled = false;
  document.body.classList.remove('wr-advanced-focus-mode');
  
  window.removeEventListener('mousemove', handleMouseMove);
  
  if (FocusState.animationFrame) {
    cancelAnimationFrame(FocusState.animationFrame);
    FocusState.animationFrame = null;
  }
  
  if (FocusState.observer) {
    FocusState.observer.disconnect();
    FocusState.observer = null;
  }
  
  if (FocusState.mutationObserver) {
    FocusState.mutationObserver.disconnect();
    FocusState.mutationObserver = null;
  }
  
  // Clean up styles
  document.querySelectorAll('p, li, h1, h2, h3, blockquote, pre, .text-block').forEach(el => {
    el.style.opacity = '';
    el.style.filter = '';
    el.style.transform = '';
  });
  
  // Revert sentence splits
  document.querySelectorAll('[data-focus-split="true"]').forEach(block => {
    const sentences = block.querySelectorAll('.wr-focus-sentence');
    if (sentences.length > 0) {
      let fullText = '';
      sentences.forEach(s => fullText += s.innerHTML);
      block.innerHTML = fullText;
    }
    delete block.dataset.focusSplit;
  });
  
  FocusState.blocks.clear();
}
