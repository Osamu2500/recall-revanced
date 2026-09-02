const fs = require('fs');
const file = 'src/content/pages/spaced-repetition.js';
let content = fs.readFileSync(file, 'utf8');

// Replace checkAndInject
content = content.replace(
`  checkAndInject() {
    if (!this.active || window.location.pathname !== '/spaced-repetition') return;

    // Check if the grid feature is explicitly toggled ON
    const isGridEnabled = document.body.getAttribute('data-wr-grid') === 'true' && document.body.getAttribute('data-wr-enabled') === 'true';
    if (!isGridEnabled) {
      this.restoreOriginalUI();
      return;
    }

    // The Review tab is a single flashcard. The Questions tab is a list of items.
    // If we see multiple checkboxes, we are almost certainly on the Questions tab.
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    this.isQuestionsTab = checkboxes.length > 3;
    
    // Check again before injecting to prevent race conditions
    if (this.isQuestionsTab) {
      this.extractAndRenderGrid();
    } else {
      this.restoreOriginalUI();
    }
  },`,
`  checkAndInject() {
    if (!this.active || window.location.pathname !== '/spaced-repetition') return;

    // Check if the grid feature is explicitly toggled ON
    const isGridEnabled = document.body.getAttribute('data-wr-grid') === 'true' && document.body.getAttribute('data-wr-enabled') === 'true';
    if (!isGridEnabled) {
      this.restoreOriginalUI();
      return;
    }

    const { container, rows } = this.findListContainerAndRows();
    this.isQuestionsTab = rows.length > 1;
    
    if (this.isQuestionsTab) {
      this.extractAndRenderGrid(container, rows);
    } else {
      this.restoreOriginalUI();
    }
  },`);

// Replace findListContainerAndRows
content = content.replace(
`  findListContainerAndRows() {
    const allCbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    if (allCbs.length < 2) return { container: null, rows: [] };

    // Group checkboxes by their common container
    // The true list container will have multiple direct children (the rows), each containing a checkbox.
    let bestContainer = null;
    let maxRows = 0;
    
    // Check all ancestors of all checkboxes
    const candidates = new Set();
    allCbs.forEach(cb => {
      let p = cb.parentElement;
      while (p && p !== document.body) {
        candidates.add(p);
        p = p.parentElement;
      }
    });

    // Find the container with the most checkbox-containing children
    for (let container of candidates) {
      let rowCount = 0;
      for (let child of container.children) {
        if (child.querySelector('input[type="checkbox"]') || (child.tagName === 'INPUT' && child.type === 'checkbox')) {
          rowCount++;
        }
      }
      if (rowCount > maxRows) {
        maxRows = rowCount;
        bestContainer = container;
      }
    }

    if (!bestContainer || maxRows < 2) {
      return { container: null, rows: [] };
    }

    // The rows are the children that contain a checkbox
    const rows = Array.from(bestContainer.children).filter(child => {
      return child.querySelector('input[type="checkbox"]') || (child.tagName === 'INPUT' && child.type === 'checkbox');
    });
    
    // Find a good wrapper to apply the drawer styling to
    let wrapper = bestContainer;
    const table = bestContainer.closest('table, [role="table"], .MuiTable-root');
    if (table) {
      wrapper = table.closest('.MuiTableContainer-root') || table;
    } else {
      const parent = bestContainer.parentElement;
      if (parent && parent !== document.body && parent.tagName !== 'MAIN') {
         wrapper = parent;
      }
    }

    return { container: wrapper, rows: rows };
  },`,
`  findListContainerAndRows() {
    let bestContainer = null;
    let maxValidRows = 0;

    const allElements = document.querySelectorAll('div, ul');
    for (let el of allElements) {
      // Ignore our own custom grid container to prevent infinite layout loops
      if (el.classList.contains('wr-custom-grid-container') || el.closest('.wr-custom-grid-container')) continue;
      if (el.tagName === 'MAIN' || el.id === 'root' || el.id === '__next' || el === document.body) continue;
      
      if (el.children.length >= 2) {
        // Group children that contain images by their class signature
        const classCounts = new Map();
        for (let child of el.children) {
          if (child.querySelector('img')) {
             const sig = child.className || child.tagName;
             classCounts.set(sig, (classCounts.get(sig) || 0) + 1);
          }
        }
        
        let localMax = 0;
        for (let count of classCounts.values()) {
           if (count > localMax) localMax = count;
        }

        // A true list container will have multiple siblings with the exact same class structure
        if (localMax > maxValidRows && localMax >= 2) {
           maxValidRows = localMax;
           bestContainer = el;
        }
      }
    }
    
    if (!bestContainer || maxValidRows < 2) {
      return { container: null, rows: [] };
    }

    // Rows are children that contain an image
    const rows = Array.from(bestContainer.children).filter(child => child.querySelector('img'));
    
    // Find a good wrapper to apply the drawer styling to
    let wrapper = bestContainer;
    const table = bestContainer.closest('table, [role="table"], .MuiTable-root');
    if (table) {
      wrapper = table.closest('.MuiTableContainer-root') || table;
    } else {
      const parent = bestContainer.parentElement;
      if (parent && parent !== document.body && parent.tagName !== 'MAIN') {
         wrapper = parent;
      }
    }

    return { container: wrapper, rows: rows };
  },`);

// Replace extractAndRenderGrid signature
content = content.replace(
`  extractAndRenderGrid() {
    const { container: originalTable, rows } = this.findListContainerAndRows();
    
    if (!originalTable || rows.length === 0) {`,
`  extractAndRenderGrid(originalTable, rows) {
    if (!originalTable || !rows || rows.length === 0) {`);

// Replace parseRow checkbox
content = content.replace(
`      // 4. Checkbox
      const checkboxInput = row.querySelector('input[type="checkbox"]');
      const isChecked = checkboxInput ? checkboxInput.checked : false;`,
`      // 4. Checkbox
      const checkboxInput = row.querySelector('input[type="checkbox"], [role="checkbox"], svg[class*="checkbox"], svg');
      let isChecked = false;
      if (checkboxInput) {
        if (checkboxInput.tagName === 'INPUT') {
          isChecked = checkboxInput.checked;
        } else {
          isChecked = checkboxInput.getAttribute('aria-checked') === 'true' || checkboxInput.classList.contains('checked');
        }
      }`);

// Replace proxyCheckboxClick
content = content.replace(
`  proxyCheckboxClick(card) {
    this.executeOnCard(card, (rowElement) => {
      const originalCheckbox = rowElement.querySelector('input[type="checkbox"]');
      if (originalCheckbox) {
        // React 16+ intercepts native setters. We must bypass it to trigger onChange programmatically.
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(originalCheckbox, !originalCheckbox.checked);
          originalCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          originalCheckbox.click();
        }
      }
    });`,
`  proxyCheckboxClick(card) {
    this.executeOnCard(card, (rowElement) => {
      const originalCheckbox = rowElement.querySelector('input[type="checkbox"], [role="checkbox"], svg[class*="checkbox"], svg');
      if (originalCheckbox) {
        if (originalCheckbox.tagName === 'INPUT') {
          // React 16+ intercepts native setters. We must bypass it to trigger onChange programmatically.
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(originalCheckbox, !originalCheckbox.checked);
            originalCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            originalCheckbox.click();
          }
        } else {
           originalCheckbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      } else {
        // Fallback: Click the very first element in the row
        const firstChild = rowElement.firstElementChild;
        if (firstChild) firstChild.click();
      }
    });`);

fs.writeFileSync(file, content);
console.log('Patched spaced-repetition.js successfully');
