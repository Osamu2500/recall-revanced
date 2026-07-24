// src/content/features/media-tools.js

/**
 * @fileoverview Advanced Media Engine (PiP, Speed Control, Filters)
 * Injects a highly sophisticated media controller wrapper around HTML5 Videos, 
 * YouTube Iframes, and Audio elements. Implements physics-based drag-and-drop, 
 * edge snapping, keyboard shortcuts, and custom UI overlays.
 */

const MediaState = {
  isEnabled: false,
  observer: null,
  activePlayers: new Map(),
  dragState: {
    isDown: false,
    el: null,
    startX: 0,
    startY: 0,
    velocityX: 0,
    velocityY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    animationFrame: null
  },
  config: {
    playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3],
    snapThreshold: 40,
    physicsFriction: 0.92,
    physicsBounce: 0.4
  }
};

/**
 * Global Init Hook
 */
window.WR_SetupMediaObserver = function() {
  try {
    if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.media) {
      if (MediaState.isEnabled) teardownMediaTools();
      return;
    }

    // Only apply to item pages where media makes sense
    if (window.WR_API && window.WR_API.getPage() !== 'item') return;

    if (!MediaState.isEnabled) {
      MediaState.isEnabled = true;
      initGlobalDragListeners();
      scanForMedia();
      
      // Periodically scan for dynamically injected media (e.g. React routers)
      setInterval(scanForMedia, 2000);
    }
  } catch (e) {
    console.error("Wider Recall: Critical error in Media Tools Engine", e);
  }
};

/**
 * Teardown
 */
function teardownMediaTools() {
  MediaState.isEnabled = false;
  if (MediaState.observer) {
    MediaState.observer.disconnect();
    MediaState.observer = null;
  }
  
  MediaState.activePlayers.forEach((wrapper, player) => {
    wrapper.remove(); // Removes the custom UI
    player.classList.remove('wr-floating-media', 'wr-media-initialized');
    player.style.cssText = '';
  });
  MediaState.activePlayers.clear();
}

/**
 * Scans the DOM for valid media players and injects the Advanced Wrapper
 */
function scanForMedia() {
  if (!MediaState.isEnabled) return;

  const selectors = [
    'iframe[src*="youtube.com"]',
    'iframe[src*="youtube-nocookie.com"]',
    'iframe[src*="vimeo.com"]',
    'video',
    'audio'
  ];

  const players = document.querySelectorAll(selectors.join(', '));
  
  players.forEach(player => {
    if (player.classList.contains('wr-media-initialized')) return;
    
    // Find the closest logical container to wrap (e.g. Notion's weird div wrappers)
    const container = player.closest('div:has(> iframe), div:has(> video), .css-1xdkvt0, figure') || player;
    if (container.classList.contains('wr-media-initialized')) return;

    initializeAdvancedPlayer(player, container);
  });
}

/**
 * Builds the custom UI and IntersectionObserver for a media element
 */
