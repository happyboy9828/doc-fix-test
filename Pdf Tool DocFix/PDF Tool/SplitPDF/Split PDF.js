// src/utility/tool.js

export function initSplitPdfTool(containerElement) {
  let activeFile = null;
  let pdfJsDoc = null;
  let totalPages = 0;
  let selectedPages = new Set();
  let generatedBlobUrl = null;

  // 1. Render Main Layout
  containerElement.innerHTML = `
    <div class="split-pdf-container">
      <header class="split-pdf-header">
        <h1>Split PDF</h1>
        <p>Extract specific pages or break down large PDF documents effortlessly.</p>
      </header>

      <div class="split-pdf-layout">
        <!-- LEFT COLUMN: Page Thumbnail Grid -->
        <div class="split-pdf-col-left">
          <div class="drop-zone" id="drop-zone">
            <div class="drop-zone-icon">📄</div>
            <p id="drop-zone-text">Drag & Drop PDF file here or <label for="pdf-file-input" class="browse-label">Browse</label></p>
            <input type="file" id="pdf-file-input" accept="application/pdf" style="display: none;">
          </div>

          <div id="active-doc-banner" class="active-doc-banner" style="display: none;">
            <span id="doc-info-text">Contract_v2.pdf - 0 Pages</span>
            <button id="btn-remove-file" class="btn-remove">&times;</button>
          </div>

          <div class="selection-actions" id="selection-actions" style="display: none;">
            <span>Visual Page Selector Grid</span>
            <div>
              <button id="btn-select-all" class="btn-secondary-sm">Select All</button>
              <button id="btn-deselect-all" class="btn-secondary-sm">Deselect All</button>
            </div>
          </div>

          <div class="thumbnail-grid" id="thumbnail-grid"></div>
        </div>

        <!-- RIGHT COLUMN: Settings -->
        <div class="split-pdf-col-right">
          <div class="card settings-card">
            <h3>Split Method</h3>
            <div class="form-group">
              <label class="radio-label">
                <input type="radio" name="split-method" value="custom" checked> Custom Ranges
              </label>
              <label class="radio-label">
                <input type="radio" name="split-method" value="extract-all"> Extract Every Page (Individual PDFs)
              </label>
              <label class="radio-label">
                <input type="radio" name="split-method" value="split-every"> Split Every <input type="number" id="split-n-pages" value="2" min="1" class="number-input"> Pages
              </label>
            </div>

            <hr class="divider">

            <div id="custom-range-section">
              <h3>Custom Range Input</h3>
              <div class="form-group">
                <input type="text" id="range-input" placeholder="e.g. 1-2, 5-8" class="text-input" disabled>
                <span class="selection-count" id="selection-count">(Selected: 0 total pages)</span>
              </div>
              <hr class="divider">
            </div>

            <h3>Output Options</h3>
            <div class="form-group">
              <label class="radio-label">
                <input type="radio" name="output-option" value="single" checked> Single Merged File
              </label>
              <label class="radio-label">
                <input type="radio" name="output-option" value="zip"> Separate Files (.ZIP)
              </label>
            </div>

            <div class="action-area">
              <button id="btn-split" class="btn-primary" disabled>Split PDF</button>
              <button id="btn-download" class="btn-success" style="display: none;">Download Split File(s)</button>
            </div>

            <div id="progress-container" class="progress-container" style="display: none;">
              <div id="progress-bar" class="progress-bar"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind DOM elements
  const dropZone = containerElement.querySelector('#drop-zone');
  const fileInput = containerElement.querySelector('#pdf-file-input');
  const activeDocBanner = containerElement.querySelector('#active-doc-banner');
  const docInfoText = containerElement.querySelector('#doc-info-text');
  const btnRemoveFile = containerElement.querySelector('#btn-remove-file');
  const selectionActions = containerElement.querySelector('#selection-actions');
  const thumbnailGrid = containerElement.querySelector('#thumbnail-grid');
  const rangeInput = containerElement.querySelector('#range-input');
  const selectionCount = containerElement.querySelector('#selection-count');
  const btnSelectAll = containerElement.querySelector('#btn-select-all');
  const btnDeselectAll = containerElement.querySelector('#btn-deselect-all');
  const btnSplit = containerElement.querySelector('#btn-split');
  const btnDownload = containerElement.querySelector('#btn-download');
  const splitNPages = containerElement.querySelector('#split-n-pages');
  const progressContainer = containerElement.querySelector('#progress-container');
  const progressBar = containerElement.querySelector('#progress-bar');
  const customRangeSection = containerElement.querySelector('#custom-range-section');

  // Event Listeners
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  btnRemoveFile.addEventListener('click', resetAll);

  btnSelectAll.addEventListener('click', () => {
    selectedPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    syncRangeInputFromSelection();
    updateThumbnailsUI();
  });

  btnDeselectAll.addEventListener('click', () => {
    selectedPages.clear();
    syncRangeInputFromSelection();
    updateThumbnailsUI();
  });

  rangeInput.addEventListener('input', () => {
    parseRangeInput();
    updateThumbnailsUI();
  });

  containerElement.querySelectorAll('input[name="split-method"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const method = e.target.value;
      if (method === 'custom') {
        customRangeSection.style.display = 'block';
        rangeInput.disabled = false;
      } else {
        customRangeSection.style.display = 'none';
      }
      resetDownloadState();
    });
  });

  btnSplit.addEventListener('click', processSplit);

  // File Loader
  async function handleFile(file) {
    if (file.type !== 'application/pdf') {
      alert('Please select a valid PDF file.');
      return;
    }

    activeFile = file;
    const arrayBuffer = await file.arrayBuffer();
    pdfJsDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages = pdfJsDoc.numPages;

    docInfoText.textContent = `${file.name} - ${totalPages} Pages`;
    dropZone.style.display = 'none';
    activeDocBanner.style.display = 'flex';
    selectionActions.style.display = 'flex';
    rangeInput.disabled = false;
    btnSplit.disabled = false;

    // Default select all pages
    selectedPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    syncRangeInputFromSelection();
    renderThumbnails();
  }

  // Render Grid
  async function renderThumbnails() {
    thumbnailGrid.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
      const card = document.createElement('div');
      card.className = `thumb-card ${selectedPages.has(i) ? 'selected' : ''}`;
      card.dataset.page = i;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedPages.has(i);
      checkbox.className = 'thumb-checkbox';

      const canvas = document.createElement('canvas');
      const label = document.createElement('span');
      label.textContent = `Pg ${i}`;

      card.appendChild(checkbox);
      card.appendChild(canvas);
      card.appendChild(label);

      card.addEventListener('click', (e) => {
        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
          selectedPages.add(i);
        } else {
          selectedPages.delete(i);
        }
        syncRangeInputFromSelection();
        updateThumbnailsUI();
      });

      thumbnailGrid.appendChild(card);

      // Render thumbnail canvas
      const page = await pdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.25 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const renderContext = { canvasContext: canvas.getContext('2d'), viewport };
      await page.render(renderContext).promise;
    }
  }

  function updateThumbnailsUI() {
    const cards = thumbnailGrid.querySelectorAll('.thumb-card');
    cards.forEach((card) => {
      const pageNum = parseInt(card.dataset.page, 10);
      const isSelected = selectedPages.has(pageNum);
      const checkbox = card.querySelector('input[type="checkbox"]');

      if (isSelected) {
        card.classList.add('selected');
        checkbox.checked = true;
      } else {
        card.classList.remove('selected');
        checkbox.checked = false;
      }
    });

    selectionCount.textContent = `(Selected: ${selectedPages.size} total pages)`;
    resetDownloadState();
  }

  function syncRangeInputFromSelection() {
    const sorted = Array.from(selectedPages).sort((a, b) => a - b);
    if (sorted.length === 0) {
      rangeInput.value = '';
      return;
    }

    const ranges = [];
    let start = sorted[0];
    let end = start;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = start;
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    rangeInput.value = ranges.join(', ');
  }

  function parseRangeInput() {
    const val = rangeInput.value.trim();
    selectedPages.clear();

    if (!val) {
      selectionCount.textContent = `(Selected: 0 total pages)`;
      return;
    }

    const parts = val.split(',');
    parts.forEach((part) => {
      const range = part.trim().split('-');
      if (range.length === 1) {
        const page = parseInt(range[0], 10);
        if (page >= 1 && page <= totalPages) selectedPages.add(page);
      } else if (range.length === 2) {
        const start = parseInt(range[0], 10);
        const end = parseInt(range[1], 10);
        if (start && end && start <= end) {
          for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
            selectedPages.add(p);
          }
        }
      }
    });

    selectionCount.textContent = `(Selected: ${selectedPages.size} total pages)`;
  }

  function resetDownloadState() {
    if (generatedBlobUrl) {
      URL.revokeObjectURL(generatedBlobUrl);
      generatedBlobUrl = null;
    }
    btnDownload.style.display = 'none';
    btnSplit.style.display = 'block';
  }

  function resetAll() {
    activeFile = null;
    pdfJsDoc = null;
    totalPages = 0;
    selectedPages.clear();
    thumbnailGrid.innerHTML = '';
    dropZone.style.display = 'block';
    activeDocBanner.style.display = 'none';
    selectionActions.style.display = 'none';
    rangeInput.value = '';
    rangeInput.disabled = true;
    btnSplit.disabled = true;
    fileInput.value = '';
    resetDownloadState();
  }

  // Processing Execution
  async function processSplit() {
    if (!activeFile) return;

    const splitMethod = containerElement.querySelector('input[name="split-method"]:checked').value;
    const outputOption = containerElement.querySelector('input[name="output-option"]:checked').value;

    progressContainer.style.display = 'block';
    progressBar.style.width = '20%';

    try {
      const { PDFDocument } = window.PDFLib;
      const arrayBuffer = await activeFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer);

      let targetGroups = []; // Array of page-number arrays

      if (splitMethod === 'custom') {
        const pages = Array.from(selectedPages).sort((a, b) => a - b);
        if (pages.length === 0) {
          alert('Please select at least one page.');
          progressContainer.style.display = 'none';
          return;
        }
        if (outputOption === 'single') {
          targetGroups.push(pages);
        } else {
          pages.forEach((p) => targetGroups.push([p]));
        }
      } else if (splitMethod === 'extract-all') {
        for (let i = 1; i <= totalPages; i++) targetGroups.push([i]);
      } else if (splitMethod === 'split-every') {
        const n = parseInt(splitNPages.value, 10) || 1;
        for (let i = 1; i <= totalPages; i += n) {
          const group = [];
          for (let j = i; j < i + n && j <= totalPages; j++) group.push(j);
          targetGroups.push(group);
        }
      }

      progressBar.style.width = '50%';

      if (outputOption === 'single' && targetGroups.length === 1) {
        // Output single PDF
        const newPdf = await PDFDocument.create();
        const indices = targetGroups[0].map((p) => p - 1);
        const copiedPages = await newPdf.copyPages(srcDoc, indices);
        copiedPages.forEach((p) => newPdf.addPage(p));

        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        generatedBlobUrl = URL.createObjectURL(blob);

        setupDownloadButton(generatedBlobUrl, 'Split_Document.pdf');
      } else {
        // Output bundled ZIP archive
        const zip = new JSZip();

        for (let idx = 0; idx < targetGroups.length; idx++) {
          const group = targetGroups[idx];
          const newPdf = await PDFDocument.create();
          const indices = group.map((p) => p - 1);
          const copiedPages = await newPdf.copyPages(srcDoc, indices);
          copiedPages.forEach((p) => newPdf.addPage(p));

          const pdfBytes = await newPdf.save();
          const fileName = `Split_Part_${idx + 1}_(Pg_${group.join('-')}).pdf`;
          zip.file(fileName, pdfBytes);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        generatedBlobUrl = URL.createObjectURL(zipBlob);

        setupDownloadButton(generatedBlobUrl, 'Split_Documents.zip');
      }

      progressBar.style.width = '100%';
      setTimeout(() => {
        progressContainer.style.display = 'none';
        btnSplit.style.display = 'none';
        btnDownload.style.display = 'block';
      }, 400);

    } catch (err) {
      console.error('Error splitting PDF:', err);
      alert('An error occurred during splitting.');
      progressContainer.style.display = 'none';
    }
  }

  function setupDownloadButton(blobUrl, filename) {
    btnDownload.onclick = () => {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
    };
  }
}