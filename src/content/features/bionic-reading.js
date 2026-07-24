// src/content/features/bionic-reading.js

/**
 * @fileoverview Advanced Bionic Reading Engine
 * Implements a high-performance, syllable-aware text parser that creates artificial
 * fixation points to guide the eye through text. Features include IntersectionObserver
 * lazy-loading, MutationObserver auto-updating, caching, and linguistic heuristics.
 */

const BionicConfig = {
  fixationPoint: 0.45, // Target percentage of the word to bold
  minWordLength: 3,
  saccadeInterval: 1, // Apply to every Nth word (1 = all words)
  opacity: 1.0, // Bold opacity
  letterSpacing: '0.01em', // Optional slight tracking increase
  // Common prefixes/suffixes to handle intelligently
  prefixes: ['un', 're', 'in', 'im', 'ir', 'il', 'en', 'em', 'non', 'over', 'mis', 'sub', 'pre', 'inter', 'fore', 'de', 'trans', 'super', 'semi', 'anti', 'mid', 'under'],
  suffixes: ['ing', 'ed', 'tion', 'sion', 'ism', 'ity', 'ment', 'ness', 'ance', 'ence', 'er', 'or', 'ist', 'able', 'ible', 'al', 'ial', 'y', 'ly', 'ful', 'less', 'ous'],
};

const BionicState = {
  isEnabled: false,
  nodeCache: new WeakMap(),
  processedElements: new WeakSet(),
  observer: null,
  mutationObserver: null,
  pendingMutations: new Set(),
  mutationTimer: null,
};

/**
 * Initializes the Advanced Bionic Engine
 */
window.WR_UpdateBionic = function() {
  try {
    const editor = document.querySelector(window.WR_SELECTORS.elements.editor);
    if (!editor) return;

    if (window.WR_STATE.bionic && window.WR_STATE.enabled) {
      if (!BionicState.isEnabled) {
        BionicState.isEnabled = true;
        setupObservers(editor);
        applyBionicToViewport();
      }
    } else {
      if (BionicState.isEnabled) {
        BionicState.isEnabled = false;
        teardownObservers();
        removeBionicReading(editor);
      }
    }
  } catch (e) {
    console.error("Wider Recall: Error in Bionic Reading Engine", e);
  }
};

/**
 * Sets up the IntersectionObserver for lazy processing
 * and MutationObserver for dynamic React updates.
 */
function setupObservers(editor) {
  // 1. Intersection Observer (Lazy Loading)
  BionicState.observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (!BionicState.processedElements.has(entry.target)) {
          processElement(entry.target);
          BionicState.processedElements.add(entry.target);
        }
      }
    });
  }, {
    rootMargin: '200px 0px 200px 0px', // Pre-load slightly offscreen
    threshold: 0
  });

  // Track all text-heavy blocks
  const blocks = editor.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, div.text-block');
  blocks.forEach(block => {
    if (!BionicState.processedElements.has(block)) {
      BionicState.observer.observe(block);
    }
  });

  // 2. Mutation Observer (Dynamic Content)
  BionicState.mutationObserver = new MutationObserver((mutations) => {
    if (!BionicState.isEnabled) return;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            // Is it a block we should process?
            if (node.matches && node.matches('p, li, h1, h2, h3, blockquote, div')) {
              BionicState.pendingMutations.add(node);
            } else {
              const subBlocks = node.querySelectorAll('p, li, h1, h2, h3, blockquote');
              subBlocks.forEach(sb => BionicState.pendingMutations.add(sb));
            }
          }
        });
      }
    });

    // Debounce mutation processing
    if (BionicState.pendingMutations.size > 0) {
      if (BionicState.mutationTimer) clearTimeout(BionicState.mutationTimer);
      BionicState.mutationTimer = setTimeout(() => {
        BionicState.pendingMutations.forEach(block => {
          if (BionicState.observer) BionicState.observer.observe(block);
        });
        BionicState.pendingMutations.clear();
      }, 100); // 100ms debounce
    }
  });

  BionicState.mutationObserver.observe(editor, {
    childList: true,
    subtree: true,
    characterData: false
  });
}

/**
 * Tears down all observers and caches
 */
function teardownObservers() {
  if (BionicState.observer) {
    BionicState.observer.disconnect();
    BionicState.observer = null;
  }
  if (BionicState.mutationObserver) {
    BionicState.mutationObserver.disconnect();
    BionicState.mutationObserver = null;
  }
  if (BionicState.mutationTimer) {
    clearTimeout(BionicState.mutationTimer);
  }
  BionicState.processedElements = new WeakSet();
  BionicState.pendingMutations.clear();
}

/**
 * Fallback to apply to anything currently on screen if observers fail
 */
function applyBionicToViewport() {
  const editor = document.querySelector(window.WR_SELECTORS.elements.editor);
  if (!editor) return;
  const blocks = Array.from(editor.querySelectorAll('p, li, h1, h2, h3, blockquote'));
  
  // Force process anything currently visible
  const vh = window.innerHeight;
  blocks.forEach(block => {
    const rect = block.getBoundingClientRect();
    if (rect.top >= -200 && rect.bottom <= vh + 200) {
      if (!BionicState.processedElements.has(block)) {
        processElement(block);
        BionicState.processedElements.add(block);
      }
    }
  });
}

/**
 * Recursively processes an element's text nodes
 */
