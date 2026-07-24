// src/content/features/toc-minimap.js

let tocContainer = null;
let lastHeaderCount = 0;

window.WR_InitMinimap = function() {
  try {
    if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.toc) {
      if (tocContainer) {
        tocContainer.remove();
        tocContainer = null;
        lastHeaderCount = 0;
      }
      return;
    }

    const editor = document.querySelector(window.WR_SELECTORS.elements.editor);
    if (!editor) return;

    const headers = editor.querySelectorAll(window.WR_SELECTORS.elements.headers);
    if (headers.length === lastHeaderCount && tocContainer) return; // No change
    lastHeaderCount = headers.length;

    if (headers.length < 3) {
      if (tocContainer) { tocContainer.remove(); tocContainer = null; }
      return; // Not enough headers to justify a minimap
    }

    if (!tocContainer) {
      tocContainer = document.createElement('div');
      tocContainer.id = 'wr-toc-minimap';
      document.body.appendChild(tocContainer);
    }

    tocContainer.innerHTML = '<div class="wr-toc-title">Minimap</div>';
    
    headers.forEach((h, index) => {
      // Ensure header has an ID for jumping
      if (!h.id) h.id = 'wr-header-' + index;

      const link = document.createElement('a');
      link.className = `wr-toc-link wr-toc-${h.tagName.toLowerCase()}`;
      link.textContent = h.textContent;
      link.href = '#' + h.id;
      
      link.onclick = (e) => {
        e.preventDefault();
        const scrollTarget = document.querySelector(window.WR_SELECTORS.elements.scrollContainer) || document.querySelector(window.WR_SELECTORS.elements.fallbackScrollContainer) || window;
        const top = h.getBoundingClientRect().top + (scrollTarget.scrollTop || window.scrollY) - 100; // offset for headers
        scrollTarget.scrollTo({ top, behavior: 'smooth' });
      };
      
      tocContainer.appendChild(link);
    });

  } catch (e) {
    console.warn("Wider Recall: Error in Minimap", e);
  }
};
