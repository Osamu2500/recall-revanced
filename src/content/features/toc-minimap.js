// src/content/features/toc-minimap.js

/**
 * @fileoverview Advanced Canvas-based TOC Minimap Engine
 * This module renders a high-performance, interactive, scaled-down visual representation 
 * of the entire document structure using HTML5 Canvas, similar to code editor minimaps.
 * It tracks scroll positions, allows drag-to-scroll, and dynamically updates on DOM mutations.
 */

let minimapState = {
  container: null,
  canvas: null,
  ctx: null,
  viewport: null,
  isDragging: false,
  startY: 0,
  startScrollTop: 0,
  scale: 0.05,
  lastHeight: 0,
  resizeObserver: null,
  mutationObserver: null,
  scrollListener: null,
  debounceTimer: null,
  renderQueue: [],
  themeColors: {
    bg: 'rgba(30, 30, 30, 0.8)',
    text: 'rgba(200, 200, 200, 0.4)',
    h1: 'rgba(139, 92, 246, 0.9)',
    h2: 'rgba(167, 139, 250, 0.8)',
    h3: 'rgba(196, 181, 253, 0.7)',
    code: 'rgba(50, 200, 100, 0.5)',
    img: 'rgba(100, 150, 255, 0.6)',
    viewport: 'rgba(255, 255, 255, 0.1)',
    viewportBorder: 'rgba(255, 255, 255, 0.3)'
  }
};

/**
 * Main Initialization Hook
 */
window.WR_InitMinimap = function() {
  try {
    if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.toc) {
      destroyMinimap();
      return;
    }

    const editor = document.querySelector(window.WR_SELECTORS.elements.editor);
    if (!editor) return;

    // Only render if document is sufficiently long
    if (editor.scrollHeight < window.innerHeight * 1.5) {
      destroyMinimap();
      return;
    }

    if (!minimapState.container) {
      buildMinimapDOM();
      attachEventListeners(editor);
    }

    scheduleRender(editor);

  } catch (e) {
    console.error("Wider Recall: Critical error in Advanced Minimap", e);
  }
};

/**
 * Constructs the Minimap DOM Elements
 */
function buildMinimapDOM() {
  const container = document.createElement('div');
  container.id = 'wr-advanced-minimap';
  container.style.cssText = `
    position: fixed;
    right: 20px;
    top: 80px;
    width: 120px;
    height: calc(100vh - 120px);
    background: ${minimapState.themeColors.bg};
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    overflow: hidden;
    z-index: 9999;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
    transform: translateX(20px);
    pointer-events: auto;
  `;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  `;

  const viewport = document.createElement('div');
  viewport.className = 'wr-minimap-viewport';
  viewport.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    background: ${minimapState.themeColors.viewport};
    border: 1px solid ${minimapState.themeColors.viewportBorder};
    border-radius: 4px;
    cursor: grab;
    z-index: 2;
    transition: background 0.2s ease;
  `;

  container.appendChild(canvas);
  container.appendChild(viewport);
  document.body.appendChild(container);

  minimapState.container = container;
  minimapState.canvas = canvas;
  minimapState.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  minimapState.viewport = viewport;

  // Reveal animation
  requestAnimationFrame(() => {
    container.style.opacity = '1';
    container.style.transform = 'translateX(0)';
  });
}

/**
 * Attaches advanced interaction events
 */
