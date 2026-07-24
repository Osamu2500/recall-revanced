'use strict';

/**
 * Wider Recall - Home Cards Interceptor
 * Replaces native MUI cards on the homepage with a flawless custom grid 
 * so the Immersive Glass Card CSS applies perfectly without hacks.
 */

window.WR_HOME_CARDS = {
  observer: null,
  imageObservers: [],
  active: false,
  
  injectCss() {
    if (document.getElementById('wr-home-cards-css')) return;
    const style = document.createElement('style');
    style.id = 'wr-home-cards-css';
    style.textContent = `
      /* Hide native cards visually, but keep them in the DOM to trigger lazy loading */
      body[data-wr-enabled="true"][data-wr-immersive-cards="true"] .wr-original-home-card {
        visibility: hidden !important;
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Metadata Tags */
      body[data-wr-immersive-cards="true"] .wr-grid-card .wr-card-metadata {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
        pointer-events: none !important;
      }
      body[data-wr-immersive-cards="true"] .wr-grid-card .wr-card-tag {
        display: inline-flex;
        align-items: center;
        font-size: 0.65rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.9);
        background: rgba(255, 255, 255, 0.2);
        padding: 3px 8px;
        border-radius: 12px;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }
      body[data-wr-immersive-cards="true"] .wr-grid-card .wr-card-tag svg {
        fill: currentColor;
      }

      /* Home Grid Container */
      body[data-wr-enabled="true"][data-wr-immersive-cards="true"] .wr-home-grid-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) !important;
        gap: 24px;
        width: 100%;
        padding: 20px 0;
        animation: wr-grid-fade-in 0.4s ease-out forwards;
      }
      
      body:not([data-wr-enabled="true"]) .wr-home-grid-container,
      body:not([data-wr-immersive-cards="true"]) .wr-home-grid-container {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  },
  
  init() {
    this.injectCss();
    this.active = true;
    
    this.startObservation();
    
    this._fallbackInterval = setInterval(() => {
      if (this.active) this.checkAndInject();
    }, 1000);
  },
  
  cleanup() {
    this.active = false;
    if (this.observer) this.observer.disconnect();
    if (this.imageObservers) {
      this.imageObservers.forEach(obs => obs.disconnect());
      this.imageObservers = [];
    }
    document.querySelectorAll('.wr-home-grid-container').forEach(el => el.remove());
    if (this._fallbackInterval) {
      clearInterval(this._fallbackInterval);
    }
    this.restoreOriginalUI();
  },

  startObservation() {
    if (this.observer) this.observer.disconnect();
    
    let debounceTimer;
    this.observer = new MutationObserver((mutations) => {
      if (!this.active) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this.checkAndInject(), 150);
    });

    const root = document.querySelector('main') || document.body;
    this.observer.observe(root, { childList: true, subtree: true, attributes: false });
  },

  restoreOriginalUI() {
    document.querySelectorAll('.wr-home-grid-container').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('.wr-original-home-card').forEach(el => {
      el.classList.remove('wr-original-home-card');
    });
  },

  checkAndInject() {
    if (!this.active) return;

    // Only apply on Homepage
    if (!window.WR_SELECTORS.pages.isHomeGrid(window.location.pathname)) {
      this.restoreOriginalUI();
      return;
    }

    const isImmersive = document.body.getAttribute('data-wr-immersive-cards') === 'true' && document.body.getAttribute('data-wr-enabled') === 'true';
    if (!isImmersive) {
      this.restoreOriginalUI();
      return;
    }

    this.scanAndProcessGrids();
  },

  scanAndProcessGrids() {
    const mainArea = document.querySelector('main') || document.getElementById('navigation-scroll-container') || document.body;
    
    // Performance optimization: Only check elements that have children and aren't our custom elements
    const allDivs = Array.from(mainArea.querySelectorAll('div')).filter(div => {
       if (div.children.length === 0) return false;
       const cl = div.classList;
       if (cl.contains('wr-home-grid-container') || cl.contains('wr-grid-card') || cl.contains('wr-original-home-card')) return false;
       return true;
    });
    
    const nativeGrids = [];
    
    for (const div of allDivs) {
      // Fast path: If already processed, it has our custom grid right before it.
      // This skips getComputedStyle which causes massive layout thrashing on scroll.
      const prev = div.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains('wr-home-grid-container')) {
         nativeGrids.push(div);
         continue;
      }
      
      const style = window.getComputedStyle(div);
      if (style.display === 'grid') {
        if (style.gridTemplateColumns && (style.gridTemplateColumns.includes('px') || style.gridTemplateColumns.includes('rem') || style.gridTemplateColumns.includes('fr'))) {
          const rawCards = Array.from(div.children).filter(child => child.tagName !== 'STYLE' && child.tagName !== 'SCRIPT');
          if (rawCards.length > 0) {
             nativeGrids.push(div);
          }
        }
      }
    }

    if (nativeGrids.length === 0) return;

    if (this.observer) this.observer.disconnect();

    for (const nativeGrid of nativeGrids) {
       this.processGrid(nativeGrid);
    }

    const root = document.querySelector('main') || document.body;
    this.observer.observe(root, { childList: true, subtree: true, attributes: false });
  },

  processGrid(nativeGrid) {
    const rawCards = Array.from(nativeGrid.children).filter(child => child.tagName !== 'STYLE' && child.tagName !== 'SCRIPT' && !child.classList.contains('wr-home-grid-container'));
    if (rawCards.length === 0) return;

    let customGrid = nativeGrid.previousElementSibling;
    if (!customGrid || !customGrid.classList.contains('wr-home-grid-container')) {
       customGrid = document.createElement('div');
       customGrid.className = 'wr-home-grid-container';
       nativeGrid.parentNode.insertBefore(customGrid, nativeGrid);
    }
    customGrid.style.display = 'grid';

    let needsUpdate = false;
    const lastCount = parseInt(customGrid.getAttribute('data-wr-last-count') || '0', 10);
    
    if (lastCount !== rawCards.length) {
      needsUpdate = true;
    }

    if (!needsUpdate && rawCards.length > 0) {
       const firstNativeText = rawCards[0].textContent || '';
       const savedNativeText = customGrid.getAttribute('data-wr-first-native-text') || '';
       if (firstNativeText !== savedNativeText) needsUpdate = true;
    }

    if (needsUpdate) {
      customGrid.innerHTML = '';
      if (rawCards.length > 0) {
        customGrid.setAttribute('data-wr-first-native-text', rawCards[0].textContent || '');
        customGrid.setAttribute('data-wr-last-count', rawCards.length);
      }
      
      rawCards.forEach((row, index) => {
        row.classList.add('wr-original-home-card');
        const cardData = this.parseCard(row, index);
        if (cardData) {
          const customEl = this.createCardElement(cardData, index * 20);
          customGrid.appendChild(customEl);

          // If the thumbnail wasn't loaded yet, observe the native row until React injects it
          if (cardData.image.includes('placehold.co')) {
             const imgObserver = new MutationObserver((mutations) => {
                const newImgEl = row.querySelector('img');
                if (newImgEl && newImgEl.src && !newImgEl.src.includes('placehold.co')) {
                   const customImg = customEl.querySelector('.wr-card-image');
                   if (customImg) {
                      customImg.src = newImgEl.src;
                   }
                   imgObserver.disconnect();
                }
             });
             imgObserver.observe(row, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
             this.imageObservers = this.imageObservers || [];
             this.imageObservers.push(imgObserver);
          }
        }
      });
    } else {
       rawCards.forEach(row => row.classList.add('wr-original-home-card'));
    }
  },

  parseCard(cardEl, index) {
    try {
      const imgEl = cardEl.querySelector('img');
      const imgUrl = imgEl ? imgEl.src : 'https://placehold.co/600x400/12121c/3a3a4c?text=No+Thumbnail';

      let title = "Knowledge Item";
      let titleEl = null;
      const hEls = cardEl.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="title"]');
      if (hEls.length > 0) {
        titleEl = Array.from(hEls).reduce((a, b) => a.textContent.length > b.textContent.length ? a : b);
        title = titleEl.textContent.trim();
      } else {
        const textElements = Array.from(cardEl.querySelectorAll('p, span')).filter(el => el.children.length === 0);
        if (textElements.length > 0) {
           titleEl = textElements.reduce((a, b) => a.textContent.length > b.textContent.length ? a : b);
           title = titleEl.textContent.trim();
        }
      }

      const metadata = [];
      const seenTexts = new Set();
      const usedSvgs = new Set();

      const walker = document.createTreeWalker(cardEl, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text && text.length > 0 && text.length < 40 && text !== title && text !== 'No Thumbnail') {
           if (!titleEl || !titleEl.contains(node)) {
              if (seenTexts.has(text)) continue;
              seenTexts.add(text);

              let closestSvgHtml = '';
              let parent = node.parentElement;
              let foundSvg = null;
              
              for (let i = 0; i < 3 && parent; i++) {
                 const icons = Array.from(parent.querySelectorAll('svg, img'));
                 for (const icon of icons) {
                    if (!usedSvgs.has(icon)) {
                       if (icon.tagName === 'IMG') {
                          if (icon.className && icon.className.includes('thumbnail')) continue;
                          if (icon.getAttribute('width') > 40 || icon.clientWidth > 40) continue;
                          if (imgEl && icon.src === imgEl.src) continue; // skip main thumbnail
                       }
                       foundSvg = icon;
                       break;
                    }
                 }
                 if (foundSvg) break;
                 parent = parent.parentElement;
              }

              if (foundSvg) {
                 usedSvgs.add(foundSvg);
                 const clonedSvg = foundSvg.cloneNode(true);
                 clonedSvg.removeAttribute('class');
                 clonedSvg.setAttribute('width', '14');
                 clonedSvg.setAttribute('height', '14');
                 clonedSvg.style.marginRight = '4px';
                 clonedSvg.style.display = 'inline-block';
                 clonedSvg.style.verticalAlign = 'middle';
                 if (clonedSvg.tagName === 'IMG') {
                    clonedSvg.style.borderRadius = '50%';
                    clonedSvg.style.objectFit = 'contain';
                 }
                 closestSvgHtml = clonedSvg.outerHTML;
              }

              metadata.push({ text, svgHtml: closestSvgHtml });
           }
        }
      }

      const linkEl = cardEl.querySelector('a');
      
      return {
        id: `wr-home-card-${index}`,
        image: imgUrl,
        title: title,
        metadata: metadata,
        nativeCard: cardEl,
        link: linkEl ? linkEl.href : null
      };
    } catch (e) {
      return null;
    }
  },

  createCardElement(card, delayMs) {
    const el = document.createElement('div');
    el.className = 'wr-grid-card'; 
    el.style.animationDelay = `${delayMs}ms`;

    const metadataHtml = card.metadata && card.metadata.length > 0 
      ? `<div class="wr-card-metadata">${card.metadata.map(tag => `<span class="wr-card-tag">${tag.svgHtml}${tag.text}</span>`).join('')}</div>` 
      : '';

    const contentHtml = `
      <div class="wr-card-image-wrapper">
        <img src="${card.image}" class="wr-card-image" loading="lazy" />
      </div>
      <div class="wr-card-content">
        <h3 class="wr-card-title">${card.title}</h3>
        ${metadataHtml}
      </div>
    `;

    if (card.link) {
      el.innerHTML = `<a href="${card.link}" style="text-decoration: none; color: inherit; width: 100%; height: 100%; display: flex; flex-direction: column;">${contentHtml}</a>`;
    } else {
      el.innerHTML = contentHtml;
      el.addEventListener('click', () => {
        const nativeClickable = card.nativeCard.querySelector('a, button') || card.nativeCard;
        nativeClickable.click();
      });
    }

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--mx', `${x}%`);
      el.style.setProperty('--my', `${y}%`);
    });

    return el;
  }
};
