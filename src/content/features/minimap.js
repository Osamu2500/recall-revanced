'use strict';

/**
 * @fileoverview Wider Recall - minimap.js
 */
/**
 * Table of Contents (Minimap) feature for Wider Recall.
 * Generates a floating minimap of headers and tracks scroll position.
 */
window.WR_InitMinimap = function() {
    // Clean up existing minimap wrapper
    const existing = document.getElementById('wr-toc-wrapper');
    if (existing) existing.remove();

    // Only run on item pages and if the setting is enabled
    if (!window.WR_STATE || !window.WR_STATE.enabled || !window.WR_STATE.toc) return;
    
    // Find headings in the document (assuming they are inside a ProseMirror editor or standard container)
    const container = document.querySelector('.ProseMirror') || document.body;
    const headings = container.querySelectorAll('h1, h2, h3');
    
    if (headings.length === 0) return;
    
    // Create the minimap Wrapper UI
    const wrapper = document.createElement('div');
    wrapper.id = 'wr-toc-wrapper';
    
    // Create Toggle Button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'wr-toc-toggle';
    toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
    
    // Create actual minimap container
    const minimap = document.createElement('div');
    minimap.id = 'wr-toc-minimap';
    
    const title = document.createElement('div');
    title.className = 'wr-toc-title';
    title.textContent = 'Outline';
    minimap.appendChild(title);
    
    headings.forEach((heading, index) => {
        if (!heading.id) {
            heading.id = 'wr-heading-' + index;
        }
        
        const link = document.createElement('a');
        link.className = 'wr-toc-link wr-toc-' + heading.tagName.toLowerCase();
        link.textContent = heading.textContent;
        link.href = '#' + heading.id;
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            minimap.querySelectorAll('.wr-toc-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
        
        minimap.appendChild(link);
    });
    
    wrapper.appendChild(toggleBtn);
    wrapper.appendChild(minimap);
    document.body.appendChild(wrapper);
    
    // Auto-hide Logic
    let idleTimeout = null;
    let isPinned = false; // If manually pinned open
    
    // Start collapsed by default initially to be unobtrusive
    wrapper.classList.add('wr-toc-collapsed');
    
    const resetIdleTimer = () => {
        if (isPinned) return;
        clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
            if (!isPinned) {
                wrapper.classList.add('wr-toc-collapsed');
            }
        }, 3000);
    };
    
    toggleBtn.addEventListener('click', () => {
        isPinned = !isPinned;
        if (isPinned) {
            wrapper.classList.remove('wr-toc-collapsed');
            clearTimeout(idleTimeout);
        } else {
            resetIdleTimer();
        }
        // Update arrow direction based on pin state
        if (isPinned) {
            toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
        } else {
            toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        }
    });
    
    // Wake up on hover
    wrapper.addEventListener('mouseenter', () => {
        wrapper.classList.remove('wr-toc-collapsed');
        clearTimeout(idleTimeout);
    });
    
    wrapper.addEventListener('mouseleave', () => {
        resetIdleTimer();
    });
    
    // Scroll tracking logic
    const onScroll = () => {
        resetIdleTimer();
        
        let currentActive = null;
        headings.forEach(heading => {
            const rect = heading.getBoundingClientRect();
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
    
    window.addEventListener('scroll', onScroll, true);
    
    // Init idle timer
    resetIdleTimer();
};

