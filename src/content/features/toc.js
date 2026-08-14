'use strict';

/**
 * Table of Contents (Minimap) feature for Wider Recall.
 * Generates a floating minimap of headers and tracks scroll position.
 */
window.WR_InitMinimap = function() {
    // Only run on item pages and if the setting is enabled
    if (!window.WR_STATE || !window.WR_STATE.enabled) return;
    
    // Clean up existing minimap
    const existing = document.getElementById('wr-toc-minimap');
    if (existing) existing.remove();
    
    // Find headings in the document (assuming they are inside a ProseMirror editor or standard container)
    const container = document.querySelector('.ProseMirror') || document.body;
    const headings = container.querySelectorAll('h1, h2, h3');
    
    if (headings.length === 0) return;
    
    // Create the minimap UI
    const minimap = document.createElement('div');
    minimap.id = 'wr-toc-minimap';
    
    const title = document.createElement('div');
    title.className = 'wr-toc-title';
    title.textContent = 'Outline';
    minimap.appendChild(title);
    
    headings.forEach((heading, index) => {
        // Ensure the heading has an ID for anchor scrolling
        if (!heading.id) {
            heading.id = 'wr-heading-' + index;
        }
        
        const link = document.createElement('a');
        link.className = 'wr-toc-link wr-toc-' + heading.tagName.toLowerCase();
        link.textContent = heading.textContent;
        link.href = '#' + heading.id;
        
        // Smooth scroll on click
        link.addEventListener('click', (e) => {
            e.preventDefault();
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Manually set active state
            minimap.querySelectorAll('.wr-toc-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
        
        minimap.appendChild(link);
    });
    
    document.body.appendChild(minimap);
    
    // Scroll tracking logic to highlight active section
    // In many SPAs, the window isn't what scrolls, it's a specific wrapper. We'll listen to window and capture capture phase.
    const onScroll = () => {
        let currentActive = null;
        headings.forEach(heading => {
            const rect = heading.getBoundingClientRect();
            // If heading is near the top of the viewport
            if (rect.top <= 200) {
                currentActive = heading;
            }
        });
        
        if (currentActive) {
            minimap.querySelectorAll('.wr-toc-link').forEach(l => l.classList.remove('active'));
            const activeLink = minimap.querySelector(`[href="#${currentActive.id}"]`);
            if (activeLink) activeLink.classList.add('active');
        }
    };
    
    // Use capture true to catch scroll events from any scrollable child container
    window.addEventListener('scroll', onScroll, true);
};