function processElement(node) {
  if (!BionicState.isEnabled) return;
  
  if (node.nodeType === 3) { // Text node
    processTextNode(node);
  } else if (node.nodeType === 1) { // Element node
    // Prevent double processing
    if (node.classList && node.classList.contains('wr-bionic')) return;
    if (node.dataset && node.dataset.bionicApplied) return;
    
    // Ignore interactive, code, or special UI elements
    const ignoredTags = new Set(['B', 'STRONG', 'PRE', 'CODE', 'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SCRIPT', 'STYLE', 'SVG', 'MATH']);
    if (ignoredTags.has(node.tagName)) return;
    if (node.hasAttribute('role') && ['button', 'checkbox', 'switch'].includes(node.getAttribute('role'))) return;
    if (node.isContentEditable) return; // Don't mess with actively edited text
    
    // Convert childNodes to array before iterating since we might mutate the DOM
    Array.from(node.childNodes).forEach(child => processElement(child));
    
    if (node.dataset) node.dataset.bionicApplied = 'true';
  }
}

/**
 * Replaces a text node with a bionic-formatted DocumentFragment
 */
function processTextNode(node) {
  const text = node.nodeValue;
  if (!text || text.trim().length === 0) return;

  // Split by whitespace but keep the whitespace for exact reconstruction
  const tokens = text.split(/(\s+)/);
  if (tokens.length <= 1 && tokens[0].trim().length === 0) return;

  const fragment = document.createDocumentFragment();
  let hasChanges = false;
  let wordIndex = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (token.trim().length === 0) {
      // It's whitespace, append as is
      fragment.appendChild(document.createTextNode(token));
      continue;
    }

    wordIndex++;
    
    // Respect saccade interval
    if (wordIndex % BionicConfig.saccadeInterval !== 0) {
      fragment.appendChild(document.createTextNode(token));
      continue;
    }

    // Strip punctuation for length calculation but keep it for rendering
    const match = token.match(/^([^\w]*)(.*?)([^\w]*)$/);
    if (!match) {
      fragment.appendChild(document.createTextNode(token));
      continue;
    }

    const [, prePunct, word, postPunct] = match;
    
    if (word.length < BionicConfig.minWordLength || !/[a-zA-Z]/.test(word)) {
      fragment.appendChild(document.createTextNode(token));
      continue;
    }

    hasChanges = true;
    
    // Advanced Fixation Point Calculation
    let fixationLength = calculateFixationPoint(word);
    
    const b = document.createElement('b');
    b.className = 'wr-bionic';
    b.style.fontWeight = '700';
    if (BionicConfig.opacity < 1.0) b.style.opacity = BionicConfig.opacity;
    if (BionicConfig.letterSpacing) b.style.letterSpacing = BionicConfig.letterSpacing;
    
    b.textContent = prePunct + word.slice(0, fixationLength);
    
    fragment.appendChild(b);
    fragment.appendChild(document.createTextNode(word.slice(fixationLength) + postPunct));
  }

  if (hasChanges && node.parentNode) {
    // Cache the original text in case we need to revert
    BionicState.nodeCache.set(fragment, text);
    node.parentNode.replaceChild(fragment, node);
  }
}

/**
 * Advanced Linguistic Heuristic for Fixation Points
 * Attempts to bold the optimal morphological segment of the word.
 */
function calculateFixationPoint(word) {
  const len = word.length;
  let target = Math.ceil(len * BionicConfig.fixationPoint);
  const lowerWord = word.toLowerCase();

  // Rule 1: Very short words get 1 or 2 letters
  if (len === 3) return 1;
  if (len === 4) return 2;
  
  // Rule 2: Exceptionally long words
  if (len > 10) {
    target = Math.ceil(len * 0.35); // Less bolding for massive words to prevent fatigue
  }

  // Rule 3: Prefix handling (if the word starts with a known prefix, bold the prefix + 1 letter)
  for (const prefix of BionicConfig.prefixes) {
    if (lowerWord.startsWith(prefix) && len > prefix.length + 3) {
      // e.g. "unbelievable" -> prefix "un" (2) -> bold 3
      return Math.min(target, prefix.length + 1);
    }
  }

  // Rule 4: Suffix handling (if it has a known suffix, ensure we don't bold into the suffix unless it's a short word)
  for (const suffix of BionicConfig.suffixes) {
    if (lowerWord.endsWith(suffix) && len > suffix.length + 4) {
      // Ensure we don't bold the suffix
      const stemLength = len - suffix.length;
      return Math.min(target, Math.ceil(stemLength * 0.6));
    }
  }

  // Rule 5: Vowel bounds (try to end the bolding on a vowel or right after a vowel cluster)
  const vowels = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
  let hasVowel = false;
  for (let i = 0; i < target; i++) {
    if (vowels.has(lowerWord[i])) hasVowel = true;
  }
  
  // If our target length didn't reach a vowel, push it by 1 if possible
  if (!hasVowel && target < len - 1 && vowels.has(lowerWord[target])) {
    target++;
  }

  return Math.max(1, target);
}

/**
 * Globally removes Bionic Reading from the document and restores the exact original DOM
 */
function removeBionicReading(root) {
  if (!root) return;
  const bionics = Array.from(root.querySelectorAll('.wr-bionic'));
  
  bionics.forEach(b => {
    const parent = b.parentNode;
    if (!parent) return;
    
    // If the next sibling is the unbolded remainder of the word, merge them
    const nextNode = b.nextSibling;
    let fullText = b.textContent;
    
    if (nextNode && nextNode.nodeType === 3) {
      fullText += nextNode.nodeValue;
      parent.removeChild(nextNode);
    }
    
    const textNode = document.createTextNode(fullText);
    parent.replaceChild(textNode, b);
  });
  
  // Clean up data attributes
  const applied = root.querySelectorAll('[data-bionic-applied="true"]');
  applied.forEach(el => delete el.dataset.bionicApplied);
  
  root.normalize(); // Merge adjacent text nodes for clean DOM
}
