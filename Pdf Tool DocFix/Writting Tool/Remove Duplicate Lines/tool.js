import './tool.css';

/**
 * Initializes and renders the Remove Duplicate Lines utility inside a target DOM container.
 * @param {HTMLElement|string} target - The DOM element or selector string where the tool will mount.
 */
export function initDuplicateRemover(target) {
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) {
    console.error('Target element not found for Duplicate Remover tool.');
    return;
  }

  // Render UI HTML Structure
  container.innerHTML = `
    <div class="rdl-container">
      <div class="rdl-header">
        <h1>Remove Duplicate Lines</h1>
        <p>Clean up lists, remove repeated lines, and eliminate extra whitespace instantly.</p>
      </div>

      <div class="rdl-grid">
        <!-- Left Column: Input & Rules -->
        <div class="rdl-card">
          <h2>Input List & Rules</h2>
          
          <div>
            <label for="rdl-input-text" style="display:block; font-weight: 500; margin-bottom: 0.3rem;">Input Text List</label>
            <textarea id="rdl-input-text" class="rdl-textarea" placeholder="Paste your list here...\nApple\nBanana\nApple\nCherry"></textarea>
          </div>

          <div>
            <div class="rdl-rules-title">De-duplication Rules</div>
            <div class="rdl-checkbox-group">
              <label class="rdl-checkbox-label">
                <input type="checkbox" id="rdl-case-sensitive" checked>
                Case Sensitive Matching
              </label>
              <label class="rdl-checkbox-label">
                <input type="checkbox" id="rdl-trim-space" checked>
                Trim Whitespace Before Processing
              </label>
              <label class="rdl-checkbox-label">
                <input type="checkbox" id="rdl-remove-empty" checked>
                Remove Empty Lines
              </label>
            </div>
          </div>

          <div>
            <button id="rdl-process-btn" class="rdl-btn rdl-btn-primary">Remove Duplicates</button>
          </div>
        </div>

        <!-- Right Column: Clean Output -->
        <div class="rdl-card">
          <h2>Clean Output</h2>

          <div>
            <label for="rdl-output-text" style="display:block; font-weight: 500; margin-bottom: 0.3rem;">Cleaned Unique List</label>
            <textarea id="rdl-output-text" class="rdl-textarea" readonly placeholder="Cleaned output will appear here..."></textarea>
          </div>

          <div id="rdl-alert-container"></div>

          <div class="rdl-stats">
            <div class="rdl-rules-title" style="margin-bottom: 0.5rem;">Cleaning Stats</div>
            <div>Original Lines: <strong id="rdl-stat-original">0</strong></div>
            <div>Removed Duplicates: <strong id="rdl-stat-removed">0</strong></div>
            <div>Final Unique Lines: <strong id="rdl-stat-unique">0</strong></div>
          </div>

          <div class="rdl-actions">
            <button id="rdl-copy-btn" class="rdl-btn rdl-btn-secondary">Copy Clean List</button>
            <button id="rdl-download-btn" class="rdl-btn rdl-btn-secondary">Download (.TXT)</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Select Element References
  const inputText = container.querySelector('#rdl-input-text');
  const outputText = container.querySelector('#rdl-output-text');
  const caseSensitive = container.querySelector('#rdl-case-sensitive');
  const trimSpace = container.querySelector('#rdl-trim-space');
  const removeEmpty = container.querySelector('#rdl-remove-empty');
  const processBtn = container.querySelector('#rdl-process-btn');
  const copyBtn = container.querySelector('#rdl-copy-btn');
  const downloadBtn = container.querySelector('#rdl-download-btn');
  const statOriginal = container.querySelector('#rdl-stat-original');
  const statRemoved = container.querySelector('#rdl-stat-removed');
  const statUnique = container.querySelector('#rdl-stat-unique');
  const alertContainer = container.querySelector('#rdl-alert-container');

  // De-duplication Logic
  function processList() {
    const rawText = inputText.value;
    
    if (!rawText) {
      outputText.value = '';
      statOriginal.textContent = '0';
      statRemoved.textContent = '0';
      statUnique.textContent = '0';
      alertContainer.innerHTML = '';
      return;
    }

    const lines = rawText.split(/\r?\n/);
    const originalCount = lines.length;

    const seen = new Set();
    const resultLines = [];

    lines.forEach((line) => {
      let processedLine = line;

      if (trimSpace.checked) {
        processedLine = processedLine.trim();
      }

      if (removeEmpty.checked && processedLine === '') {
        return;
      }

      const lookupKey = caseSensitive.checked ? processedLine : processedLine.toLowerCase();

      if (!seen.has(lookupKey)) {
        seen.add(lookupKey);
        resultLines.push(processedLine);
      }
    });

    const uniqueCount = resultLines.length;
    const removedCount = originalCount - uniqueCount;

    // Update Output & Statistics[cite: 1]
    outputText.value = resultLines.join('\n');
    statOriginal.textContent = originalCount;
    statRemoved.textContent = removedCount;
    statUnique.textContent = uniqueCount;

    // Real-time Badge Updates & Empty State Alert[cite: 1]
    if (removedCount === 0 && originalCount > 0) {
      alertContainer.innerHTML = `
        <div class="rdl-alert rdl-alert-info">
          No duplicate lines detected.[cite: 1]
        </div>
      `;
    } else {
      alertContainer.innerHTML = '';
    }
  }

  // Copy to Clipboard
  function copyToClipboard() {
    if (!outputText.value) return;
    navigator.clipboard.writeText(outputText.value).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    });
  }

  // Download TXT File
  function downloadTextFile() {
    if (!outputText.value) return;
    const blob = new Blob([outputText.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cleaned-list.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Event Listeners for Dynamic Real-time Updates[cite: 1]
  inputText.addEventListener('input', processList);
  caseSensitive.addEventListener('change', processList);
  trimSpace.addEventListener('change', processList);
  removeEmpty.addEventListener('change', processList);
  processBtn.addEventListener('click', processList);
  copyBtn.addEventListener('click', copyToClipboard);
  downloadBtn.addEventListener('click', downloadTextFile);
}