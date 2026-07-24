'use strict';

/**
 * @fileoverview Wider Recall - Centralized Selector Registry (v1.2 - Stable)
 *
 * CRITICAL DESIGN RULE: NO css-XXXXX CLASS SELECTORS.
 * Emotion/MUI generates hash-based class names (e.g. css-4ppfzp) that change
 * with every Recall.it deployment. All selectors here MUST use stable attributes:
 *   - Element roles    ([role="table"], [role="row"])
 *   - ARIA attributes  ([aria-label="..."], [aria-selected="true"])
 *   - Stable IDs       (#id-left-view, #id-item-tabs)
 *   - Semantic elements (nav, main, table, thead, tbody, tr, td)
 *   - Data attributes  ([data-testid="..."])
 *   - Structural patterns (main > div > div:first-child)
 */

window.WR_SELECTORS = Object.freeze({

  // ─── Page Route Matchers ────────────────────────────────────────────────────
  pages: {
    isHomeGrid:          (path) => path === '/' || path === '' || path === '/home' || path.startsWith('/items') || path.startsWith('/questions'),
    isItemDetail:        (path) => path.startsWith('/item/'),
    isSpacedRepetition:  (path) => path.startsWith('/spaced-repetition'),
    isSettings:          (path) => path.startsWith('/settings'),
    isGraph:             (path) => path.startsWith('/graph'),
    isSearch:            (path) => path.startsWith('/search'),
    isChat:              (path) => path.startsWith('/chat'),
    isReview:            (path) => path.startsWith('/review'),
  },

  // ─── Global / Cross-Page Elements ───────────────────────────────────────────
  global: {
    // The left navigation bar — a fixed-width vertical sidebar
    // Recall uses a <nav> element for the left rail
    sidebar:             'nav:not(#toc_wrap):not(:has(#toc_wrap))',

    // Candidates for sidebar detection when nav is not explicit
    sidebarCandidates:   'nav, aside, [role="navigation"]',

    // Main content scroll container (stable ID used by Recall)
    scrollContainer:     '#navigation-scroll-container',
    fallbackScrollContainer: 'main',

    // Top application header bar
    header:              'header',

    // MUI modal overlays
    modal:               '[role="dialog"], .MuiModal-root',
    backdrop:            '.MuiBackdrop-root',

    // MUI loading spinner
    loadingIndicator:    '[role="progressbar"]',

    // Bottom drawer (used by Recall for context menus)
    // Targeting by role, not by generated class
    bottomDrawer:        '[role="presentation"] > .MuiPaper-root',
  },

  // ─── Item Detail Page (/item/:id) ───────────────────────────────────────────
  item: {
    // Stable IDs from Recall's own DOM
    leftView:            '#id-left-view',
    tabBar:              '#id-item-tabs',

    // Editor — ProseMirror is consistent across all Recall versions
    editor:              '.ProseMirror',
    editorContent:       '.ProseMirror > *',

    // Tabs — use role-based selectors
    tabs:                '#id-item-tabs [role="tab"], [role="tablist"] [role="tab"]',
    activeTab:           '#id-item-tabs [role="tab"][aria-selected="true"], [role="tablist"] [role="tab"][aria-selected="true"]',

    // Table of Contents (stable id used by Recall)
    toc:                 '#toc_wrap',
    tocNav:              'nav:has(#toc_wrap)',

    // Right panel that contains the TOC or outline
    // It's always a sibling of #id-left-view inside the same flex container
    rightPanel:          '#id-left-view ~ *',

    // Content headings
    headers:             '.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6',

    // Code blocks in the editor
    codeBlocks:          '.ProseMirror pre, .ProseMirror code',

    // Media players embedded in notes
    mediaPlayers:        'iframe[src*="youtube.com"], iframe[src*="youtu.be"], iframe[src*="vimeo.com"], video, audio',

    // Container wrapping an iframe or video (used for floating player detection)
    mediaPlayerContainer: 'div:has(> iframe[src*="youtube"]), div:has(> iframe[src*="vimeo"]), div:has(> video)',

    // YouTube thumbnail images (used for cinematic background)
    thumbnails:          'img[src*="ytimg.com"], img[src*="ytimg"]',

    // All images inside the editor
    editorImages:        '.ProseMirror img',

    // Links in notes
    links:               '.ProseMirror a[href]',

    // Summary/highlight section (Recall-generated summary card)
    summaryCard:         '[class*="summary"], [class*="Summary"]',
  },

  // ─── Home Page / Knowledge Library (/) ──────────────────────────────────────
  home: {
    // Cards on the home grid — Recall uses <article> for knowledge items
    cards:               'article',

    // Individual card titles
    cardTitle:           'article h2, article h3, article [class*="title"]',

    // Card thumbnails
    cardImages:          'article img',

    // The main content area on home (inside the scroll container)
    contentArea:         '#navigation-scroll-container > div, main > div',

    // Search input on the home page
    searchInput:         'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]',
  },

  // ─── Spaced Repetition Page (/spaced-repetition) ────────────────────────────
  spaced: {
    // The two top-level sub-tabs
    // We detect by role + text content (see SpacedRep module for text matching)
    tabList:             '[role="tablist"]',
    tabs:                '[role="tab"]',
    activeTab:           '[role="tab"][aria-selected="true"]',

    // The "Questions" sub-tab (detected by text content in JS)
    // and the "Review" sub-tab
    // These are matched by label text in the module, not by class

    // The table / list of cards on the Questions tab
    // Recall renders this as a semantic table OR a role-based table
    cardTable:           'table, [role="table"]',
    tableBody:           'tbody, [role="rowgroup"]',
    tableRows:           'tbody tr, [role="rowgroup"] [role="row"]',
    tableHeader:         'thead, [role="rowgroup"]:first-child',

    // Individual card row elements
    rowWithImage:        'tr:has(img), [role="row"]:has(img)',
    rowCheckbox:         'tr input[type="checkbox"], [role="row"] input[type="checkbox"]',

    // Expand chevron inside a card row
    expandChevron:       '[class*="lucide-chevron"], svg[class*="chevron"]',

    // The review flashcard (on the Review sub-tab)
    // Recall shows a single card with a "Show Answer" button
    reviewCard:          '[class*="card"], [class*="Card"]',
    showAnswerBtn:       'button[aria-label="Show answer"], button:has(svg)',

    // The rating buttons after showing an answer (Again/Hard/Good/Easy)
    ratingButtons:       'button[class*="rating"], [aria-label*="Again"], [aria-label*="Hard"], [aria-label*="Good"], [aria-label*="Easy"]',
  },

  // ─── Chat Page (/chat) ───────────────────────────────────────────────────────
  chat: {
    // Main chat container (inside MUI container)
    container:           'main, [role="main"]',

    // Message history
    messages:            '[class*="message"], [class*="Message"]',

    // Chat input box
    input:               'textarea, input[type="text"]:not([type="search"])',

    // Send button
    sendBtn:             'button[aria-label="Send"], button[type="submit"], form button:last-child',
  },

  // ─── Search Page (/search) ───────────────────────────────────────────────────
  search: {
    searchInput:         'input[type="search"], input[placeholder*="Search"]',
    results:             '[role="list"], [role="listbox"]',
    resultItems:         '[role="listitem"], [role="option"]',
  },

  // ─── Graph Page (/graph) ────────────────────────────────────────────────────
  graph: {
    // The knowledge graph canvas
    canvas:              'canvas',
    svgContainer:        '.react-flow, svg[class*="graph"]',
    nodes:               '.react-flow__node, [class*="node"]',
    edges:               '.react-flow__edge, [class*="edge"]',
  },

  // ─── Settings Page (/settings) ──────────────────────────────────────────────
  settings: {
    form:                'form',
    inputs:              'input, select, textarea',
    saveBtn:             'button[type="submit"]',
  },

  // ─── State Memory Keys ───────────────────────────────────────────────────────
  memory: {
    tabs:                '#id-item-tabs [role="tab"], [role="tablist"] [role="tab"]',
    activeTab:           '#id-item-tabs [role="tab"][aria-selected="true"], [role="tablist"] [role="tab"][aria-selected="true"]',
    scrollContainer:     '#navigation-scroll-container',
    fallbackScroll:      'main',
  },

  // ─── Elements used in the old tabs API compatibility layer ──────────────────
  elements: {
    // These mirror the old selectors.elements API for backward compatibility
    tabs:                '#id-item-tabs [role="tab"], [role="tablist"] [role="tab"]',
    activeTab:           '#id-item-tabs [role="tab"][aria-selected="true"], [role="tablist"] [role="tab"][aria-selected="true"]',
    scrollContainer:     '#navigation-scroll-container',
    fallbackScrollContainer: 'main',
    sidebarCandidates:   'nav, aside, [role="navigation"]',
    mainWrappers:        '#navigation-scroll-container, main',
  },

});
