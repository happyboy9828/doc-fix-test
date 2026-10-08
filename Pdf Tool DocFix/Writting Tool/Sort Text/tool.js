export function initSortTextTool(containerElement) {
  if (!containerElement) return;

  // 1. Inject HTML Layout into the Container
  containerElement.innerHTML = `
    <div class="sort-tool-container">
      <div class="sort-header">
        <h1>Sort Text</h1>
        <p>Alphabetize, reorder numerically, or sort text lines by length instantly.</p>
      </div>

      <div class="sort-grid">
        <!-- LEFT COLUMN: Input & Sorting Modes -->
        <div class="sort-card">
          <h2 class="sort-card-title">Raw Input Lines</h2>
          <div class="editor-wrapper">
            <div class="line-numbers" id="input-lines">1</div>
            <textarea id="sort-input" class="editor-textarea" placeholder="Enter lines of text here..." spellcheck="false">Zebra&#10;Apple&#10;Banana</textarea>
          </div>

          <div class="options-group">
            <span class="options-label">Select Sorting Direction</span>
            <label class="control-item">
              <input type="radio" name="sort-mode" value="alpha-az" checked />
              Alphabetical (A → Z)
            </label>
            <label class="control-item">
              <input type="radio" name="sort-mode" value="alpha-za" />
              Alphabetical (Z → A)
            </label>
            <label class="control-item">
              <input type="radio" name="sort-mode" value="numeric" />
              Numerical Order
            </label>
            <label class="control-item">
              <input type="radio" name="sort-mode" value="length" />
              Sort by Length (Short → Long)
            </label>
            <label class="control-item">
              <input type="radio" name="sort-mode" value="reverse" />
              Reverse Line Order
            </label>
          </div>

          <div class="button-group">
            <button id="btn-sort" class="btn btn-primary">Sort Text Now</button>
          </div>
        </div>

        <!-- RIGHT COLUMN: Sorted Output -->
        <div class="sort-card">
          <h2 class="sort-card-title">Sorted Output List</h2>
          <div class="editor-wrapper">
            <div class="line-numbers" id="output-lines">1</div>
            <textarea id="sort-output" class="editor-textarea" readonly placeholder="Sorted output will appear here..." spellcheck="false"></textarea>
          </div>

          <div class="options-group">
            <span class="options-label">Options</span>
            <label class="control-item">
              <input type="checkbox" id="opt-ignore-case" checked />
              Ignore Case Sensitivity
            </label>
            <label class="control-item">
              <input type="checkbox" id="opt-remove-blank" checked />
              Remove Blank Lines
            </label>
            <label class="control-item">
              <input type="checkbox" id="opt-strip-numbers" />
              Strip Leading Numbers
            </label>
          </div>

          <div class="options-group">
            <span class="options-label">Action Bar</span>
            <div class="button-group">
              <button id="btn-copy" class="btn btn-secondary">Copy Sorted List</button>
              <button id="btn-download" class="btn btn-secondary">Download File (.TXT)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="sort-toast" class="toast-message"></div>
  `;

  // 2. DOM Elements References
  const inputEl = containerElement.querySelector('#sort-input');
  const outputEl = containerElement.querySelector('#sort-output');
  const inputLinesEl = containerElement.querySelector('#input-lines');
  const outputLinesEl = containerElement.querySelector('#output-lines');
  
  const sortModeRadios = containerElement.querySelectorAll('input[name="sort-mode"]');
  const optIgnoreCase = containerElement.querySelector('#opt-ignore-case');
  const optRemoveBlank = containerElement.querySelector('#opt-remove-blank');
  const optStripNumbers = containerElement.querySelector('#opt-strip-numbers');
  
  const btnSort = containerElement.querySelector('#btn-sort');
  const btnCopy = containerElement.querySelector('#btn-copy');
  const btnDownload = containerElement.querySelector('#btn-download');
  const toastEl = containerElement.querySelector('#sort-toast');

  // Helper Toast Notification
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2000);
  }

  // 3. Line Counter & Scroll Synchronization
  function updateLineNumbers(textarea, lineContainer) {
    const linesCount = textarea.value.split('\n').length || 1;
    let lineNumsText = '';
    for (let i = 1; i <= linesCount; i++) {
      lineNumsText += i + '\n';
    }
    lineContainer.textContent = lineNumsText;
  }

  function syncScroll(textarea, lineContainer) {
    lineContainer.scrollTop = textarea.scrollTop;
  }

  // 4. Core Sorting Logic
  function processAndSortText() {
    let rawText = inputEl.value;
    let lines = rawText.split('\n');

    // Option: Strip Leading Numbers
    if (optStripNumbers.checked) {
      lines = lines.map(line => line.replace(/^\s*\d+[\.\)\s-]*/, ''));
    }

    // Option: Remove Blank Lines
    if (optRemoveBlank.checked) {
      lines = lines.filter(line => line.trim().length > 0);
    }

    // Determine current sort mode
    let selectedMode = 'alpha-az';
    sortModeRadios.forEach(radio => {
      if (radio.checked) selectedMode = radio.value;
    });

    const ignoreCase = optIgnoreCase.checked;

    // Apply Sorting
    lines.sort((a, b) => {
      let valA = ignoreCase ? a.toLowerCase() : a;
      let valB = ignoreCase ? b.toLowerCase() : b;

      switch (selectedMode) {
        case 'alpha-az':
          return valA.localeCompare(valB, undefined, { sensitivity: ignoreCase ? 'accent' : 'variant' });

        case 'alpha-za':
          return valB.localeCompare(valA, undefined, { sensitivity: ignoreCase ? 'accent' : 'variant' });

        case 'numeric': {
          const numA = parseFloat(valA.match(/-?\d+(\.\d+)?/)?.[0] ?? NaN);
          const numB = parseFloat(valB.match(/-?\d+(\.\d+)?/)?.[0] ?? NaN);
          
          if (isNaN(numA) && isNaN(numB)) return 0;
          if (isNaN(numA)) return 1;
          if (isNaN(numB)) return -1;
          return numA - numB;
        }

        case 'length':
          return valA.length - valB.length;

        case 'reverse':
          return 0; // Handled after sort block via .reverse()

        default:
          return 0;
      }
    });

    if (selectedMode === 'reverse') {
      lines.reverse();
    }

    outputEl.value = lines.join('\n');
    updateLineNumbers(outputEl, outputLinesEl);
  }

  // 5. Event Listeners
  // Input Changes & Synchronizations
  inputEl.addEventListener('input', () => {
    updateLineNumbers(inputEl, inputLinesEl);
    processAndSortText();
  });

  inputEl.addEventListener('scroll', () => syncScroll(inputEl, inputLinesEl));
  outputEl.addEventListener('scroll', () => syncScroll(outputEl, outputLinesEl));

  // Real-time Updates on Mode and Option Toggles
  sortModeRadios.forEach(radio => {
    radio.addEventListener('change', processAndSortText);
  });

  [optIgnoreCase, optRemoveBlank, optStripNumbers].forEach(option => {
    option.addEventListener('change', processAndSortText);
  });

  // Action Buttons
  btnSort.addEventListener('click', processAndSortText);

  btnCopy.addEventListener('click', () => {
    if (!outputEl.value) return;
    navigator.clipboard.writeText(outputEl.value)
      .then(() => showToast('Sorted list copied to clipboard!'))
      .catch(() => showToast('Failed to copy text.'));
  });

  btnDownload.addEventListener('click', () => {
    if (!outputEl.value) return;
    const blob = new Blob([outputEl.value], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sorted-list.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  });

  // Initial Run
  updateLineNumbers(inputEl, inputLinesEl);
  processAndSortText();
}