function attachEventListeners(editor) {
  const { container, canvas, viewport } = minimapState;
  const scrollTarget = document.querySelector(window.WR_SELECTORS.elements.scrollContainer) || window;

  // Drag functionality for the viewport slider
  viewport.addEventListener('mousedown', (e) => {
    e.preventDefault();
    minimapState.isDragging = true;
    minimapState.startY = e.clientY;
    minimapState.startScrollTop = scrollTarget.scrollTop || window.scrollY;
    viewport.style.cursor = 'grabbing';
    viewport.style.background = 'rgba(255, 255, 255, 0.2)';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!minimapState.isDragging) return;
    e.preventDefault();
    
    const deltaY = e.clientY - minimapState.startY;
    const scrollHeight = getScrollHeight();
    const visibleHeight = getVisibleHeight();
    const mapHeight = container.clientHeight;
    
    // Calculate scroll ratio
    const ratio = scrollHeight / mapHeight;
    const newScrollTop = minimapState.startScrollTop + (deltaY * ratio);
    
    scrollTarget.scrollTo({ top: newScrollTop, behavior: 'instant' });
    updateViewportPosition();
  });

  window.addEventListener('mouseup', () => {
    if (minimapState.isDragging) {
      minimapState.isDragging = false;
      viewport.style.cursor = 'grab';
      viewport.style.background = minimapState.themeColors.viewport;
      document.body.style.userSelect = '';
    }
  });

  // Click on canvas to jump
  canvas.addEventListener('click', (e) => {
    if (minimapState.isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    
    const scrollHeight = getScrollHeight();
    const visibleHeight = getVisibleHeight();
    const mapHeight = container.clientHeight;
    
    // Center the viewport on click
    const viewportPixelHeight = (visibleHeight / scrollHeight) * mapHeight;
    const targetY = clickY - (viewportPixelHeight / 2);
    const ratio = scrollHeight / mapHeight;
    
    scrollTarget.scrollTo({ top: targetY * ratio, behavior: 'smooth' });
  });

  // Scroll sync
  minimapState.scrollListener = () => {
    if (!minimapState.isDragging) {
      requestAnimationFrame(updateViewportPosition);
    }
  };
  scrollTarget.addEventListener('scroll', minimapState.scrollListener, { passive: true });

  // Resize Observer for dynamic rendering
  minimapState.resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      if (Math.abs(entry.contentRect.height - minimapState.lastHeight) > 50) {
        minimapState.lastHeight = entry.contentRect.height;
        scheduleRender(editor);
      }
    }
  });
  minimapState.resizeObserver.observe(editor);

  // Mutation Observer for content changes
  minimapState.mutationObserver = new MutationObserver((mutations) => {
    let shouldRender = false;
    for (let m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        shouldRender = true;
        break;
      }
    }
    if (shouldRender) scheduleRender(editor);
  });
  minimapState.mutationObserver.observe(editor, { childList: true, subtree: true });
}

/**
 * Schedules a canvas render using debouncing to preserve performance
 */
function scheduleRender(editor) {
  if (minimapState.debounceTimer) clearTimeout(minimapState.debounceTimer);
  minimapState.debounceTimer = setTimeout(() => {
    performRender(editor);
  }, 300);
}

/**
 * The core rendering engine for the Minimap
 */
function performRender(editor) {
  const { container, canvas, ctx } = minimapState;
  if (!container || !canvas || !ctx) return;

  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  ctx.clearRect(0, 0, rect.width, rect.height);
  
  const scrollHeight = getScrollHeight();
  minimapState.scale = rect.height / scrollHeight;
  
  // Extract structural blocks
  const blocks = editor.querySelectorAll('h1, h2, h3, p, pre, code, img, ul, ol, blockquote');
  
  const editorRect = editor.getBoundingClientRect();
  const absoluteTop = editorRect.top + (document.querySelector(window.WR_SELECTORS.elements.scrollContainer)?.scrollTop || window.scrollY);

  // Batch rendering operations
  ctx.beginPath();
  
  blocks.forEach(block => {
    const br = block.getBoundingClientRect();
    const top = (br.top + (document.querySelector(window.WR_SELECTORS.elements.scrollContainer)?.scrollTop || window.scrollY)) - absoluteTop;
    const height = br.height;
    
    // Map to canvas coordinates
    const y = top * minimapState.scale;
    const h = Math.max(height * minimapState.scale, 1); // Ensure at least 1px height
    
    // Determine color and style based on tag
    const tag = block.tagName.toLowerCase();
    
    if (tag === 'h1') {
      drawRect(ctx, 10, y, rect.width - 20, Math.max(h, 4), minimapState.themeColors.h1, true);
    } else if (tag === 'h2') {
      drawRect(ctx, 15, y, rect.width - 30, Math.max(h, 3), minimapState.themeColors.h2, true);
    } else if (tag === 'h3') {
      drawRect(ctx, 20, y, rect.width - 40, Math.max(h, 2), minimapState.themeColors.h3, false);
    } else if (tag === 'pre' || tag === 'code') {
      drawRect(ctx, 25, y, rect.width - 50, h, minimapState.themeColors.code, false);
      // Simulate syntax lines
      drawSyntaxLines(ctx, 25, y, rect.width - 50, h);
    } else if (tag === 'img') {
      drawRect(ctx, 20, y, rect.width - 40, h, minimapState.themeColors.img, true);
      // Draw image cross icon
      drawIcon(ctx, rect.width/2, y + h/2, 'img');
    } else if (tag === 'blockquote') {
      drawRect(ctx, 25, y, 2, h, minimapState.themeColors.h1, false);
      drawTextLines(ctx, 35, y, rect.width - 60, h, minimapState.themeColors.text);
    } else {
      // Paragraphs and lists
      const offset = (tag === 'ul' || tag === 'ol') ? 35 : 20;
      drawTextLines(ctx, offset, y, rect.width - (offset * 2), h, minimapState.themeColors.text);
    }
  });

  updateViewportPosition();
}

