// src/content/features/cinematic-zen.js

window.WR_ApplyCinematicZen = function() {
  const oldBg = document.getElementById('wr-cinematic-bg');
  if (oldBg) {
    oldBg.style.opacity = '0';
    setTimeout(() => oldBg.remove(), 1000);
  }
  
  if (!window.WR_STATE.enabled || !window.WR_STATE.zen) return;
  
  setTimeout(() => {
    // Attempt to extract the primary image on the page
    const thumb = document.querySelector('img[src*="ytimg"], [class*="summary"] img, article img');
    if (thumb && thumb.src) {
      const bg = document.createElement('div');
      bg.id = 'wr-cinematic-bg';
      bg.style.backgroundImage = `url(${thumb.src})`;
      // V2 feature: smooth 2 second fade in and more dramatic blur
      bg.style.position = 'fixed';
      bg.style.inset = '-100px';
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center';
      bg.style.filter = 'blur(100px) brightness(0.2) saturate(2)';
      bg.style.zIndex = '-1';
      bg.style.pointerEvents = 'none';
      bg.style.opacity = '0';
      bg.style.transition = 'opacity 2s ease-in-out';
      document.body.appendChild(bg);
      
      // Trigger reflow to ensure transition runs
      bg.getBoundingClientRect();
      bg.style.opacity = '1';
    }
  }, 500);
};