function initializeAdvancedPlayer(player, container) {
  container.classList.add('wr-media-initialized');
  player.classList.add('wr-media-initialized');

  // 1. Create the Custom UI Wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'wr-media-advanced-wrapper';
  wrapper.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    width: 100%;
    height: 40px;
    background: rgba(15, 15, 15, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 12px 12px 0 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    z-index: 99999;
    pointer-events: none;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.1);
    border-bottom: none;
  `;

  // UI Components
  const dragHandle = document.createElement('div');
  dragHandle.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
  dragHandle.style.cssText = `color: #888; cursor: grab; pointer-events: auto; display: flex; align-items: center;`;

  const speedControl = document.createElement('div');
  speedControl.className = 'wr-media-speed';
  speedControl.innerHTML = `
    <button class="wr-speed-down" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">-</button>
    <span class="wr-speed-display" style="color:#fff;font-family:monospace;min-width:40px;display:inline-block;text-align:center;">1.0x</span>
    <button class="wr-speed-up" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">+</button>
  `;
  speedControl.style.cssText = `pointer-events: auto; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 8px;`;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `background:none;border:none;color:#ff5555;cursor:pointer;font-size:16px;pointer-events:auto;`;

  wrapper.appendChild(dragHandle);
  wrapper.appendChild(speedControl);
  wrapper.appendChild(closeBtn);
  
  // Need relative positioning on container to mount absolute wrapper
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  container.appendChild(wrapper);

  // 2. State & Events
  const state = {
    speed: 1.0,
    isFloating: false
  };

  const updateSpeed = (delta) => {
    const currentIndex = MediaState.config.playbackRates.indexOf(state.speed);
    let nextIndex = currentIndex + delta;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= MediaState.config.playbackRates.length) nextIndex = MediaState.config.playbackRates.length - 1;
    
    state.speed = MediaState.config.playbackRates[nextIndex];
    wrapper.querySelector('.wr-speed-display').textContent = state.speed.toFixed(1) + 'x';

    // Apply speed
    if (player.tagName === 'VIDEO' || player.tagName === 'AUDIO') {
      player.playbackRate = state.speed;
    } else {
      // It's a YouTube iframe, attempt postMessage API
      player.contentWindow.postMessage(JSON.stringify({
        event: "command",
        func: "setPlaybackRate",
        args: [state.speed]
      }), "*");
    }
  };

  wrapper.querySelector('.wr-speed-down').onclick = () => updateSpeed(-1);
  wrapper.querySelector('.wr-speed-up').onclick = () => updateSpeed(1);
  closeBtn.onclick = () => {
    container.classList.remove('wr-floating-media');
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translateY(10px)';
    state.isFloating = false;
  };

  MediaState.activePlayers.set(container, wrapper);

  // 3. Intersection Observer (The PiP Trigger)
  if (!MediaState.observer) {
    MediaState.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const targetContainer = entry.target.closest('.wr-media-initialized') || entry.target;
        const targetWrapper = MediaState.activePlayers.get(targetContainer);
        if (!targetWrapper) return;

        // If the player scrolls out of view upwards, snap it to PiP
        if (!entry.isIntersecting && entry.boundingClientRect.bottom < 150) {
          targetContainer.classList.add('wr-floating-media');
          targetWrapper.style.opacity = '1';
          targetWrapper.style.transform = 'translateY(0)';
          
          // Initial PiP Positioning (Bottom Right)
          if (!targetContainer.style.left && !targetContainer.style.top) {
            targetContainer.style.left = (window.innerWidth - targetContainer.offsetWidth - 32) + 'px';
            targetContainer.style.top = (window.innerHeight - targetContainer.offsetHeight - 32) + 'px';
          }
        } else if (entry.isIntersecting && entry.boundingClientRect.top > 0) {
          // It scrolled back into view normally
          targetContainer.classList.remove('wr-floating-media');
          targetWrapper.style.opacity = '0';
          targetWrapper.style.transform = 'translateY(10px)';
          // Reset positioning
          targetContainer.style.left = '';
          targetContainer.style.top = '';
          targetContainer.style.right = '';
          targetContainer.style.bottom = '';
        }
      });
    }, { threshold: [0, 0.1], rootMargin: "-120px 0px 0px 0px" });
  }

  // We observe an anchor placed right above the player to know when it leaves the viewport
  let anchor = container.previousElementSibling;
  if (!anchor || !anchor.classList.contains('wr-media-anchor')) {
    anchor = document.createElement('div');
    anchor.className = 'wr-media-anchor';
    anchor.style.height = '1px';
    container.parentNode.insertBefore(anchor, container);
  }
  MediaState.observer.observe(anchor);

  // 4. Attach physics drag to the handle
  attachPhysicsDrag(dragHandle, container);
}

/**
 * Highly advanced physics-based drag and drop with velocity tracking
 */
