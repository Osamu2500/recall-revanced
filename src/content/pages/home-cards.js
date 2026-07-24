'use strict';

/**
 * Wider Recall - Home Cards Interceptor
 * Replaces native MUI cards on the homepage with a flawless custom grid 
 * so the Immersive Glass Card CSS applies perfectly without hacks.
 */

window.WR_HOME_CARDS = {
  observer: null,
  active: false,
  gridContainer: null,
  
  injectCss() {
    if (document.getElementById('wr-home-cards-css')) return;
    const style = document.createElement('style');
    style.id = 'wr-home-cards-css';
    style.textContent = `
      /* Hide native cards */
      body[data-wr-enabled="true"][data-wr-immersive-cards="true"] article.wr-original-home-card,
      body[data-wr-enabled="true"][data-wr-immersive-cards="true"] div[class*="MuiCard-root"].wr-original-home-card {
        display: none !important;
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

      /* Native grid layout hiding if immersive is true */
      body[data-wr-immersive-cards="true"] .wr-home-grid-container + div, 
      body[data-wr-immersive-cards="true"] .wr-home-grid-container + ul {
         /* Prevent layout shifts if Recall tries to re-render original grid below ours */
      }
    `;
    document.head.appendChild(style);
  },
  
  init() {
    this.injectCss();
    this.active = true;
    
    if (!this.gridContainer) {
      this.gridContainer = document.createElement('div');
      this.gridContainer.className = 'wr-home-grid-container';
      this.gridContainer.style.display = 'none';
    }

    this.startObservation();
    
    this._fallbackInterval = setInterval(() => {
      if (this.active) this.checkAndInject();
    }, 1000);
  },
  
  cleanup() {
    this.active = false;
    if (this.observer) this.observer.disconnect();
    if (this.gridContainer && this.gridContainer.parentNode) {
      this.gridContainer.parentNode.removeChild(this.gridContainer);
    }
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
    if (this.gridContainer) {
      this.gridContainer.style.display = 'none';
    }
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

    this.extractAndRenderGrid();
  },

  extractAndRenderGrid() {
    // Recall's homepage cards are often just generic <div class="MuiBox-root"> elements.
    // The most reliable way to find them is to look for links to items.
    const itemLinks = Array.from(document.querySelectorAll('a[href*="/item/"]'))
      .filter(a => !a.closest('.wr-home-grid-container'));

    if (itemLinks.length === 0) return;

    // The actual "card" is usually the top-level block element that is a direct child of the grid container.
    const rawCards = Array.from(new Set(itemLinks.map(link => {
      let card = link;
      while (card.parentElement && card.parentElement.tagName !== 'MAIN' && card.parentElement.id !== 'navigation-scroll-container') {
        const parentStyle = window.getComputedStyle(card.parentElement);
        if (parentStyle.display === 'grid' || parentStyle.display === 'flex' && card.parentElement.children.length > 2) {
          break; // The parent is likely the grid container
        }
        card = card.parentElement;
      }
      return card;
    })));

    if (rawCards.length === 0) return;

    // Find the closest common container of the native cards
    let parentContainer = rawCards[0].parentElement;
    
    if (this.gridContainer.parentNode !== parentContainer) {
      parentContainer.insertBefore(this.gridContainer, parentContainer.firstChild);
    }

    this.gridContainer.style.display = 'grid';

    // To prevent infinite re-rendering, we track elements by DOM node
    let needsUpdate = false;
    const currentNativeCards = new Set(rawCards);

    // If counts differ or new cards appeared, we re-render everything (simple approach for homepage)
    if (this.lastCardCount !== rawCards.length) {
      needsUpdate = true;
    }
    this.lastCardCount = rawCards.length;

    if (!needsUpdate) {
       // Deep check? For now, count is enough for homepage lazy loading
       const firstNativeImg = rawCards[0]?.querySelector('img')?.src;
       const firstCustomImg = this.gridContainer.querySelector('img')?.src;
       if (firstNativeImg !== firstCustomImg) needsUpdate = true;
    }

    if (needsUpdate) {
      this.gridContainer.innerHTML = '';
      
      rawCards.forEach((row, index) => {
        row.classList.add('wr-original-home-card');
        const cardData = this.parseCard(row, index);
        if (cardData) {
          const customEl = this.createCardElement(cardData, index * 20);
          this.gridContainer.appendChild(customEl);
        }
      });
    } else {
       // Ensure all are hidden
       rawCards.forEach(row => row.classList.add('wr-original-home-card'));
    }
  },

  parseCard(cardEl, index) {
    try {
      const imgEl = cardEl.querySelector('img');
      const imgUrl = imgEl ? imgEl.src : 'https://placehold.co/600x400/12121c/3a3a4c?text=No+Thumbnail';

      let title = "Knowledge Item";
      // Find headings
      const hEls = cardEl.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="title"]');
      if (hEls.length > 0) {
        title = Array.from(hEls).reduce((a, b) => a.textContent.length > b.textContent.length ? a : b).textContent.trim();
      } else {
        // Fallback to longest paragraph
        const textElements = Array.from(cardEl.querySelectorAll('p, span')).filter(el => el.children.length === 0);
        if (textElements.length > 0) {
           title = textElements.reduce((a, b) => a.textContent.length > b.textContent.length ? a : b).textContent.trim();
        }
      }

      // Find the clickable link
      const linkEl = cardEl.querySelector('a');
      
      return {
        id: `wr-home-card-${index}`,
        image: imgUrl,
        title: title,
        nativeCard: cardEl,
        link: linkEl ? linkEl.href : null
      };
    } catch (e) {
      return null;
    }
  },

  createCardElement(card, delayMs) {
    const el = document.createElement('div');
    // Using exactly the same classes as spaced repetition so Immersive CSS works
    el.className = 'wr-grid-card'; 
    el.style.animationDelay = \`\${delayMs}ms\`;

    // Only inject link wrapper if we found a link, otherwise it's just a div
    const contentHtml = \`
      <div class="wr-card-image-wrapper">
        <img src="\${card.image}" class="wr-card-image" loading="lazy" />
      </div>
      <div class="wr-card-content">
        <h3 class="wr-card-title">\${card.title}</h3>
      </div>
    \`;

    if (card.link) {
      el.innerHTML = \`<a href="\${card.link}" style="text-decoration: none; color: inherit; width: 100%; height: 100%; display: flex; flex-direction: column;">\${contentHtml}</a>\`;
    } else {
      el.innerHTML = contentHtml;
      // Proxy clicks to native element if no direct link
      el.addEventListener('click', () => {
        const nativeClickable = card.nativeCard.querySelector('a, button') || card.nativeCard;
        nativeClickable.click();
      });
    }

    // Add Spotlight Effect Tracking
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--mx', \`\${x}%\`);
      el.style.setProperty('--my', \`\${y}%\`);
    });

    return el;
  }
};
