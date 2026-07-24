'use strict';

/**
 * @fileoverview Wider Recall - Centralized Selector Data (Comprehensive)
 * A single source of truth mapping all pages and DOM elements within Recall.
 */

window.WR_SELECTORS = Object.freeze({
  pages: {
    isHomeGrid: (path) => path === '/' || path === '',
    isItemDetail: (path) => path.startsWith('/item/'),
    isSpacedRepetition: (path) => path.startsWith('/spaced-repetition'),
    isSettings: (path) => path.startsWith('/settings'),
    isGraph: (path) => path.startsWith('/graph'),
    isSearch: (path) => path.startsWith('/search'),
    isChat: (path) => path.startsWith('/chat'),
    isReview: (path) => path.startsWith('/review')
  },
  
  elements: {
    chat: {
      messageContainer: '.chat-messages, [class*="message"]',
      inputBox: 'textarea, input[type="text"]',
      sendBtn: 'button[aria-label="Send"], button[type="submit"]'
    },
    
    review: {
      reviewContainer: '.review-container, [class*="review"]',
      progress: '.progress-bar'
    },
    global: {
      sidebarCandidates: 'nav, aside, .MuiDrawer-root, .MuiDrawer-paperAnchorLeft, div:has(nav)',
      mainWrappers: '#navigation-scroll-container, main, #root > div > div, .MuiDrawer-paperAnchorBottom, .MuiModal-backdrop',
      scrollContainer: '#navigation-scroll-container',
      fallbackScrollContainer: 'main',
      header: 'header',
      modal: '.MuiModal-root',
      backdrop: '.MuiBackdrop-root',
      loadingIndicator: '.MuiCircularProgress-root'
    },
    
    home: {
      gridContainer: '.css-grid-container, [class*="grid"]',
      gridItems: '.css-grid-item, [class*="card"]',
      filterBar: '.filter-bar, [class*="filter"]'
    },
    
    item: {
      editor: '.ProseMirror',
      editorBlocks: '.ProseMirror > *',
      tabs: 'button[role="tab"], #id-item-tabs button',
      activeTab: 'button[role="tab"][aria-selected="true"], #id-item-tabs button[aria-selected="true"]',
      headers: 'h1, h2, h3, h4, h5, h6',
      codeBlocks: '.ProseMirror pre',
      mediaPlayers: 'iframe[src*="youtube.com"], iframe[src*="vimeo.com"], video, audio',
      mediaPlayerContainerFallback: 'div:has(> iframe), div:has(> video), .css-1xdkvt0',
      thumbnails: 'img[src*="ytimg"], [class*="summary"] img, article img',
      images: 'img',
      links: '.ProseMirror a'
    },
    
    spaced: {
      flipCardBtn: 'button[aria-label="Show answer"], button:contains("Show answer")', // We will handle :contains logically if needed, but keeping standard queries here
      allButtons: 'button',
      spacedRepetitionActionRow: '.css-1xdkvt0 > div > div > div > button',
      spacedRepetitionActionRowFallback: '[class*="actions"] button',
      cardContent: '.card-content, [class*="card"]'
    },
    
    settings: {
      form: 'form',
      inputs: 'input, select, textarea',
      saveButton: 'button[type="submit"]'
    },
    
    graph: {
      canvas: 'canvas',
      svgContainer: 'svg',
      nodeElements: '.node, [class*="node"]',
      edgeElements: '.edge, [class*="edge"]'
    },
    
    search: {
      searchInput: 'input[type="search"], input[placeholder*="Search"]',
      resultsContainer: '.search-results, [class*="results"]',
      resultItems: '.search-result-item'
    }
  }
});
