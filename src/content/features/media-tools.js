// src/content/features/media-tools.js

let mediaObserver = null;
let lightboxEl = null;

// ── Image Lightbox V2 ────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (!window.WR_STATE.enabled || !window.WR_STATE.lightbox) return;
  if (e.target.tagName === 'IMG' && e.target.closest('.ProseMirror')) {
    e.preventDefault(); e.stopPropagation();
    
    if (lightboxEl) lightboxEl.remove();
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'wr-lightbox';
    lightboxEl.innerHTML = `
      <div class="wr-lightbox-bg"></div>
      <img src="${e.target.src}" style="transform: scale(1); cursor: grab;" id="wr-lightbox-img" />
      <div class="wr-lightbox-close">✖</div>
    `;
    document.body.appendChild(lightboxEl);
    
    const img = lightboxEl.querySelector('#wr-lightbox-img');
    let scale = 1;
    let isPanning = false;
    let startX, startY;
    
    // Zoom with wheel
    lightboxEl.onwheel = (we) => {
      we.preventDefault();
      scale += we.deltaY * -0.005;
      scale = Math.min(Math.max(.125, scale), 4);
      img.style.transform = `scale(${scale})`;
    };
    
    // Pan logic
    img.onmousedown = (me) => {
      me.preventDefault();
      isPanning = true;
      startX = me.clientX - (parseInt(img.style.left) || 0);
      startY = me.clientY - (parseInt(img.style.top) || 0);
      img.style.cursor = 'grabbing';
      img.style.position = 'relative';
    };
    const onMouseMove = (me) => {
      if (!isPanning) return;
      img.style.left = (me.clientX - startX) + 'px';
      img.style.top = (me.clientY - startY) + 'px';
    };
    
    const onMouseUp = () => {
      if (isPanning) { isPanning = false; img.style.cursor = 'grab'; }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    
    const close = () => { 
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      lightboxEl.remove(); 
      lightboxEl = null; 
    };
    lightboxEl.querySelector('.wr-lightbox-bg').onclick = close;
    lightboxEl.querySelector('.wr-lightbox-close').onclick = close;
  }
});

// ── Sticky Media Player (Draggable & Snap) ──────────────────────────────────
window.WR_SetupMediaObserver = function() {
  if (mediaObserver) { mediaObserver.disconnect(); mediaObserver = null; }
  document.querySelectorAll('.wr-floating-media').forEach(el => el.classList.remove('wr-floating-media'));

  if (!window.WR_STATE.enabled || !window.WR_STATE.media || window.WR_API.getPage() !== 'item') return;

  setTimeout(() => {
    const players = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="vimeo.com"], video, audio');
    if (players.length === 0) return;

    const player = players[0].closest('div:has(> iframe), div:has(> video), .css-1xdkvt0') || players[0];
    
    mediaObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting && entry.boundingClientRect.bottom < 100) {
          player.classList.add('wr-floating-media');
          makeDraggable(player);
        } else {
          player.classList.remove('wr-floating-media');
          player.style.transform = ''; // reset drag
          player.style.left = '';
          player.style.top = '';
          player.style.right = '';
          player.style.bottom = '';
        }
      });
    }, { threshold: [0, 0.1], rootMargin: "-80px 0px 0px 0px" });

    let anchor = player.previousElementSibling;
    if (!anchor || !anchor.classList.contains('wr-media-anchor')) {
      anchor = document.createElement('div');
      anchor.className = 'wr-media-anchor';
      player.parentNode.insertBefore(anchor, player);
    }
    mediaObserver.observe(anchor);
  }, 1000);
};

function makeDraggable(el) {
  let isDown = false;
  let startX, startY;
  
  el.onmousedown = (e) => {
    if (e.target.tagName === 'IFRAME') return; // let iframe handle its own clicks
    isDown = true;
    startX = e.clientX - (parseInt(el.style.left) || 0);
    startY = e.clientY - (parseInt(el.style.top) || 0);
    el.style.cursor = 'grabbing';
  };
  
  window.onmousemove = (e) => {
    if (!isDown) return;
    el.style.left = (e.clientX - startX) + 'px';
    el.style.top = (e.clientY - startY) + 'px';
    el.style.right = 'auto'; // override CSS right
    el.style.bottom = 'auto'; // override CSS bottom
  };
  
  window.onmouseup = () => {
    if (!isDown) return;
    isDown = false;
    el.style.cursor = 'grab';
    
    // Edge snapping
    const rect = el.getBoundingClientRect();
    if (rect.left < window.innerWidth / 2) {
      el.style.left = '24px';
    } else {
      el.style.left = (window.innerWidth - rect.width - 24) + 'px';
    }
  };
}