/**
 * Primitive drawing function for solid blocks
 */
function drawRect(ctx, x, y, w, h, color, rounded = false) {
  ctx.fillStyle = color;
  if (rounded && h > 4) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 2);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

/**
 * Simulates text lines for paragraphs
 */
function drawTextLines(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  const lineSpacing = 3;
  const lineHeight = 1;
  const maxLines = Math.floor(h / lineSpacing);
  
  for (let i = 0; i < maxLines; i++) {
    const lineY = y + (i * lineSpacing);
    // Randomize line width slightly for realistic text look
    const randW = w * (0.8 + (Math.random() * 0.2));
    ctx.fillRect(x, lineY, randW, lineHeight);
  }
}

/**
 * Simulates colored syntax highlighting lines for code blocks
 */
function drawSyntaxLines(ctx, x, y, w, h) {
  const lineSpacing = 4;
  const lineHeight = 1.5;
  const maxLines = Math.floor(h / lineSpacing);
  const colors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa'];
  
  for (let i = 0; i < maxLines; i++) {
    const lineY = y + (i * lineSpacing) + 1;
    // Draw 1-3 tokens per line
    let currentX = x + 4;
    const tokens = 1 + Math.floor(Math.random() * 3);
    
    for (let t = 0; t < tokens; t++) {
      if (currentX > x + w - 10) break;
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      const tokW = 10 + (Math.random() * 30);
      ctx.fillRect(currentX, lineY, Math.min(tokW, (x + w) - currentX - 4), lineHeight);
      currentX += tokW + 4;
    }
  }
}

/**
 * Draws simple generic icons (like image placeholders)
 */
function drawIcon(ctx, cx, cy, type) {
  if (type === 'img') {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 10);
    ctx.lineTo(cx + 10, cy + 10);
    ctx.moveTo(cx + 10, cy - 10);
    ctx.lineTo(cx - 10, cy + 10);
    ctx.stroke();
  }
}

/**
 * Synchronizes the floating viewport box with the actual window scroll
 */
function updateViewportPosition() {
  const { container, viewport } = minimapState;
  if (!container || !viewport) return;

  const scrollTarget = document.querySelector(window.WR_SELECTORS.elements.scrollContainer) || window;
  const scrollTop = scrollTarget.scrollTop || window.scrollY;
  const scrollHeight = getScrollHeight();
  const visibleHeight = getVisibleHeight();
  const mapHeight = container.clientHeight;

  // Calculate viewport size and position
  const viewportHeight = Math.max((visibleHeight / scrollHeight) * mapHeight, 20); // min 20px
  const maxScrollTop = scrollHeight - visibleHeight;
  
  let topOffset = 0;
  if (maxScrollTop > 0) {
    const scrollRatio = scrollTop / maxScrollTop;
    const maxViewportTop = mapHeight - viewportHeight;
    topOffset = scrollRatio * maxViewportTop;
  }

  viewport.style.height = `${viewportHeight}px`;
  viewport.style.transform = `translateY(${topOffset}px)`;
}

/**
 * Helpers for robust scroll calculations across different DOM structures
 */
function getScrollHeight() {
  const scrollTarget = document.querySelector(window.WR_SELECTORS.elements.scrollContainer);
  if (scrollTarget) return scrollTarget.scrollHeight;
  return Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.body.clientHeight,
    document.documentElement.clientHeight
  );
}

function getVisibleHeight() {
  const scrollTarget = document.querySelector(window.WR_SELECTORS.elements.scrollContainer);
  if (scrollTarget) return scrollTarget.clientHeight;
  return window.innerHeight;
}

/**
 * Teardown / Cleanup
 */
function destroyMinimap() {
  if (minimapState.container) {
    minimapState.container.style.opacity = '0';
    minimapState.container.style.transform = 'translateX(20px)';
    
    setTimeout(() => {
      if (minimapState.container) {
        minimapState.container.remove();
        minimapState.container = null;
      }
    }, 300); // Wait for transition
  }

  if (minimapState.resizeObserver) {
    minimapState.resizeObserver.disconnect();
    minimapState.resizeObserver = null;
  }
  
  if (minimapState.mutationObserver) {
    minimapState.mutationObserver.disconnect();
    minimapState.mutationObserver = null;
  }

  if (minimapState.scrollListener) {
    const scrollTarget = document.querySelector(window.WR_SELECTORS.elements.scrollContainer) || window;
    scrollTarget.removeEventListener('scroll', minimapState.scrollListener);
    minimapState.scrollListener = null;
  }
}
