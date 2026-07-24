// src/content/features/bionic-reading.js

function applyBionicReading(node) {
  if (node.nodeType === 3) { 
    const words = node.nodeValue.split(/(\s+)/);
    if (words.length <= 1 && words[0].trim().length === 0) return;
    
    const fragment = document.createDocumentFragment();
    let changed = false;
    words.forEach(w => {
      // Smarter algorithm: only bold if length > 2, dynamic bold length based on word size
      if (w.trim().length > 2) {
        changed = true;
        let mid = Math.ceil(w.length * 0.4); // Bionic reading typically bolds ~40% of the word
        if (w.length > 8) mid = Math.ceil(w.length * 0.35); // Less bold for long words
        
        const b = document.createElement('b');
        b.className = 'wr-bionic';
        b.textContent = w.slice(0, mid);
        fragment.appendChild(b);
        fragment.appendChild(document.createTextNode(w.slice(mid)));
      } else {
        fragment.appendChild(document.createTextNode(w));
      }
    });
    if (changed) node.parentNode.replaceChild(fragment, node);
  } else if (node.nodeType === 1) { 
    if (node.classList.contains('wr-bionic')) return;
    // Ignore interactive/special UI elements to prevent React from breaking
    if (['B', 'STRONG', 'PRE', 'CODE', 'A', 'H1', 'H2', 'H3', 'BUTTON', 'INPUT', 'TEXTAREA'].includes(node.tagName)) return;
    if (node.hasAttribute('role') && node.getAttribute('role') === 'button') return;
    Array.from(node.childNodes).forEach(applyBionicReading);
  }
}

function removeBionicReading(root) {
  const bionics = root.querySelectorAll('.wr-bionic');
  bionics.forEach(b => {
    const text = document.createTextNode(b.textContent);
    b.parentNode.replaceChild(text, b);
  });
  root.normalize();
}

window.WR_UpdateBionic = function() {
  const editor = document.querySelector(window.WR_SELECTORS.elements.editor);
  if (!editor) return;
  if (window.WR_STATE.bionic && window.WR_STATE.enabled) {
    applyBionicReading(editor);
  } else {
    removeBionicReading(editor);
  }
};
