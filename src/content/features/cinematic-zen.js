// src/content/features/cinematic-zen.js

/**
 * @fileoverview Advanced Cinematic Zen Engine
 * Replaces the simple CSS blurred background with a sophisticated color extraction
 * engine that dynamically creates smooth, animated gradient auras based on the 
 * images present in the document. As you scroll, the aura crossfades to match 
 * the dominant colors of the images in the viewport.
 */

const ZenState = {
  isEnabled: false,
  container: null,
  canvas: null,
  ctx: null,
  animationFrame: null,
  imageColors: new Map(),
  currentColors: [[30,30,30], [20,20,20], [10,10,10]],
  targetColors: [[30,30,30], [20,20,20], [10,10,10]],
  observer: null,
  lastScrollTop: 0,
  time: 0
};

/**
 * Main Initialization Hook
 */
window.WR_ApplyCinematicZen = function() {
  try {
    if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.zen) {
      if (ZenState.isEnabled) teardownZen();
      return;
    }

    if (!ZenState.isEnabled) {
      ZenState.isEnabled = true;
      buildZenDOM();
      scanImages();
      setupScrollListener();
      startAnimationLoop();
    }
  } catch (e) {
    console.error("Wider Recall: Critical error in Cinematic Zen", e);
  }
};

/**
 * Builds the Canvas DOM for the dynamic Aura
 */
function buildZenDOM() {
  // Remove old CSS-based background if it exists
  const oldBg = document.getElementById('wr-cinematic-bg');
  if (oldBg) oldBg.remove();

  ZenState.container = document.createElement('div');
  ZenState.container.id = 'wr-advanced-zen-bg';
  ZenState.container.style.cssText = `
    position: fixed;
    inset: -100px;
    z-index: -2;
    pointer-events: none;
    opacity: 0;
    transition: opacity 2s cubic-bezier(0.4, 0, 0.2, 1);
    background: #000;
  `;

  ZenState.canvas = document.createElement('canvas');
  ZenState.canvas.style.cssText = `
    width: 100%;
    height: 100%;
    filter: blur(120px) saturate(2);
    transform: translateZ(0);
  `;
  
  ZenState.container.appendChild(ZenState.canvas);
  document.body.appendChild(ZenState.container);
  
  ZenState.ctx = ZenState.canvas.getContext('2d', { alpha: false, desynchronized: true });
  handleResize();
  
  window.addEventListener('resize', handleResize);
  
  // Fade in
  requestAnimationFrame(() => {
    ZenState.container.style.opacity = '1';
  });
}

function handleResize() {
  if (!ZenState.canvas) return;
  // Use a very low resolution canvas for extreme performance (blur handles the rest)
  ZenState.canvas.width = window.innerWidth / 10;
  ZenState.canvas.height = window.innerHeight / 10;
}

/**
 * Scans document images and extracts their dominant colors using an offscreen canvas
 */
function scanImages() {
  const images = document.querySelectorAll('img[src*="ytimg"], [class*="summary"] img, article img, figure img');
  
  ZenState.observer = new IntersectionObserver((entries) => {
    // Find the most visible image to dictate the aura
    let mostVisible = null;
    let maxIntersection = 0;
    
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > maxIntersection) {
        maxIntersection = entry.intersectionRatio;
        mostVisible = entry.target;
      }
    });

    if (mostVisible) {
      if (ZenState.imageColors.has(mostVisible)) {
        ZenState.targetColors = ZenState.imageColors.get(mostVisible);
      } else {
        extractColorsAsync(mostVisible).then(colors => {
          if (colors) {
            ZenState.imageColors.set(mostVisible, colors);
            ZenState.targetColors = colors;
          }
        });
      }
    }
  }, { threshold: [0, 0.2, 0.5, 0.8, 1.0] });

  images.forEach(img => ZenState.observer.observe(img));
}

/**
 * Fallback scroll listener in case IntersectionObserver is slow
 */