function attachPhysicsDrag(handle, container) {
  handle.onmousedown = (e) => {
    if (!container.classList.contains('wr-floating-media')) return;
    e.preventDefault();
    
    if (MediaState.dragState.animationFrame) {
      cancelAnimationFrame(MediaState.dragState.animationFrame);
    }

    MediaState.dragState.isDown = true;
    MediaState.dragState.el = container;
    
    // Calculate accurate start offset based on current transform/left/top
    const rect = container.getBoundingClientRect();
    MediaState.dragState.startX = e.clientX - rect.left;
    MediaState.dragState.startY = e.clientY - rect.top;
    
    MediaState.dragState.lastX = e.clientX;
    MediaState.dragState.lastY = e.clientY;
    MediaState.dragState.lastTime = performance.now();
    
    handle.style.cursor = 'grabbing';
    container.style.transition = 'none'; // Disable CSS transitions during drag
    document.body.style.userSelect = 'none';
  };
}

/**
 * Global drag listeners (bound once)
 */
function initGlobalDragListeners() {
  window.addEventListener('mousemove', (e) => {
    if (!MediaState.dragState.isDown || !MediaState.dragState.el) return;
    
    const el = MediaState.dragState.el;
    
    // Calculate new position
    const newX = e.clientX - MediaState.dragState.startX;
    const newY = e.clientY - MediaState.dragState.startY;
    
    el.style.left = newX + 'px';
    el.style.top = newY + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';

    // Calculate velocity for inertia
    const now = performance.now();
    const dt = Math.max(now - MediaState.dragState.lastTime, 1);
    MediaState.dragState.velocityX = (e.clientX - MediaState.dragState.lastX) / dt;
    MediaState.dragState.velocityY = (e.clientY - MediaState.dragState.lastY) / dt;
    
    MediaState.dragState.lastX = e.clientX;
    MediaState.dragState.lastY = e.clientY;
    MediaState.dragState.lastTime = now;
  });

  window.addEventListener('mouseup', () => {
    if (!MediaState.dragState.isDown) return;
    
    MediaState.dragState.isDown = false;
    document.body.style.userSelect = '';
    
    const el = MediaState.dragState.el;
    const handle = el.querySelector('.wr-media-advanced-wrapper > div:first-child');
    if (handle) handle.style.cursor = 'grab';
    
    // Start Inertia / Edge Snapping Physics Engine
    startPhysicsEngine(el);
  });
}

/**
 * Calculates inertia and bounds snapping using requestAnimationFrame
 */
function startPhysicsEngine(el) {
  let { velocityX, velocityY } = MediaState.dragState;
  const { physicsFriction, physicsBounce, snapThreshold } = MediaState.config;
  
  const tick = () => {
    if (MediaState.dragState.isDown) return; // User grabbed it again

    let rect = el.getBoundingClientRect();
    let currentX = rect.left;
    let currentY = rect.top;
    
    // Apply velocity
    currentX += velocityX * 16; // approx 60fps delta
    currentY += velocityY * 16;
    
    // Apply Friction
    velocityX *= physicsFriction;
    velocityY *= physicsFriction;
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    const elW = rect.width;
    const elH = rect.height;

    // Bounds checking & Bouncing
    if (currentX < snapThreshold) {
      currentX = 16;
      velocityX *= -physicsBounce;
    } else if (currentX + elW > w - snapThreshold) {
      currentX = w - elW - 16;
      velocityX *= -physicsBounce;
    }

    if (currentY < snapThreshold + 40) { // +40 for the wrapper height
      currentY = 16 + 40;
      velocityY *= -physicsBounce;
    } else if (currentY + elH > h - snapThreshold) {
      currentY = h - elH - 16;
      velocityY *= -physicsBounce;
    }

    el.style.left = currentX + 'px';
    el.style.top = currentY + 'px';

    // Stop animation if velocity is negligible
    if (Math.abs(velocityX) > 0.05 || Math.abs(velocityY) > 0.05) {
      MediaState.dragState.animationFrame = requestAnimationFrame(tick);
    } else {
      // Snap to closest edge to be neat
      el.style.transition = 'left 0.3s ease, top 0.3s ease';
      if (currentX < w / 2) {
        el.style.left = '16px';
      } else {
        el.style.left = (w - elW - 16) + 'px';
      }
      setTimeout(() => { el.style.transition = 'none'; }, 300);
    }
  };

  MediaState.dragState.animationFrame = requestAnimationFrame(tick);
}