function setupScrollListener() {
  const scrollTarget = document.querySelector(window.WR_SELECTORS.elements.scrollContainer) || window;
  scrollTarget.addEventListener('scroll', () => {
    const st = scrollTarget.scrollTop || window.scrollY;
    // Add dynamic movement based on scroll velocity
    const velocity = Math.min(Math.max((st - ZenState.lastScrollTop) * 0.1, -10), 10);
    ZenState.time += (velocity * 0.5);
    ZenState.lastScrollTop = st;
  }, { passive: true });
}

/**
 * Advanced Image Color Extraction
 * Takes an image, draws it to a tiny offscreen canvas, and extracts average colors
 * for the top, middle, and bottom sectors to create a tritone palette.
 */
async function extractColorsAsync(img) {
  return new Promise((resolve) => {
    if (!img.complete || img.naturalWidth === 0) {
      img.onload = () => resolve(processExtraction(img));
      img.onerror = () => resolve(null);
      return;
    }
    resolve(processExtraction(img));
  });
}

function processExtraction(img) {
  try {
    const off = document.createElement('canvas');
    const ctx = off.getContext('2d', { willReadFrequently: true });
    off.width = 1;
    off.height = 3;
    
    // Draw the image squeezed into a 1x3 pixel strip
    ctx.drawImage(img, 0, 0, 1, 3);
    const data = ctx.getImageData(0, 0, 1, 3).data;
    
    return [
      [data[0], data[1], data[2]],     // Top
      [data[4], data[5], data[6]],     // Middle
      [data[8], data[9], data[10]]     // Bottom
    ];
  } catch (e) {
    // Likely CORS error
    return null;
  }
}

/**
 * The high-performance render loop that crossfades colors and draws moving blobs
 */
function startAnimationLoop() {
  const loop = () => {
    if (!ZenState.isEnabled) return;

    // Linear interpolation for smooth color transitions (Easing)
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        ZenState.currentColors[i][j] += (ZenState.targetColors[i][j] - ZenState.currentColors[i][j]) * 0.02;
      }
    }

    renderAura();
    
    ZenState.time += 0.01;
    ZenState.animationFrame = requestAnimationFrame(loop);
  };
  ZenState.animationFrame = requestAnimationFrame(loop);
}

function renderAura() {
  const { ctx, canvas, currentColors, time } = ZenState;
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.fillStyle = '#0f0f13';
  ctx.fillRect(0, 0, w, h);

  // Draw 3 flowing blobs of color based on trigonometric functions
  const drawBlob = (colorIndex, radiusMultiplier, timeOffset, posX, posY) => {
    const rgb = currentColors[colorIndex];
    const r = Math.round(rgb[0]);
    const g = Math.round(rgb[1]);
    const b = Math.round(rgb[2]);
    
    ctx.beginPath();
    // Dynamic physics based on time
    const x = posX + Math.sin(time + timeOffset) * (w * 0.2);
    const y = posY + Math.cos(time * 0.8 + timeOffset) * (h * 0.2);
    const radius = Math.max(w, h) * radiusMultiplier;
    
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.8)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    
    ctx.fillStyle = grad;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  drawBlob(0, 0.8, 0, w * 0.2, h * 0.2); // Top Left Blob
  drawBlob(1, 0.9, 2, w * 0.8, h * 0.5); // Right Middle Blob
  drawBlob(2, 0.7, 4, w * 0.4, h * 0.8); // Bottom Blob
}

/**
 * Teardown / Cleanup
 */
function teardownZen() {
  if (ZenState.animationFrame) {
    cancelAnimationFrame(ZenState.animationFrame);
    ZenState.animationFrame = null;
  }
  if (ZenState.observer) {
    ZenState.observer.disconnect();
    ZenState.observer = null;
  }
  if (ZenState.container) {
    ZenState.container.style.opacity = '0';
    setTimeout(() => {
      if (ZenState.container) {
        ZenState.container.remove();
        ZenState.container = null;
      }
    }, 2000);
  }
  window.removeEventListener('resize', handleResize);
  ZenState.imageColors.clear();
}
